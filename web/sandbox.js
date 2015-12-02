var vm = require('vm');

var config = require('./config.js');

var alarmRules = [], nodes = [];

var alarm = function (nodeID, alarmMessage) {
    process.send({alarm: {
        ip: nodes[nodeID].ip,
        message: alarmMessage
    }})
};

var sandbox = {
    alarm: alarm,
    x: 0
};

var evaluation = function () {
    if(alarmRules.length === 0 || nodes.length === 0) return;

    console.log(alarmRules, nodes);
    sandbox.nodes = nodes.map(function(node, index) {
        node.id = index;
        return node.metrics;
    });
    var context = new vm.createContext(sandbox);
    var scripts = alarmRules.map(function(rule){
        return new vm.Script(rule);
    });
    scripts.map(function(script) {
        script.runInContext(context);
    });
    console.log('sandbox after evaluation:', sandbox);
    process.exit(0);
};

process.on('message', function (message) {
    if(message['nodes']) {
        nodes = message['nodes'];
    } else if(message['rules']) {
        alarmRules = message['rules'];
    }
    evaluation();
});