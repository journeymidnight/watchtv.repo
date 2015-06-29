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

// `Node` represents a monitored system, a machine for example.
var Node = mongoose.model('Node', nodeSchema);


var stateSchema = new Schema({
        nodeId: {type: Schema.Types.ObjectId, ref: 'Node'},
        failedRules: [String],
        state: String
    },
    {
        collection: "State"
    }
);

var State = mongoose.model('State', stateSchema);


module.exports = {
    Tag: Tag,
    Node: Node,
    State: State
};