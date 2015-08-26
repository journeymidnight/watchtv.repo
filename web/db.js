var mongoose = require('mongoose');

var config = require('./config.js');

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

var Tag = mongoose.model('Tag', tagSchema);


var states = ['Good', 'Warning', 'Error'];
var nodeSchema = new Schema({
        nickname: String,
        name: String,
        description: String,
        ips: [String],
        tags: [{type: Schema.Types.ObjectId, ref: 'Tag'}],
        graphInfo: [{
            user: {type: Schema.Types.ObjectId, ref: 'User'},
            graphs: [{type: Schema.Types.ObjectId, ref: 'Graph'}]
        }],
        state: {type: String, enum: states},
        failedRules: [String]
    },
    {
        collection: "Node"
    }
);

// `Node` represents a monitored system, a machine for example.
var Node = mongoose.model('Node', nodeSchema);


var roles = ['Root', 'User'];
var userSchema = new Schema({
        name: String,
        graphs: [{type: Schema.Types.ObjectId, ref: 'Graph'}],
        tags: [{type: Schema.Types.ObjectId, ref: 'Tag'}],
        role: {type: String, enum: roles}
    },
    {
        collection: "User"
    }
);

var User = mongoose.model('User', userSchema);

var graphSchema = new Schema({
        ips: [String],
        metrics: [String],
        time: Number  // in sec, how long period of graph to show
    },
    {
        collection: "Graph"
    }
);

var Graph = mongoose.model('Graph', graphSchema);

mongoose.connect(config.db.mongodbURL);

module.exports = {
    Tag: Tag,
    Node: Node,
    User: User,
    Graph: Graph
};