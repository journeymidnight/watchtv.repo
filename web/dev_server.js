
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
  console.log('Server started: http://localhost:' + app.get('port') + '/');
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
    ip: String,
    tags: [{type: Schema.Types.ObjectId, ref: 'Tag'}]
},
    {
        collection: "Node"
    }
);

var Tag = mongoose.model('Tag', tagSchema);
// `Node` represents a monitored system, a machine for example.
var Node = mongoose.model('Node', nodeSchema);

app.get('/nodes', function(req, res) {
    Node.find({})
        .skip(0)
        .limit(20)
        .populate('tags', 'name')  // return only name
        .exec(function (err, nodes) {
            if (err) {
                res.status(500).send("Cannot fetch node list");
                console.log(err);
                return
            }
            res.setHeader('Content-Type', 'application/json');
            res.send(nodes);
        })
});

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
        ip = req.body.ip,
        tags = req.body.tags;
    if (!ip) {
        res.status(400).send("IP address is required for adding new nodes");
        return
    }
    if (!isIPandPort(ip)) {
        res.status(400).send('Invalid IP address');
        return
    }
    if (!name) name = '';
    if (!nickname) nickname = '';
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
                    ip: ip,
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
                nodeCommander([ip], monitorItems.entries(), []);
            }
        })
});


app.put('/node/:node_id', function (req, res) {
    var node_id = req.params.node_id;
    var name = req.body.name,
        nickname = req.body.nickname,
        ip = req.body.ip,
        tags = req.body.tags;

    var update = {};
    if (ip && !isIPandPort(ip)) {
        res.status(400).send('Invalid IP address');
        return
    }
    if (name) update.name = name;
    if (nickname) update.nickname = nickname;
    if (ip) update.ip = ip;
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
                            nodeCommander([n.ip], toEnable, toDisable)
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

app.get('/tags', function(req, res) {
    Tag.find({})
       .skip(0)
       .limit(100)
       .exec(function (err, tags) {
            if(err){
                res.status(500).send("Cannot fetch tag list");
                console.log(err);
                return
            }
            res.setHeader('Content-Type', 'application/json');
            res.send(tags);
        })
});

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
                        var nodeAddrs = nodes.map(function(n){
                            return n.ip
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

var queryNode = function(query, res) {
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
                            {ip: sregx}
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
            var ret = [];
            for (var k in ans) {
                ret.push(ans[k])
            }
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send(ret)
        }
    );
};

var queryTag = function(query, res) {
    var sregx = new RegExp(query.trim(), 'i');
    Tag.find({name:sregx})
        .exec(function(err, tags) {
            if(err) {
                console.log(err);
                res.status(500).send("Cannot complete your query");
                return
            }
            res.setHeader('Content-Type', 'application/json');
            res.send(tags)
        })
};

// For "Find anything"
app.get('/q', function(req, res){
    if(req.query.node != undefined) {
        // /q?node=xxx
        queryNode(req.query.node, res);
        return
    } else if (req.query.tag != undefined) {
        // /q?tag=xxx
        queryTag(req.query.tag, res);
        return
    } else {
        res.status(400).send("Invalid query");
        return
    }
});