var mongoose = require('mongoose');

var config = require('./config.js');

var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var tagSchema = new Schema({
        name: String,
        monitorItems: [String],
        alarmRule: String,  // js code running in sandbox
        evaluationErrors: [String],
        periodicJob: String, // js code running in sandbox
        alarmReceivers: [String]
    },
    {
        collection: "Tag"
    }
);
var Tag = mongoose.model('Tag', tagSchema);

var states = ['Good', 'Warning', 'Error'];
var graphInfo = new Schema({
    user: {type: Schema.Types.ObjectId, ref: 'User'},
    graphs: [{type: Schema.Types.ObjectId, ref: 'Graph'}]
});
var nodeSchema = new Schema({
        name: String,
        description: String,
        ips: [String],
        tags: [{type: Schema.Types.ObjectId, ref: 'Tag'}],
        region: {type: Schema.Types.ObjectId, ref: 'Region'},
        idc: {type: Schema.Types.ObjectId, ref: 'Idc'},
        project: {type: Schema.Types.ObjectId, ref: 'Project'},
        graphInfo: [graphInfo],
        metricIdentifier: String,
        tsdbUrl: String,
        // For judge module
        state: {type: String, enum: states},
        alarms: [{type: Schema.Types.ObjectId, ref: 'Alarm'}],
        alarmHistory: [{type: Schema.Types.ObjectId, ref: 'Alarm'}],
        judgeEnabled: Boolean,
        ignoredAlarms: [String]
    },
    {
        collection: "Node"
    }
);
// `Node` represents a monitored system, a machine for example.
var Node = mongoose.model('Node', nodeSchema);

var alarmSchema = new Schema({
    timestamp: Date,
    message: String,
    ttl: Number,
    tag: {type: Schema.Types.ObjectId, ref: 'Tag'}
},
    {
        collection: 'Alarm'
    }
);
var Alarm = mongoose.model('Alarm', alarmSchema);

var roles = ['Root', 'Leader', 'User'];
var userSchema = new Schema({
        name: String,
        showName: String,
        panels: [{type: Schema.Types.ObjectId, ref: 'Panel'}],
        graphColumnNumber: Number,
        graphRefreshInterval: Number,  // In seconds, 0 for "don't refresh"
        role: {type: String, enum: roles},
        projects: [{type: Schema.Types.ObjectId, ref: 'Project'}]
    },
    {
        collection: "User"
    }
);
var User = mongoose.model('User', userSchema);

var panelSchema = new Schema({
    name: String,
    graphs: [{type: Schema.Types.ObjectId, ref: 'Graph'}],
    owner: {type: Schema.Types.ObjectId, ref: 'User'}  // because panel is shared by reference,
                                                       // only owner can modify the panel
}, {
    collection: 'Panel'
});
var Panel = mongoose.model('Panel', panelSchema);

var graphSchema = new Schema({
        ips: [String],
        metrics: [String],
        title: String
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
    Alarm: Alarm,
    User: User,
    Panel: Panel,
    Graph: Graph,
    Region: Region,
    Idc: Idc,
    Project: Project
};
