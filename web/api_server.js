var fs = require('fs');
var path = require('path');
var express = require('express');
var bodyParser = require('body-parser');
var validator = require('validator');
var async = require('async');
var request = require('request');
var Set = require('jsclass/src/set').Set;
var app = express();
var session = require('client-sessions');

var db = require('./db.js');
var config = require('./config.js');
var logger = require('./logger.js').getLogger('API');

app.set('port', (config.webServer.port || 3000));

var requireLogin = function(req, res, next) {
    console.log(req.url)
    if(req.url.startsWith('/login')) {
        next();
        return
    }
    if(req.session && req.session.user) {
        db.User.findOne({name: req.session.user},
            function(err, u) {
                if(u) {
                    req.user = u;
                    next()
                } else {
                    res.redirect('/login.html')
                }
            }
        )
    } else {
        res.redirect('/login.html')
    }
};

app.use(session({
    cookieName: 'session',
    secret: config.webServer.sessionSecret,
    duration: config.webServer.sessionDuration,
    activeDurations: config.webServer.sessionActiveDuration
}));
app.use(requireLogin);
app.use('/', express.static(path.join(__dirname, 'app', 'static')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));


app.listen(app.get('port'), function() {
    logger('Server started: http://0.0.0.0:' + app.get('port'));
});



var handlePluralGet = function(name, model, query, extraModelActions) {
    // used in GET /nodes, /tags, /users and queryTag

    // name: string, used in notification string and result key name
    // model: mongoose model
    // query: query sent to mongodb
    // extraModelActions: actions to apply to mongoose query, in format
    //                  [{
    //                      methodName: 'method',
    //                      arguments: ['arg1', 'arg2', ...]
    //                  },
    //                  { ... }, ...]
    if(!extraModelActions) extraModelActions = [];

    return function(req, res) {
        var skip = req.query.skip,
            limit = req.query.limit;
        if (!skip) skip = 0;
        if (!limit) limit = 15;
        skip = parseInt(skip);
        limit = parseInt(limit);

        model.count(query, function (err, count) {
            if (err) {
                res.status(500).send("Cannot count " + name + " number");
                logger(err);
                return
            }
            var q = extraModelActions.reduce(
                function(preValue, currValue){
                    return preValue[currValue.methodName].apply(preValue, currValue.arguments)
            },
            model.find(query)
                 .skip(skip)
                 .limit(limit)
            );
            q.exec(function (err, instances) {
                if(err) {
                    res.status(500).send("Cannot fetch " + name + " list");
                    logger(err);
                    return
                }
                res.setHeader('Content-Type', 'application/json');
                res.send({
                    total: count,
                    skip: skip,
                    limit: limit,
                    result: instances
                })
            })
        })
    }
};

app.get('/nodes',
    handlePluralGet('node', db.Node, {},
                    [{
                        methodName: 'populate',
                        arguments: ['tags', 'name']
                    }]));

var isIPandPort = function(s) {
    if (s.endsWith(':')){ return false }
    var addr = s.split(':')[0],
        port = s.split(':')[1];  // could be `undefined`
    return (
        validator.isIP(addr) &&
        (!port || validator.isInt(port))
    )
};

// nodeCommander communicates with nodes to enable or disable monitor items.
// nodes: ["ip:port", ...]
// enables: ["item", ...]
// disables: ["item", ...]
var nodeCommander = function(nodes, enables, disables) {
    enables = enables.map(function(en){
        return ({
            "name": en,
            "config": {}
        })
    });
    disables = disables.map(function(dis){
        return ({
            "name": dis,
            "config": {}
        })
    });
    async.map(
        nodes,
        function(n, map_callback) {
            var addr = n.split(':')[0],
                port = n.split(':')[1];
            if (!port) {
                port = config.webServer.defaultDiamondPort;
            }
            request({
                    method: "POST",
                    url: 'http://' + addr + ':' + port + '/collector/enabled',
                    json: true,
                    headers: {
                        "content-type": "application/json"
                    },
                    body: {
                        "enable": enables,
                        "disable": disables
                    }
                },
                function (err, resp, body) {
                    logger(err, resp, body);
                }
            )
        },
        function (err, _) {
            if (err) {
                logger(err)
            }
        }
    )
};

app.post('/nodes', function(req, res) {
    var name = req.body.name,
        nickname = req.body.nickname,
        description = req.body.description,
        ips = req.body.ips,
        tags = req.body.tags;

    if (!ips) {
        res.status(400).send("IP address is required for adding new nodes");
        return
    }
    ips = ips.filter(isIPandPort);
    if (ips.length==0) {
        res.status(400).send("At least one valid IP address is required");
        return
    }

    if (!name) name = '';
    if (!nickname) nickname = '';
    if (!description) description = '';
    if (!tags) tags = [];
    if (tags.constructor !== Array) {
        res.status(400).send('Invalid tag format');
        return
    }
    async.map(tags,
        function (tag, map_callback) {
            db.Tag.findOne({name: tag},
                function (err, t) {
                    if (err) {
                        logger(err);
                        return
                    }
                    map_callback(null, t)
                })
        },
        function (err, results) {
            var monitorItems = new Set([]);
            tags = results.filter(
                function (t) {
                    if (t) {
                        monitorItems.merge(new Set(t.monitorItems));
                        return true;
                    } else {
                        return false;
                    }
                }
            );
            db.Node.create(
                {
                    name: name,
                    nickname: nickname,
                    description: description,
                    ips: ips,
                    tags: tags
                },
                function (err, n) {
                    if (err) {
                        res.status(500).send('Node create failed');
                        logger(err);
                        return
                    }
                    logger('Node created', n);
                    res.status(201).send('Node added');
                }
            );
            if (monitorItems.entries().length != 0) {
                nodeCommander(ips, monitorItems.entries(), []);
            }
        })
});


app.put('/node/:node_id', function (req, res) {
    var node_id = req.params.node_id;
    var name = req.body.name,
        nickname = req.body.nickname,
        description = req.body.description,
        ips = req.body.ips,
        tags = req.body.tags;

    var update = {};
    if (ips) {
        ips = ips.filter(isIPandPort);
        if (ips.length==0) {
            res.status(400).send("At least one valid IP address is required");
            return
        }
    }
    if (name) update.name = name;
    if (nickname) update.nickname = nickname;
    if (description) update.description = description;
    if (ips) update.ips = ips;
    if (!tags) tags = [];
    if (tags.constructor !== Array) {
        res.status(400).send('Invalid tag format');
        return
    }
    async.map(tags,
        function(tag, map_callback){
            db.Tag.findOne({name:tag},
                function(err, t) {
                    if(err) {
                        logger(err);
                        return
                    }
                    map_callback(null, t)
                })
        },
        function(err, results) {
            var updatedMonitorItems = new Set([]);
            update.tags = results.filter(
                function (t) {
                    if (t) {
                        updatedMonitorItems.merge(new Set(t.monitorItems));
                        return true;
                    } else {
                        return false;
                    }
                }
            );
            logger('update', update);
            db.Node.findOneAndUpdate(
                { _id: node_id },
                { '$set': update },
                function (err, n) {
                    // n is the original node record before update
                    if(err) {
                        res.status(500).send('Existence checking failed');
                        logger(err);
                        return
                    }
                    if(!n) {
                        res.status(404).send(node_id + ' does not exist');
                        return
                    }
                    logger('origin', n);
                    async.map(n.tags, // n.tags is an array of ids
                        function (tag, map_callback) {
                            db.Tag.findById(tag,
                                function (err, t) {
                                    if (err) {
                                        logger(err);
                                        return
                                    }
                                    map_callback(null, t)
                                })
                        },
                        function (err, results) {
                            var originalMonitorItems = new Set([]);
                            tags = results.filter(
                                function (t) {
                                    if (t) {
                                        originalMonitorItems.merge(new Set(t.monitorItems));
                                        return true;
                                    } else {
                                        return false;
                                    }
                                }
                            );
                            var toDisable = originalMonitorItems.difference(updatedMonitorItems);
                            var toEnable = updatedMonitorItems.difference(originalMonitorItems);
                            if(!(toEnable.isEmpty() && toDisable.isEmpty())) {
                                nodeCommander(n.ips, toEnable, toDisable);
                            }
                            if(ips) {
                                nodeCommander(ips, updatedMonitorItems, []);
                            }
                        }
                    );
                    res.status(200).send('Updated');
                }
            );
        }
    );
});

app.get('/node/:node_id',
    function(req, res) {
        var node_id = req.params.node_id;
        db.Node.findById(node_id, function (err, found) {
            if (err) {
                res.status(500).send("Cannot fetch node info");
                logger(err);
                return
            }
            if(!found) {
                res.status(404).send("Cannot get info about node " + node_id);
                return
            }
            res.send(found);
        }).populate('tags', 'name'); // return only name
    }
);

app.delete('/node/:node_id', function(req, res) {
    var node_id = req.params.node_id;
    db.Node.findByIdAndRemove(node_id, function (err) {
        if (err) {
            res.status(500).send("Failed to execute delete");
            logger(err);
            return
        }
        res.send(node_id + " has been deleted.")
    })
});

app.get('/tags',
    handlePluralGet('tag', db.Tag, {}, []));

app.post('/tags', function (req, res) {
    var name = req.body.name,
        monitorItems = req.body.monitorItems,
        alarmRules = req.body.alarmRules,
        alarmReceiverGroups = req.body.alarmReceiverGroups;
    if(!name) {
        res.status(400).send("Tag name is required");
        return
    }
    if(!monitorItems) monitorItems = [];
    if(!alarmRules) alarmRules = [];
    if(!alarmReceiverGroups) alarmReceiverGroups = [];
    if(monitorItems.constructor !== Array ||
    alarmRules.constructor !== Array ||
    alarmReceiverGroups.constructor !== Array) {
        res.status(400).send('Invalid request format');
        return
    }
    db.Tag.create({
        name: name,
        monitorItems: monitorItems,
        alarmRules: alarmRules,
        alarmReceiverGroups: alarmReceiverGroups
    },
        function (err, t) {
            if(err) {
                res.status.send('Tag create failed');
                logger(err);
                return
            }
            res.status(201).send('Tag added');
        }
    )
});

app.get('/tag/:tag_id',
    function(req, res){
        var tag_id = req.params.tag_id;
        db.Tag.findById(tag_id, function (err, found) {
            if(err) {
                res.status(500).send("Cannot fetch tag info");
                logger(err);
                return
            }
            if(!found){
                res.status(404).send("Cannot get info about tag " + tag_id);
                return
            }
            res.setHeader('Content-Type', 'application/json');
            res.send(found);
        })
    }
);

app.put('/tag/:tag_id', function(req, res){
    var tag_id = req.params.tag_id;
    var name = req.body.name,
        monitorItems = req.body.monitorItems,
        alarmRules = req.body.alarmRules,
        alarmReceiverGroups = req.body.alarmReceiverGroups;
    var update = {};
    if(name) update.name = name;
    if(monitorItems && monitorItems.constructor === Array) {
        update.monitorItems = monitorItems
    }
    if(alarmRules && alarmRules.constructor === Array) {
        update.alarmRules = alarmRules
    }
    if(alarmReceiverGroups && alarmReceiverGroups.constructor === Array) {
        update.alarmReceiverGroups = alarmReceiverGroups
    }
    db.Tag.findOneAndUpdate(
        { _id: tag_id },
        { '$set': update },
        function (err, t) {  // t is the original tag record
            if(err) {
                res.status(500).send('Existence checking failed');
                logger(err);
                return
            }
            if(!t) {
                res.status(404).send(tag_id + ' does not exist');
                return
            }
            if(update.monitorItems) {
                db.Node.find({tags: t._id},
                    function(err, nodes) {
                        if(err) {
                            logger('fetching nodes by tag', err);
                        }
                        var nodeAddrs = [];
                        nodes.map(function(n){
                            nodeAddrs = nodeAddrs.concat(n.ips)
                        });
                        var originalItems = new Set(t.monitorItems),
                            updateItems = new Set(update.monitorItems);
                        var toDisable = originalItems.difference(updateItems),
                            toEnable = updateItems.difference(originalItems);
                        if(!(toEnable.isEmpty() && toDisable.isEmpty())) {
                            nodeCommander(nodeAddrs, toEnable, toDisable)
                        }
                    }
                )
            }
            res.status(200).send('Updated');
        }
    )
});

app.delete('/tag/:tag_id', function(req, res) {
    var tag_id = req.params.tag_id;
    db.Tag.findByIdAndRemove(tag_id, function (err) {
        if (err) {
            res.status(500).send("Failed to execute delete");
            logger(err);
            return
        }
        res.send(tag_id + " has been deleted.")
    })
});

var queryNode = function(req, res) {
    var skip = req.query.skip,
        limit = req.query.limit,
        query = req.query.node;
    if (!skip) skip = 0;
    if (!limit) limit = 15;
    skip = parseInt(skip);
    limit = parseInt(limit);

    async.map(
        query.split(' '),
        function(s, map_callback){
            var sregx = new RegExp(s, 'i');
            async.parallel([
                    function (callback) {
                        db.Tag.find({'name': sregx}, {_id: 1}, // only return id
                            function (err, tags) {
                                if (err) {
                                    callback(err, {})
                                }
                                var ids = tags.map(function (tag) {
                                    return tag._id
                                });
                                db.Node.find({tags: {$in: ids}},
                                    function (err, nodes) {
                                        if (err) {
                                            callback(err, {})
                                        }
                                        callback(null, nodes)
                                    }).populate('tags', 'name');  // return only name of tag
                            })
                    },
                    function (callback) {
                        db.Node.find({$or:[
                            {name: sregx},
                            {nickname: sregx},
                            {ips: sregx}
                        ]}, function (err, nodes) {
                            callback(err, nodes)
                        }).populate('tags', 'name');  // return only name of tag
                    }
                ],
                function(err, r){
                    if(err){
                        logger(err);
                        res.status(500).send("Cannot complete your query");
                        return
                    }
                    var uniq_nodes = {};
                    r.map(function(nodes){
                        nodes.map(function (node) {
                            uniq_nodes[node._id] = node
                        })
                    });
                    map_callback(null, uniq_nodes)
                })
        },
        function(err, results) {
            var ans = results.reduce(
                function(pre, curr, index, array){
                    if(pre == null){
                        return curr
                    } else {
                        var ans = {};
                        // intersection of pre and curr
                        for (var p in pre) {
                            if (curr[p] != undefined){
                                ans[p] = pre[p]
                            }
                        }
                        return ans
                    }
                },
                null
            );
            var resultNodes = [];
            for (var k in ans) {
                resultNodes.push(ans[k])
            }
            var returnObject = {
                total: resultNodes.length,
                skip: skip,
                limit: limit,
                result: resultNodes.slice(skip, skip + limit)
            };
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send(returnObject);
        }
    );
};

var queryTag = function(req, res) {
    var query = req.query.tag;
    var sregx = new RegExp(query.trim(), 'i');
    handlePluralGet('tag', db.Tag, {name: sregx}, [])(req, res);
};

// For "Find anything"
app.get('/q', function(req, res){
    if(req.query.node != undefined) {
        // /q?node=xxx
        queryNode(req, res);
    } else if (req.query.tag != undefined) {
        // /q?tag=xxx
        queryTag(req, res);
    } else {
        res.status(400).send("Invalid query");
    }
});

app.get('/config',
    function(req, res) {
        res.status(200).send(config.webApp);
});


app.get('/users',
    handlePluralGet('user', db.User, {},
                    [{
                        methodName: 'populate',
                        arguments: ['tags', 'name']
                    }]
));

app.post('/users', function(req, res){
    var name = req.body.name,
        dashboards = req.body.dashboards,
        tags = req.body.tags;
    if(!name) {
        res.status(400).send('Must specify a name');
        return
    }
    if(!dashboards) dashboards = [];
    if(!tags) tags = [];

    //TODO: use LeTV OAuth to verify user name

    db.User.create({
        name: name,
        dashboards: dashboards,
        tags: tags
    },
        function(err, _) {
            if(err) {
                res.status.send('User add failed');
                logger(err);
                return
            }
            res.status(201).send('User added');
        }
    )
});

app.put('/user/:user_id', function(req, res){
    var user_id = req.params.user_id;
    var name = req.body.name,
        dashboards = req.body.dashboards,
        tags = req.body.tags;

    var update = {};
    if(name) {
        res.status(403).send('Cannot modify user name');
        return
    }
    if(dashboards && dashboards.constructor === Array) {
        update.dashboards = dashboards;
    }
    if(!tags) tags = [];
    if(tags.constructor !== Array) {
        res.status(400).send('Invalid tag format');
        return
    }
    async.map(tags,
        function(tag, map_callback) {
            db.Tag.findOne({name: tag},
                function(err, t) {
                    if(err) {
                        logger(err);
                        return
                    }
                    map_callback(null, t)
                }
            )
        },
        function(err, results) {
            update.tags = results.filter(
                function(t) {
                    return t;
                }
            );
            db.User.findOneAndUpdate(
                { _id: user_id },
                { '$set': update },
                function(err, u) {  // u is the original user record
                    if(err) {
                        res.status(500).send('Existence checking failed');
                        logger(err);
                        return
                    }
                    if(!u) {
                        res.status(404).send(user_id + ' does not exist');
                        return
                    }
                    res.status(200).send('Updated');
                }
            )
        }
    );
});

app.get('/user/:user_id',
    function(req, res) {
        var user_id = req.params.user_id;
        db.User.findById(user_id, function (err, found) {
            if (err) {
                res.status(500).send("Cannot fetch node info");
                logger(err);
                return
            }
            if(!found) {
                res.status(404).send("Cannot get info about node " + user_id);
                return
            }
            res.send(found);
        }).populate('tags', 'name'); // return only name
    }
);

app.delete('/user/:user_id', function(req, res) {
    var user_id = req.params.user_id;
    db.User.findByIdAndRemove(user_id, function (err) {
        if (err) {
            res.status(500).send("Failed to execute delete");
            logger(err);
            return
        }
        res.send(user_id + " has been deleted.")
    })
});

app.post('/login', function(req, res) {
    var user = req.body.user,
        password = JSON.stringify(req.body.password);
    if(!user || !password) {
        res.status(400).send('Invalid username or password');
        return
    }
    request({
        rejectUnauthorized: false,// This is a workaround since the certs of
                                  // lecloud.com seems not configured properly.
                                  // Read https://github.com/coolaj86/node-ssl-root-cas
                                  // for more info.
        method: "GET",
        url: 'https://oauth.lecloud.com/nopagelogin?username=' + user +
             '&password=' + password.slice(1, password.length-1) + '&ldap=true',
        json: true
        },
        function(err, resp, body) {
            if(err) {
                logger('Error connecting to OAuth server');
                res.status(500).send('Error connecting to OAuth server');
                return
            }
            if(body.error) {
                res.status(401).send('Incorrect username or password');
                return
            }
            db.User.update(
                {name: user},
                {name: user},
                {upsert: true}, // save user to our db if not exist
                function() {
                    req.session.user = user;
                    res.redirect('/index.html');
                }
            );
        }
    );
});

app.get('/logout', function(req, res) {
    req.session.reset();
    res.redirect('/login.html');
});
