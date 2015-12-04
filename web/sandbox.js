var vm = require('vm');
var net = require('net');

var config = require('./config.js');

var alarmRules = [], nodes = [];

var alarm = function (nodeID, alarmMessage) {
    process.send({alarm: {
        ip: nodes[nodeID].ip,
        message: alarmMessage
    }})
};

var sum = function (list) {
    return list.reduce(function (previous, current) {
        return previous + current;
    }, 0);
};

var avg = function (list) {
    return sum(list) / list.length;
};

var max = function (list) {
    return list.reduce(function (previous, current) {
        if(previous > current) return previous;
        else return current;
    }, -Infinity)
};

var min = function (list) {
    return list.reduce(function (previous, current) {
        if(previous < current) return previous;
        else return current;
    }, Infinity)
};

var pingPort = function (nodeID, portNumber, callback) {
    var s = new net.Socket();
    var timeout = setTimeout(function(){
        s.destroy();
        callback();
    }, 1000);
    s.connect({
        host: nodes[nodeID].ip,
        port: portNumber
    }).on('connect', function() {
        clearTimeout(timeout);
    }).on('error', function() {return});
};

var sandbox = {
    alarm: alarm,
    sum: sum,
    avg: avg,
    max: max,
    min: min,
    pingPort: pingPort
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
    try {
        scripts.map(function(script) {
            script.runInContext(context, {timeout: config.judge.sandboxTimeout});
        });
    } catch (err) {
        process.send({error: err.toString()});
    }
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