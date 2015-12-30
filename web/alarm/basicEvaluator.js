'use strict';

var events = require('events');

var cache = require('../cache.js');
var config = require('../config.js');
var logger = require('../logger.js').getLogger('Basic Evaluator');

process.title = 'node - WatchTV - Basic Evaluator';

var emitter = new events.EventEmitter();

process.on('message', function (message) {
    if(message['event']) {
        // Date type becomes string after pipe, so rebuild it
        message.event.timestamp = new Date(message.event.timestamp);
        emitter.emit(message.event.name, message.event);
    }
});

var alarm = function (event, alarmMessage, ttl, alarmName) {
    process.send({alarm: {
        name: alarmName,
        nodeID: event.nodeID,
        timestamp: new Date(),
        message: alarmMessage,
        ttl: ttl * 1000,
        tagID: null
    }})
};

emitter.on('uptime.uptime_Sec', function(event) {
    if(event.payload < 60 * 15) {
        alarm(event, 'Node seems to have been rebooted', 600, 'rebooted');
    }
});

emitter.on('diskspace.free_byte_percent', function(event) {
    if(event.payload < 10) {
        alarm(event, 'Free space of ' + event.device + ' < 10%', 120,
            'lowFreeDiskSpace.' + event.device);
    }
});

emitter.on('diamond.liveness', function(event) {
    if(event.payload === 'dead') {
        alarm(event, 'Diamond is dead', 600, 'deadDiamond');
    }
});

var _5min = 5 * 60 * 1000;

var cpus = {};
var iowait = {};
emitter.on('cpu.iowait_percent', function(event) {
    // maintain CPU count for load average evaluation
    if(cpus[event.nodeID] == undefined) {
        cpus[event.nodeID] = [];
    }
    if(cpus[event.nodeID].indexOf(event.device) === -1) {
        cpus[event.nodeID].push(event.device);
    }
    // evaluate IO wait metrics
    if(event.device !== 'total') return;
    if(iowait[event.nodeID] == null) iowait[event.nodeID] = [];
    iowait[event.nodeID].push(event);
    var now = new Date();
    iowait[event.nodeID] = iowait[event.nodeID].filter(function(event) {
        return now - event.timestamp < _5min;
    });
    if(iowait.length < 3) return;
    if(iowait[event.nodeID].every(function(event) {
            return event.payload > 50;
        })) {
        alarm(event, 'IO wait > 50%', 120, 'highIOWait');
    }
});

emitter.on('loadavg.15', function(event) {
    var cpuCount = 5;
    if(cpus[event.nodeID] && cpus[event.nodeID].length - 1 > 5) {
        cpuCount = cpus[event.nodeID].length - 1; // minus 1 for `total` device
    }
    if(event.payload >= cpuCount) {
        alarm(event, 'Load average is greater than total CPU number', 120, 'highLoad');
    }
});

// io[nodeID][device] = [event5minAgo, ..., latestEvent]
var io = {};
emitter.on('iostat.util_percent', function(event) {
    if(io[event.nodeID] == null) io[event.nodeID] = {};
    if(io[event.nodeID][event.device] == null) io[event.nodeID][event.device] = [];
    io[event.nodeID][event.device].push(event);
    var now = new Date();
    io[event.nodeID][event.device] = io[event.nodeID][event.device].filter(function(event) {
        return now - event.timestamp < _5min;
    });

    if(io[event.nodeID][event.device].length < 3) return;

    if(io[event.nodeID][event.device].every(function(event) {
            return event.payload > 80;
        })) {
        alarm(event, 'IO utility percent for ' + event.device + ' > 80%', 120,
            'highIOUtility.' + event.device);
    }
});

var memoryTotal = {};
emitter.on('memory.MemTotal_byte', function(event) {
    memoryTotal[event.nodeID] = event.payload;
});

var _512M = 512 * 1024 * 1024;
emitter.on('memory.Cached_byte', function(event) {
    if(memoryTotal[event.nodeID] &&
        memoryTotal[event.nodeID] - event.payload < _512M ) {
        alarm(event, 'memoryTotal - memoryCached < 512M', 120, 'lowMemory');
    }
});
