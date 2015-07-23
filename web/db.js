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
        state: {type: String, enum: states},
        failedRules: [String]
    },
    {
        collection: "Node"
    }
);

// `Node` represents a monitored system, a machine for example.
var Node = mongoose.model('Node', nodeSchema);


var userSchema = new Schema({
        name: String,
        dashboards: [{
            node: {type: Schema.Types.ObjectId, ref: 'Node'},
            metric: String,  // comma separated metric name, e.g. "ceph,read_Bps"
            time: String
        }],
        tags: [{type: Schema.Types.ObjectId, ref: 'Tag'}]
    },
    {
        collection: "User"
    }
);

var User = mongoose.model('User', userSchema);

mongoose.connect(config.db.mongodbURL);

module.exports = {
    Tag: Tag,
    Node: Node,
    User: User
};