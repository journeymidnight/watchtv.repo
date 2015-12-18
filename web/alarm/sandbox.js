'use strict';

var events = require('events');
var vm = require('vm');

var config = require('../config.js');
var logger = require('../logger.js').getLogger('Sandbox');

process.title = 'node - WatchTV - Sandbox';

var emitter = new events.EventEmitter();
var tag = null;

var alarm = function (event, alarmMessage, alarmLevel) {
    process.send({alarm: {
        nodeID: event.nodeID,
        timestamp: new Date(),
        message: alarmMessage,
        ttl: alarmLevel * 10 * 1000,
        tagID: tag._id,
        level: alarmLevel
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

var sandbox = {
    alarm: alarm,
    on: on,
    sum: sum,
    avg: avg,
    max: max,
    min: min
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
    }
};

process.on('message', function (message) {
    if(message['event']) {
        //console.log('EVENT', message.event);
        emitter.emit(message.event.name, message.event);
    } else if(message['tag']) {
        console.log('TAG', message.tag);
        tag = message.tag;
        evaluation();
    }
});

