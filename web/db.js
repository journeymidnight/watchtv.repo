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
        region: {type: Schema.Types.ObjectId, ref: 'Region'},
        idc: {type: Schema.Types.ObjectId, ref: 'Idc'},
        project: {type: Schema.Types.ObjectId, ref: 'Project'},
        graphInfo: [{
            user: {type: Schema.Types.ObjectId, ref: 'User'},
            graphs: [{type: Schema.Types.ObjectId, ref: 'Graph'}]
        }],
        // For judge module
        state: {type: String, enum: states},
        failedRules: [String]
    },
    {
        collection: "Node"
    }
);
// `Node` represents a monitored system, a machine for example.
var Node = mongoose.model('Node', nodeSchema);


var roles = ['Root', 'Leader', 'User'];
var userSchema = new Schema({
        name: String,
        graphs: [{type: Schema.Types.ObjectId, ref: 'Graph'}],
        role: {type: String, enum: roles},
        projects: [{type: Schema.Types.ObjectId, ref: 'Project'}]
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

var regionSchema = new Schema({
        name: String
    },
    {
        collection: "Region"
    }
);
var Region = mongoose.model('Region', regionSchema);

var idcSchema = new Schema({
        name: String
    },
    {
        collection: "Idc"
    }
);
var Idc = mongoose.model("Idc", idcSchema);

var projectSchema = new Schema({
        name: String,
        leader: {type: Schema.Types.ObjectId, ref: 'User'}
    },
    {
        collection: "Project"
    }
);
var Project = mongoose.model("Project", projectSchema);


mongoose.connect(config.db.mongodbURL);

module.exports = {
    Tag: Tag,
    Node: Node,
    User: User,
    Graph: Graph,
    Region: Region,
    Idc: Idc,
    Project: Project
};
