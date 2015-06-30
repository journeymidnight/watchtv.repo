var mongoose = require('mongoose');

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


mongoose.connect('mongodb://watchtv:watchtv@localhost:27017/watchtv');

module.exports = {
    Tag: Tag,
    Node: Node
};