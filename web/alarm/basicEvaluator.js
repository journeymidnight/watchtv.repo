'use strict';

var events = require('events');

var cache = require('../cache.js');
var config = require('../config.js');
var logger = require('../logger.js').getLogger('Basic Evaluator');

process.title = 'node - WatchTV - Basic Evaluator';

var emitter = new events.EventEmitter();

process.on('message', function (message) {
    if(message['event']) {
        console.log('EVENT', message.event);
        emitter.emit(message.event.name, message.event);
    }
});

var alarm = function (event, alarmMessage, alarmLevel) {
    process.send({alarm: {
        nodeID: event.nodeID,
        timestamp: new Date(),
        message: alarmMessage,
        ttl: alarmLevel * 10 * 1000,
        tagID: null,
        level: alarmLevel
    }})
};

emitter.on('uptime.uptime_Sec', function(event) {
    if(event.payload < 60 * 15) {
        alarm(event, 'Node seems to have been rebooted', 20);
    }
});

emitter.on('diskspace.free_byte_percent', function(event) {
    if(event.payload < 10) {
        alarm(event, 'Free space of ' + event.device + ' < 10%', 20);
    }
});

var swapTotal = new cache.Cache(10 * 60 * 1000);
emitter.on('memory.SwapTotal_byte', function(event) {
    swapTotal.put(event.nodeID, event.payload);
});
emitter.on('memory.SwapFree_byte', function(event) {
    var swapTotal = swapTotal.get(event.nodeID);
    if(swapTotal === null) return;
    if(event.payload / swapTotal < 0.1) {
        alarm(event, 'Free swap < 10%', 20);
    }
});