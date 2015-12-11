var vm = require('vm');

var config = require('./config.js');
var logger = require('./logger.js').getLogger('Sandbox');

process.title = 'node - WatchTV Sandbox';

var alarmRules = [], nodes = [], receivers = [];

var alarm = function (nodeIndex, alarmMessage) {
    process.send({alarm: {
        ip: nodes[nodeIndex].ip,
        id: nodes[nodeIndex].id,
        tagID: nodes[nodeIndex].tagID,
        message: alarmMessage,
        receivers: receivers
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

// Check if measurement data are ready
// e.g. ready(node.loadavg)
var ready = function (measure) {
    if(measure == null) return false;

    if(measure.constructor === Array) {
        for(var i = 0; i < measure.length; i++) {
            if(measure[i] == undefined) return false;
        }
        return true;
    } else if(measure.constructor === Object) {
        var objectKeys = Object.keys(measure);
        if(objectKeys.length === 0) return false; // `{}`, empty object
        if(objectKeys.length === 1
            && objectKeys[0] === 'id') return false; // `{id: xx}`, also "empty"
        for(var m in measure) {
            if(!measure.hasOwnProperty(m)) continue;
            if(m === 'id') continue;  // for special case `id: xx`
            if(ready(measure[m]) === false) return false;
        }
        return true;
    }
    return false;
};

var pingPort = function (nodeIndex, portNumber, alarmMessage) {
    process.send({pingPort:{
        ip: nodes[nodeIndex].ip,
        id: nodes[nodeIndex].id,
        tagID: nodes[nodeIndex].tagID,
        port: portNumber,
        alarmMessage: alarmMessage,
        receivers: receivers
    }});
};

var sandbox = {
    alarm: alarm,
    sum: sum,
    avg: avg,
    max: max,
    min: min,
    ready: ready,
    pingPort: pingPort
};

var removeMetricCount = function(metrics) {
    for(var key in metrics) {
        if(!metrics.hasOwnProperty(key)) continue;

        if(metrics[key].constructor === Array) {
            metrics[key] = metrics[key].slice(0, metrics[key].length-1);
        } else {
            removeMetricCount(metrics[key]);
        }
    }
};

var evaluateUptime = function(nodes) {
    nodes.map(function(node, index) {
        if(!ready(node.uptime)) return;

        var n = node.uptime.uptime_sec;
        if(n[n.length - 1] < 60 * 15) {
            alarm(index, 'Node seems to have been rebooted');
        }
    })
};

var evaluateDiskUsage = function(nodes) {
    nodes.map(function(node, index) {
        if(!ready(node.diskspace)) return;

        var n = node['diskspace']['free_byte_percent'];
        for(var disk in n) {
            if(!n.hasOwnProperty(disk)) continue;

            if(n[disk][0] < 10) {
                alarm(index, 'Free space of ' + disk + ' < 10%');
            }
        }
    })
};

var evaluateSwapUsage = function(nodes) {
    nodes.map(function(node, index) {
        if (!ready(node.memory)) return;

        var n = node['memory'];
        if(n['SwapFree_byte'][0] / n['SwapTotal_byte'][0] < 0.1) {
            alarm(index, 'Free swap < 10%');
        }
    })
};

var evaluation = function () {
    if(alarmRules.length === 0 ||
        nodes.length === 0 ||
        receivers.length === 0) return;

    sandbox.nodes = nodes.map(function(node, index) {
        removeMetricCount(node.metrics);
        var n = node.metrics;
        n.id = index;
        return n;
    });

    // Basic alarms
    evaluateUptime(sandbox.nodes);
    evaluateDiskUsage(sandbox.nodes);
    evaluateSwapUsage(sandbox.nodes);

    // Tag based alarms
    var context = new vm.createContext(sandbox);
    var scripts = alarmRules.map(function(rule){
        try {
            var script = new vm.Script(rule);
        } catch (err) {
            process.send({syntaxError: {
                message: err.toString(),
                // tagIDs inside a single sandbox are the same, kind of a hack
                tagID: nodes[0].tagID
            }});
            process.exit(1);
        }
        return script;
    });
    try {
        scripts.map(function(script) {
            script.runInContext(context, {timeout: config.judge.sandboxTimeout});
        });
    } catch (err) {
        process.send({runtimeError: {
            message: err.toString(),
            tagID: nodes[0].tagID
        }});
    }
    process.exit(0);
};

process.on('message', function (message) {
    if(message['nodes']) {
        nodes = message['nodes'];
    } else if(message['rules']) {
        alarmRules = message['rules'];
    } else if(message['receivers']) {
        receivers = message['receivers'];
    }
    evaluation();
});

// Stop this sandbox anyway after 5min
setTimeout(function() {
    logger('Killing sandbox:', process.pid);
    process.exit(0);
}, 5 * 60 * 1000);