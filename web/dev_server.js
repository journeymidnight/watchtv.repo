
var fs = require('fs');
var path = require('path');
var express = require('express');
var bodyParser = require('body-parser');
var validator = require('validator');
var async = require('async');
var request = require('request');
var Set = require('jsclass/src/set').Set;
var app = express();

app.set('port', (process.env.PORT || 3000));

app.use('/', express.static(path.join(__dirname, './')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));


app.listen(app.get('port'), function() {
  console.log('Server started: http://0.0.0.0:' + app.get('port') + '/');
});

var mongoose = require('mongoose');
mongoose.connect('mongodb://watchtv:watchtv@localhost:27017/watchtv');
var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var tagSchema = new Schema({
    name: String,
    monitorItems: [String],
    alarmRules: [String],
    alarmReceiverGroups: [String]
},
    {
        collection: "Tag"
    }
);

var nodeSchema = new Schema({
    nickname: String,
    name: String,
    description: String,
    ips: [String],
    tags: [{type: Schema.Types.ObjectId, ref: 'Tag'}]
},
    {
        collection: "Node"
    }
);

var Tag = mongoose.model('Tag', tagSchema);
// `Node` represents a monitored system, a machine for example.
var Node = mongoose.model('Node', nodeSchema);

var handlePluralGet = function(name, model, query, extraModelActions) {
    // used in GET /nodes, /tags and queryTag

    // name: string, used in notification string and result key name
    // mode: mongoose model
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
                console.log(err);
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
                    console.log(err);
                    return
                }
                res.setHeader('Content-Type', 'application/json');
                var result = {
                    total: count,
                    skip: skip,
                    limit: limit,
                };
                result[name] = instances;
                res.send(result);
            })
        })
    }
};

app.get('/nodes', handlePluralGet('node', Node, {},
                                [{
                                    methodName: 'populate',
                                    arguments: ['tags', 'name']
                                }]));

var isIPandPort = function(s) {
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
                port = '5000';     // default port
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
                    console.log(err, resp, body);
                }
            )
        },
        function (err, _) {
            if (err) {
                console.log(err)
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
            Tag.findOne({name: tag},
                function (err, t) {
                    if (err) {
                        console.log(err);
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
            Node.create(
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
                        console.log(err);
                        return
                    }
                    console.log('Node created', n);
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
            Tag.findOne({name:tag},
                function(err, t) {
                    if(err) {
                        console.log(err);
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
            console.log('update', update);
            Node.findOneAndUpdate(
                { _id: node_id },
                { '$set': update },
                function (err, n) {
                    // n is the original node record before update
                    if(err) {
                        res.status(500).send('Existence checking failed');
                        console.log(err);
                        return
                    }
                    if(!n) {
                        res.status(404).send(node_id + ' does not exist');
                        return
                    }
                    console.log('origin', n);
                    async.map(n.tags, // n.tags is an array of ids
                        function (tag, map_callback) {
                            Tag.findById(tag,
                                function (err, t) {
                                    if (err) {
                                        console.log(err);
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
                            nodeCommander(n.ips, toEnable, toDisable);
                            if(ips) {
                                nodeCommander(ips, toEnable, toDisable)
                            }
                        }
                    );
                    res.status(200).send('Updated');
                }
            );
        }
    );
});

app.get('/node/:node_id', function(req, res) {
    var node_id = req.params.node_id;
    Node.findById(node_id, function (err, found) {
        if (err) {
            res.status(500).send("Cannot fetch node info");
            console.log(err);
            return
        }
        if(!found) {
            res.status(404).send("Cannot get info about node " + node_id);
            return
        }
        res.setHeader('Content-Type', 'application/json');
        res.send(found);
    }).populate('tags', 'name'); // return only name
});

app.delete('/node/:node_id', function(req, res) {
    var node_id = req.params.node_id;
    Node.findByIdAndRemove(node_id, function (err) {
        if (err) {
            res.status(500).send("Failed to execute delete");
            console.log(err);
            return
        }
        res.send(node_id + " has been deleted.")
    })
});

app.get('/tags', handlePluralGet('tag', Tag, {}, []));

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
    Tag.create({
        name: name,
        monitorItems: monitorItems,
        alarmRules: alarmRules,
        alarmReceiverGroups: alarmReceiverGroups
    },
        function (err, t) {
            if(err) {
                res.status.send('Tag create failed');
                console.log(err);
                return
            }
            res.status(201).send('Tag added');
        }
    )
});

app.get('/tag/:tag_id', function(req, res){
    var tag_id = req.params.tag_id;
    Tag.findById(tag_id, function (err, found) {
        if(err) {
            res.status(500).send("Cannot fetch tag info");
            console.log(err);
            return
        }
        if(!found){
            res.status(404).send("Cannot get info about tag " + tag_id);
            return
        }
        res.setHeader('Content-Type', 'application/json');
        res.send(found);
    })
});

app.put('/tag/:tag_id', function(req, res){
    var tag_id = req.params.tag_id;
    var name = req.body.name,
        monitorItems = req.body.monitorItems,
        alarmRules = req.body.alarmRules,
        alarmReceiverGroups = req.body.alarmReceiverGroups;
    update = {};
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
    Tag.findOneAndUpdate(
        { _id: tag_id },
        { '$set': update },
        function (err, t) {  // t is the original tag record
            if(err) {
                res.status(500).send('Existence checking failed');
                console.log(err);
                return
            }
            if(!t) {
                res.status(404).send(tag_id + ' does not exist');
                return
            }
            if(update.monitorItems) {
                Node.find({tags: t._id},
                    function(err, nodes) {
                        if(err) {
                            console.log('fetching nodes by tag', err);
                        }
                        var nodeAddrs = [];
                        nodes.map(function(n){
                            nodeAddrs.concat(n.ips)
                        });
                        var originalItems = new Set(t.monitorItems),
                            updateItems = new Set(update.monitorItems);
                        var toDisable = originalItems.difference(updateItems),
                            toEnable = updateItems.difference(originalItems);
                        nodeCommander(nodeAddrs, toEnable, toDisable)
                    }
                )
            }
            res.status(200).send('Updated');
        }
    )
});

app.delete('/tag/:tag_id', function(req, res) {
    var tag_id = req.params.tag_id;
    Tag.findByIdAndRemove(tag_id, function (err) {
        if (err) {
            res.status(500).send("Failed to execute delete");
            console.log(err);
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
                        Tag.find({'name': sregx}, {_id: 1}, // only return id
                            function (err, tags) {
                                if (err) {
                                    callback(err, {})
                                }
                                var ids = tags.map(function (tag) {
                                    return tag._id
                                });
                                Node.find({tags: {$in: ids}},
                                    function (err, nodes) {
                                        if (err) {
                                            callback(err, {})
                                        }
                                        callback(null, nodes)
                                    }).populate('tags', 'name');  // return only name of tag
                            })
                    },
                    function (callback) {
                        Node.find({$or:[
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
                        console.log(err);
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
            console.log('resultNodes ', resultNodes);
            console.log('skip limit skip+limit', skip, limit, skip+limit);
            console.log('resultNodes sliced ', resultNodes.slice(skip, skip + limit));
            var returnObject = {
                total: resultNodes.length,
                skip: skip,
                limit: limit,
                node: resultNodes.slice(skip, skip + limit)
            };
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send(returnObject);
        }
    );
};

var queryTag = function(req, res) {
    var query = req.query.tag;
    var sregx = new RegExp(query.trim(), 'i');
    handlePluralGet('tag', Tag, {name: sregx}, [])(req, res);
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