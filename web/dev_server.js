
var fs = require('fs');
var path = require('path');
var express = require('express');
var bodyParser = require('body-parser');
var validator = require('validator');
var async = require('async');
var app = express();

app.set('port', (process.env.PORT || 3000));

app.use('/', express.static(path.join(__dirname, './')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.get('/mock_node_list', function(req, res) {
  fs.readFile('mock_node_list.json', function(err, data) {
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
  });
});

app.post('/comments.json', function(req, res) {
  fs.readFile('comments.json', function(err, data) {
    var comments = JSON.parse(data);
    comments.push(req.body);
    fs.writeFile('comments.json', JSON.stringify(comments, null, 4), function(err) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(JSON.stringify(comments));
    });
  });
});


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
            console.log(nodes);
            res.setHeader('Content-Type', 'application/json');
            res.send(nodes);
        })
});

app.post('/nodes', function(req, res) {
    var name = req.body.name,
        nickname = req.body.nickname,
        ip = req.body.ip,
        tags = req.body.tags;
    if (!ip) {
        res.status(400).send("IP address is required for adding new nodes");
        return
    }
    if (!validator.isIP(ip)) {
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
    async.map(tags, function (tag, map_callback) {
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
            tags = results.filter(
                function (t) {
                    if (t) return true;
                    else return false;
                }
            );
            console.log(tags);
            Node.create({
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
                });
        })
});


app.put('/node/:node_id', function (req, res) {
    var node_id = req.params.node_id;
    var name = req.body.name,
        nickname = req.body.nickname,
        ip = req.body.ip,
        tags = req.body.tags;

    var update = {};
    if (ip && !validator.isIP(ip)) {
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
    async.map(tags, function(tag, map_callback){
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
            update.tags = results.filter(
                function (t) {
                    if (t) return true;
                    else return false;
                }
            );
            console.log(update);
            Node.findOneAndUpdate(
                { _id: node_id },
                { '$set': update },
                function (err, n) {
                    if(err) {
                        res.status(500).send('Existence checking failed');
                        console.log(err);
                        return
                    }
                    if(!n) {
                        res.status(404).send(node_id + ' does not exist');
                        return
                    }
                    res.status(200).send('Updated');
                }
            )
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
        function (err, t) {
            if(err) {
                res.status(500).send('Existence checking failed');
                console.log(err);
                return
            }
            if(!t) {
                res.status(404).send(tag_id + ' does not exist');
                return
            }
            res.status(200).send('Updated');
        }
    )
});

// For "Find anything"
app.get('/q', function(req, res){
    // /q?node=xxx
    if (req.query.node == undefined){
        res.status(400).send("Invalid query")
        return
    }
    async.map(
        req.query.node.split(' '),
        function(s, map_callback){
            var sregx = new RegExp(s, 'i');
            async.parallel([
                function (callback) {
                    Tag.find({'name': sregx}, {_id: 1},
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
                                    console.log('tags return:', nodes);
                                    callback(null, nodes)
                                }).populate('tags', 'name')  // return only name
                        })
                },
                function (callback) {
                    Node.find({$or:[
                        {name: sregx},
                        {nickname: sregx},
                        {ip: sregx}
                    ]}, function (err, nodes) {
                        callback(err, nodes)
                    }).populate('tags', 'name')  // return only name
                }
            ],
            function(err, r){
                if(err){
                    console.log(err);
                    res.status(500).send("Cannot complete your finding query");
                    return
                }
                var uniq_nodes = {};
                r.map(function(nodes){
                    nodes.map(function (node) {
                        uniq_nodes[node._id] = node
                    })
                });
                console.log('uniq nodes', uniq_nodes);
                map_callback(null, uniq_nodes)
            })
        },
        function(err, results) {
            console.log('results', results)
            var ans = results.reduce(
                function(pre, curr, index, array){
                    console.log('array', array);
                    if(pre == null){
                        return curr
                    } else {
                        var ans = {};
                        // intersection of pre and curr
                        for (p in pre) {
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
            for (k in ans) {
                ret.push(ans[k])
            }
            console.log('ret', ret);
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send(ret)
        }
    );
});