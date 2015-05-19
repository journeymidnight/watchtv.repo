
var fs = require('fs');
var path = require('path');
var express = require('express');
var bodyParser = require('body-parser');
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
                console.log(err)
                return
            }
            console.log(nodes)
            res.setHeader('Content-Type', 'application/json');
            res.send(nodes);
        })
});

var async = require('async');

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