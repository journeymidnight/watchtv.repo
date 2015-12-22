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

var alarm = function (event, alarmMessage, ttl) {
    process.send({alarm: {
        nodeID: event.nodeID,
        timestamp: new Date(),
        message: alarmMessage,
        ttl: ttl * 1000,
        tagID: null
    }})
};

emitter.on('uptime.uptime_Sec', function(event) {
    if(event.payload < 60 * 15) {
        alarm(event, 'Node seems to have been rebooted', 120);
    }
});

emitter.on('diskspace.free_byte_percent', function(event) {
    if(event.payload < 10) {
        alarm(event, 'Free space of ' + event.device + ' < 10%', 120);
    }
});

var swapTotal = new cache.Cache(10 * 60 * 1000);
emitter.on('memory.SwapTotal_byte', function(event) {
    swapTotal.put(event.nodeID, event.payload);
});
emitter.on('memory.SwapFree_byte', function(event) {
    var total = swapTotal.get(event.nodeID);
    if(total === null) return;
    if(event.payload / total < 0.1) {
        alarm(event, 'Free swap < 10%', 120);
    }
});

emitter.on('diamond.liveness', function(event) {
    if(event.payload === 'dead') {
        alarm(event, 'Diamond is dead', 600);
    }
});
