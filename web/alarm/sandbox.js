'use strict';

var events = require('events');
var vm = require('vm');

var cache = require('../cache.js');
var config = require('../config.js');
var logger = require('../logger.js').getLogger('Sandbox');

process.title = 'node - WatchTV - Sandbox';

var emitter = new events.EventEmitter();
var tag = null;

var alarm = function (event, alarmMessage, ttl) {
    process.send({alarm: {
        nodeID: event.nodeID,
        timestamp: new Date(),
        message: alarmMessage,
        ttl: ttl * 1000,
        tagID: tag._id
    }})
};

var on = function (event, callback) {
    emitter.on(event, callback);
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

var sandboxCache = new cache.Cache(60 * 60 * 1000);

var put = function(key, value, ttl) {
    sandboxCache.put(key, value, ttl);
};

var get = function (key) {
    return sandboxCache.get(key);
};

var sandbox = {
    alarm: alarm,
    on: on,
    sum: sum,
    avg: avg,
    max: max,
    min: min,
    put: put,
    get: get
};

var evaluation = function () {
    var context = new vm.createContext(sandbox);
    try {
        var script = new vm.Script(tag.alarmRule);
    } catch (err) {
        process.send({error: {
            type: 'syntaxError',
            message: 'Alarm Rule: ' + err.toString(),
            tagID: tag._id
        }});
        process.exit(1);
    }
    try {
        script.runInContext(context, {timeout: config.sandbox.timeout});
    } catch (err) {
        process.send({error: {
            type: 'runtimeError',
            message: 'Alarm Rule: ' + err.toString(),
            tagID: tag._id
        }});
        process.exit(1);
    }
};

process.on('message', function (message) {
    if(message['event']) {
        // Date type becomes string after pipe, so rebuild it
        message.event.timestamp = new Date(message.event.timestamp);
        emitter.emit(message.event.name, message.event);
    } else if(message['tag']) {
        tag = message.tag;
        evaluation();
    }
});

