"use strict";

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

var userPopulateArgument = {
    path: "projects graphs",
    select: "name ips metrics time"
};

var isUndefined = function(value) {
    return (value === 'undefined');
};

var valueWithDefault = function(value, defaultValue) {
    if (isUndefined(value)) {
        return defaultValue;
    }
    return value;
};

app.set('port', (config.webServer.port || 3000));

var requireLogin = function(req, res, next) {
    logger('visited:', req.url);
    if(req.url.indexOf('/login') >= 0 || req.url.indexOf('/js') >= 0
        || req.url.indexOf('/css') >= 0 || req.url.indexOf('/images') >= 0) {
        next();
        return;
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
        ).populate(userPopulateArgument.path,userPopulateArgument.select);
    } else {
        res.redirect('/login.html')
    }
};

var requireRoot = function(req, res, next) {
    if(req.user.role == 'Root') {
        next();
    } else {
        res.status(401).send('You must be Root to perform this action');
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

var handlePluralGet = function(req, res, name, model, query, extraModelActions) {
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
    if(isUndefined(extraModelActions)) extraModelActions = [];

    var skip = valueWithDefault(req.query.skip, 0),
        limit = valueWithDefault(req.query.limit, 15);
    skip = parseInt(skip);
    limit = parseInt(limit);

    model.count(query, function (err, count) {
        if (err) {
            res.status(500).send("Cannot count " + name + " number");
            logger(err);
            return;
        }
        var q = extraModelActions.reduce(
            function(preValue, currValue){
                return preValue[currValue.methodName].apply(preValue, currValue.arguments);
        },
        model.find(query)
             .skip(skip)
             .limit(limit)
        );
        q.exec(function (err, instances) {
            if(err) {
                res.status(500).send("Cannot fetch " + name + " list");
                logger(err);
                return;
            }
            res.setHeader('Content-Type', 'application/json');
            res.send({
                total: count,
                skip: skip,
                limit: limit,
                result: instances
            });
        });
    });
};

var handleDeleteById = function(req, res, name, model) {
    // Used to simplify DELETE /<name>/<name_id> methods
    //
    // name: string, used 1) to get corresponding id, 2) in error string
    // model: mongoose model

    var id = req.params[name + '_id'];
    model.findByIdAndRemove(id, function(err) {
        if(err) {
            var errString = 'Failed to delete ' + name + ' ' + id;
            res.status(500).send(errString);
            logger(errString, err);
            return;
        }
        res.status(200).send(name + ' ' + id + ' has been deleted');
    });
};

var handleGetById = function(req, res, name, model, extraModelActions) {
    // Used to simplify GET /<name>/<name_id> methods
    //
    // Meanings of name, model and extraModelActions are same as
    // in `handlePluralGet`

    if (isUndefined(extraModelActions)) extraModelActions = [];

    var id = req.params[name + '_id'];

    var q = extraModelActions.reduce(
        function(preValue, currValue) {
            return preValue[currValue.methodName].apply(preValue, currValue.arguments);
        },
        model.findById(id)
    );
    q.exec(function (err, found) {
        var errString;
        if(err) {
            errString = 'Error fetching ' + name + ' info';
            res.status(500).send(errString);
            logger(errString);
            return;
        }
        if(!found) {
            errString = name + ' ' + id + ' does not exist';
            res.status(404).send(errString);
            return;
        }
        res.send(found);
    });
};

app.get('/nodes', function(req, res) {
    var q = {};
    if(req.user.role != 'Root') {
        q = {project: {$in: req.user.projects}}
    }
    handlePluralGet(req, res,
        'node', db.Node, q,
        [
            {
                methodName: 'populate',
                arguments: ['tags region idc project', 'name']
            }
        ]);
});

var isIPandPort = function(s) {
    // Some old versions of nodejs don't support `endsWith`
    //if (s.endsWith(':')){ return false }
    if (s[s.length-1] === ':'){ return false }
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

// Find document by name from collection model `databaseModel`,
// if `insertIfNotExist` is true, then insert if not exist
var documentFromName = function (name, databaseModel, insertIfNotExist) {
    if(isUndefined(insertIfNotExist)) {
        insertIfNotExist = false;
    }
    var result;  // now undefined
    databaseModel.findOne({name: name},
        function(err, doc) {
            if (!err) {
                if(doc === null && insertIfNotExist) {
                    databaseModel.create({name: name},
                        function(err, doc) {
                            if(!err) {
                                result = doc;
                            }
                        }
                    );
                }
                result = result || doc;
            }
        }
    );
    return result;
};

app.post('/nodes', function(req, res) {
    var name = req.body.name,
        nickname = valueWithDefault(req.body.nickname, ''),
        description = valueWithDefault(req.body.description, ''),
        ips = req.body.ips,
        tags = valueWithDefault(req.body.tags, ['']),
        region = valueWithDefault(req.body.region, ''),
        idc = valueWithDefault(req.body.idc, ''),
        project = valueWithDefault(req.body.project, '');

    if (isUndefined(name)) {
        res.status(400).send("Must specify a name");
        return;
    }

    if (isUndefined(ips)) {
        res.status(400).send("IP address is required for adding new nodes");
        return
    }
    ips = ips.filter(isIPandPort);
    if (ips.length===0) {
        res.status(400).send("At least one valid IP address is required");
        return
    }
    if (req.user.role !== 'Root' && tags[0] === '') {
        res.status(400)
           .send("You should specify a tag, otherwise you may not be able to see the added node");
        return
    }

    if (tags.constructor !== Array) {
        res.status(400).send('Invalid tag format');
        return
    }

    var region_doc, idc_doc, project_doc;
    async.parallel([  // expand region, idc, project to corresponding documents
        function (callback) {
            region_doc = documentFromName(region, db.Region, true);
            callback();
        },
        function (callback) {
            idc_doc = documentFromName(idc, db.Idc, true);
            callback();
        },
        function (callback) {
            project_doc = documentFromName(project, db.Project, true);
            callback();
        }
    ],  function(err) {
            if(err) {
                res.status(500).send('Some database error');
                logger(err);
                return;
            }
            async.map(tags,
                function (tag, map_callback) {
                    map_callback(null, documentFromName(tag, db.Tag, false));
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
                            tags: tags,
                            region: region_doc,
                            idc: idc_doc,
                            project: project_doc
                        },
                        function (err, n) {
                            if (err) {
                                res.status(500).send('Node create failed');
                                logger(err);
                                return;
                            }
                            logger('Node created', n);
                            res.status(201).send('Node added');
                        }
                    );
                    if (monitorItems.entries().length !== 0) {
                        nodeCommander(ips, monitorItems.entries(), []);
                    }
                });
        }
    );
});

app.put('/node/:node_id', function (req, res) {
    var node_id = req.params.node_id;
    var graph = req.body.graph,
        deleteId = req.body.deleteId;
    if(deleteId!=null){//delete graph
        deleteGraph(deleteId, req, res);
        modifyNode(node_id, req, res);
    }else if(graph){//add new graph
        db.Graph.create(graph,function(err,found){
            if (err) {
                res.status(500).send('Graph create failed');
                logger(err);
                return;
            }
            modifyNode(node_id, req, res, found._id);
        });
    }else {
        modifyNode(node_id, req, res);
    }
});

// FIXME too long a function
var modifyNode = function(node_id,req,res,result){
    var name = req.body.name,
        nickname = req.body.nickname,
        description = req.body.description,
        ips = req.body.ips,
        tags = valueWithDefault(req.body.tags, []),
        region = req.body.region,
        idc = req.body.idc,
        project = req.body.project,
        nodeGraph = req.body.nodeGraph,
        graphInfo = req.body.graphInfo;//delete
    var update = {};
    if (ips) {
        ips = ips.filter(isIPandPort);
        if (ips.length===0) {
            res.status(400).send("At least one valid IP address is required");
            return;
        }
    }
    if(result != null && graphInfo == null){ //add
        graphInfo = nodeGraph.graphInfo;
        var graphListIndex = nodeGraph.graphListIndex,
            graphs = graphInfo[graphListIndex].graphs;
        if(graphs == null) graphs = [];
        graphs.push(result);
        graphInfo[graphListIndex] ={
            user:graphInfo[graphListIndex].user,
            graphs:graphs
        };
    }
    if(graphInfo&&graphInfo.constructor === Array)
        update.graphInfo = graphInfo;
    if (name) update.name = name;
    if (nickname) update.nickname = nickname;
    if (description) update.description = description;
    if (ips) update.ips = ips;
    if (tags.constructor !== Array) {
        res.status(400).send('Invalid tag format');
        return;
    }

    async.parallel([  // expand region, idc, project to corresponding documents
            function (callback) {
                if(region) {
                    update.region = documentFromName(region, db.Region, true);
                }
                callback();
            },
            function (callback) {
                if(idc) {
                    update.idc = documentFromName(idc, db.Idc, true);
                }
                callback();
            },
            function (callback) {
                if(project) {
                    update.project = documentFromName(project, db.Project, true);
                }
                callback();
            }
        ], function(err) {
            if(err) {
                res.status(500).send('Some database error');
                logger(err);
                return;
            }
            async.map(tags,
                function(tag, map_callback){
                    map_callback(null, documentFromName(tag, db.Tag, false));
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
                            res.status(200).send(result);
                        }
                    );
                }
            );
        }
    );
};

app.get('/node/:node_id',function(req, res) {
    handleGetById(req, res, 'node', db.Node,
        [
            {
                methodName: 'populate',
                // return only names for them
                arguments: ['tags region idc project', 'name']
            }
        ]
    );
});

app.delete('/node/:node_id', function(req, res) {
    handleDeleteById(req, res, 'node', db.Node);
});

app.get('/tags', function(req, res) {
    var q = {};
    if(req.user.role != 'Root') {
        q = {_id: {$in: req.user.tags}}
    }
    handlePluralGet(req, res,
        'tag', db.Tag, q, [])
});

app.post('/tags', function (req, res) {
    var name = req.body.name,
        monitorItems = valueWithDefault(req.body.monitorItems, []),
        alarmRules = valueWithDefault(req.body.alarmRules, []),
        alarmReceiverGroups = valueWithDefault(req.body.alarmReceiverGroups, []);
    if(isUndefined(name)) {
        res.status(400).send("Tag name is required");
        return
    }
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

app.get('/tag/:tag_id', function(req, res){
    handleGetById(req, res, 'tag', db.Tag);
});

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
    handleDeleteById(req, res, 'tag', db.Tag);
});

var queryNode = function(req, res) {
    var skip = valueWithDefault(req.query.skip, 0),
        limit = valueWithDefault(req.query.limit, 15),
        query = req.query.node;
    skip = parseInt(skip);
    limit = parseInt(limit);

    async.map(
        query.split(' '),
        function(s, map_callback){
            var sregx = new RegExp(s, 'i');
            async.parallel([
                    function (callback) {
                        var q = {name: sregx};
                        db.Tag.find(q, {_id: 1}, // only return id
                            function (err, tags) {
                                if (err) {
                                    callback(err, {})
                                }
                                var ids = tags.map(function (tag) {
                                    return tag._id
                                });
                                if(req.user.role != 'Root') {
                                    ids = ids.filter(function(x){
                                        return req.user.tags.indexOf(x) != -1
                                    }); // intersection of ids and user.tags
                                }
                                db.Node.find({tags: {$in: ids}},
                                    function (err, nodes) {
                                        if (err) {
                                            callback(err, {})
                                        }
                                        callback(null, nodes)
                                    }).populate('tags', 'name');  // return only name of tag
                            }
                        )
                    },
                    function (callback) {
                        var q = {$or:[
                            {name: sregx},
                            {nickname: sregx},
                            {ips: sregx}
                        ]};
                        if(req.user.role != 'Root') {
                            q = {
                                $and: [
                                    {
                                        $or: [
                                            {name: sregx},
                                            {nickname: sregx},
                                            {ips: sregx}
                                        ]
                                    },
                                    {project: {$in: req.user.projects}}
                                ]
                            }
                        }
                        db.Node.find(q,
                            function (err, nodes) {
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
    var q = {name: sregx};
    if(req.user.role != 'Root') {
        q = {_id: {$in: req.user.tags, name: sregx}}
    }
    handlePluralGet(req, res,
        'tag', db.Tag, q, []);
};

var queryUser = function(req, res) {
    var query = req.query.user;
    var sregx = new RegExp(query.trim(), 'i');
    var q = {name: sregx};
    handlePluralGet(req, res,
        'user', db.User, q,
        [{
            methodName: 'populate',
            arguments: [userPopulateArgument.path,userPopulateArgument.select]
        }]);
};

var queryOauthUser = function(req, res) {
    var query = req.query.oauthuser;
    if (query.length < 3) {
        // Only send request to OAuth server if more than 2 letters in query,
        // otherwise the response would be VERY SLOW(by @lidezhi)
        res.send([]);
        return
    }
    request({
        rejectUnauthorized: false,  // same reason as app.post('/login')
        method: 'GET',
        url: 'https://oauth.lecloud.com/watchtvgetldapuser?username='
        + query + '&appid=watchtv&appkey=watchtv&limit=5',
        json: true
    },
        function(err, resp, body) {
            if(err) {
                logger('Error connecting to OAuth server');
                res.status(500).send('Error connecting to OAuth server');
                return
            }
            var result = body.map(function(user){
                // get user name from email address
                return user.email.split('@')[0]
            });
            res.send(result)
        }
    );
};

// For "Find anything"
app.get('/q', function(req, res){
    if(req.query.node != undefined) {
        // /q?node=xxx
        queryNode(req, res);
    } else if (req.query.tag != undefined) {
        // /q?tag=xxx
        queryTag(req, res);
    } else if (req.query.user != undefined) {
        // /q?user=xxx
        queryUser(req, res);
    } else if (req.query.oauthuser != undefined) {
        // /q?oauthuser=xxx
        queryOauthUser(req, res);
    } else {
        res.status(400).send("Invalid query");
    }
});

app.get('/config', function(req, res) {
    res.status(200).send(config.webApp);
});

app.get('/users', requireRoot, function(req, res) {
    handlePluralGet(req, res,
        'user', db.User, {},
        [{
            methodName: 'populate',
            arguments: [userPopulateArgument.path,userPopulateArgument.select]
        }]
    )
});

app.post('/users', requireRoot,
    function(req, res){
    var name = req.body.name,
        graphs = valueWithDefault(req.body.graphs, []),
        role = valueWithDefault(req.body.role, 'User'),
        projects = valueWithDefault(req.body.projects, ['']);
    if(isUndefined(name)) {
        res.status(400).send('Must specify a name');
        return
    }

    request({
            rejectUnauthorized: false,  // same reason as app.post('/login')
            method: 'GET',
            url: 'https://oauth.lecloud.com/watchtvgetldapuser?username='
                 + name + '&appid=watchtv&appkey=watchtv&limit=3',
            json: true
        },
        function(err, resp, body) {
            if(err) {
                logger('Error connecting to OAuth server', err);
                res.status(500).send('Error connecting to OAuth server');
                return
            }

            if(body.length > 0 && body[0].email == name+'@letv.com') {
                async.map(projects,
                    function(project, map_callback) {
                        map_callback(null, documentFromName(project, db.Project, false));
                    },
                    function(err, results) {
                        projects = results.filter(
                            function(p) {
                                return p;
                            }
                        );
                        db.User.create({
                                name: name,
                                graphs: graphs,
                                role: role,
                                projects: projects
                            },
                            function(err, u) {
                                if(err) {
                                    res.status(500).send('User add failed');
                                    logger(err);
                                    return
                                }
                                logger('User added', u);
                                res.status(201).send('User added');
                            }
                        )
                    }
                )
            } else {
                res.status(400).send('User name not found from Letv OAuth');
            }
        }
    );
});

app.put('/user/:user_id', function(req, res){
    var graph = req.body.graph,
        deleteId = req.body.deleteId;
    var user_id = req.params.user_id;
    if(deleteId!=null){//delete graph
        deleteGraph(deleteId,req,res);
        modifyUser(user_id,req, res);
    }else if(graph){//add new graph
        db.Graph.create(graph,function(err,found){
            if (err) {
                res.status(500).send('Graph create failed');
                logger(err);
                return;
            }
            modifyUser(user_id, req, res, found._id);
        });
    }else {
        modifyUser(user_id, req, res);
    }
});

var modifyUser = function(user_id, req, res, result){
    var name = req.body.name,
        projects = req.body.projects,
        role = req.body.role,
        graphs = req.body.graphs;
    if(result!=null){
        if(graphs == null) graphs = [];
        graphs.push(result);
    }
    var update = {};
    if(name) {
        res.status(403).send('Cannot modify user name');
        return
    }
    if(graphs && graphs.constructor === Array){
        update.graphs = graphs;
    }
    if(role) {
        update.role = role
    }
    if(!projects) {
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
        );
        return
    }
    if(projects.constructor !== Array) {
        res.status(400).send('Invalid tag format');
        return
    }
    async.map(projects,
        function(project, map_callback) {
            map_callback(null, documentFromName(project, db.Project, false));
        },
        function(err, results) {
            update.projects= results.filter(
                function(p) {
                    return p;
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
};

app.get('/user', function(req, res) {
    res.send(req.user); // req.user is assigned in `requireLogin`
});

app.get('/user/:user_id', requireRoot, function(req, res) {
    handleGetById(req, res, 'user', db.User,
    [
        {
            methodName: 'populate',
            arguments: [userPopulateArgument.path, userPopulateArgument.select]
        }
    ])
});

app.delete('/user/:user_id', requireRoot,
    function(req, res) {
        handleDeleteById(req, res, 'user', db.User);
    }
);

app.put('/graph/:graph_id', requireRoot, function(req, res) {
    var id = req.params.graph_id,
    graph = req.body.graph;
    db.Graph.findOneAndUpdate(
        { _id: id },
        { '$set': graph },
        function(err, u) {
            if(err) {
                res.status(500).send('Existence checking failed');
                logger(err);
                return
            }
            if(!u) {
                res.status(404).send(id + ' does not exist');
                return
            }
            res.status(200).send('Updated');
        }
    );
});

var deleteGraph = function(id, req, res){
    db.Graph.findByIdAndRemove(id, function (err) {
        if (err) {
            res.status(500).send("Failed to execute delete");
            logger(err);
        }
    })
};

app.get('/graph/:graph_id', function(req, res) {
    handleGetById(req, res, 'graph', db.Graph)
});

app.post('/login', function(req, res) {
    var user = req.body.user,
        password = encodeURIComponent(req.body.password);

    if(!user || !password) {
        res.status(400).send('Invalid username or password');
        return
    }
    var url = 'https://oauth.lecloud.com/nopagelogin?username=' + user +
            '&password=' + password + '&ldap=true';
    logger(url);
    request({
        rejectUnauthorized: false,// This is a workaround since the certs of
                                  // lecloud.com seems not configured properly.
                                  // Read https://github.com/coolaj86/node-ssl-root-cas
                                  // for more info.
        method: "GET",
        url: 'https://oauth.lecloud.com/nopagelogin?username=' + user +
             '&password=' + password + '&ldap=true',
        json: true
        },
        function(err, resp, body) {
            if(err) {
                logger('Error connecting to OAuth server');
                res.status(500).send('Error connecting to OAuth server');
                return
            }
            if(body.error) {
                logger('Authentication error,', body);
                res.status(401).send('Incorrect username or password');
                return
            }
            db.User.update(
                {name: user},
                {name: user},
                {upsert: true}, // save user to our db if not exist
                function() {
                    req.session.user = user;
                    res.redirect('/dashboard.html');
                }
            );
        }
    );
});

app.get('/logout', function(req, res) {
    req.session.reset();
    res.redirect('/login.html');
});


app.get('/regions', function(req, res) {
    handlePluralGet(req, res,
        'region', db.Region, {}, []
    )
});

app.post('/regions', function(req, res) {
    var name = req.body.name;
    if(isUndefined(name)) {
        res.status(400).send("Must specify a name");
        return;
    }
    db.Region.create({
        name: name
    }, function(err, r){
        if (err) {
            res.status(500).send('Region create failed');
            logger(err);
            return;
        }
        res.status(201).send('Region created');
    })
});

app.put('/region/:region_id', function(req, res) {
    var name = req.body.name,
        region_id = req.params.region_id;
    if(isUndefined(name)) {
        res.status(400).send("Must specify a name");
        return;
    }
    var update = {};
    update.name = name;
    db.Region.findOneAndUpdate(
        { _id: region_id },
        { '$set': update },
        function (err, t) {
            if(err) {
                res.status(500).send('Existence checking failed');
                logger(err);
                return;
            }
            if(!t) {
                res.status(404).send(region_id + ' does not exist');
                return;
            }
            res.status(200).send('Updated');
        }
    )
});

app.delete('/region/:region_id', function(req, res) {
    handleDeleteById(req, res, 'region', db.Region)
});

app.get('/region/:region_id', function(req, res) {
    handleGetById(req, res, 'region', db.Region);
});
