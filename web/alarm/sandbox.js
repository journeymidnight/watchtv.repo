'use strict';

var events = require('events');
var vm = require('vm');

var cache = require('../cache.js');
var config = require('../config.js');
var logger = require('../logger.js').getLogger('Sandbox');

process.title = 'node - WatchTV - Sandbox';

var emitter = new events.EventEmitter();
var tag = null;
var eventHandlers = [];

var EventHandler = function(eventName, checkFunction) {
    this.eventName = eventName;
    this.checkFunction = checkFunction;
    this.interval = null;
    this.times = null;
    this.message = null;
    var that = this;
    this.overPast = function(interval) {
        that.interval = interval; // in sec
        return that;
    };
    this.forMoreThan = function(nTimes) {
        that.times = nTimes;
        return that;
    };
    this.withMessage = function(message) {
        that.message = message;
        return that;
    };
};

var alarm = function (event, alarmMessage, ttl) {
    process.send({alarm: {
        nodeID: event.nodeID,
        timestamp: new Date(),
        message: alarmMessage,
        ttl: ttl * 1000,
        tagID: tag._id
    }})
};

var on = function (eventName, callback) {
    if(eventName.constructor === Array) {
        var buffers = new Array(eventName.length - 1);
        for (let i = 0; i < eventName.length - 1; i++) {
            buffers[i] = {};
            emitter.on(eventName[i], function(event) {
                buffers[i][event.nodeID] = event;
            });
        }
        emitter.on(eventName[eventName.length - 1], function(event) {
            var events = [];
            var now = new Date();
            for (let i = 0; i < eventName.length - 1; i++) {
                if(buffers[i][event.nodeID] &&
                    now - buffers[i][event.nodeID].timestamp < 5*60*1000) {
                    events.push(buffers[i][event.nodeID]);
                } else {
                    return;
                }
            }
            events.push(event);
            callback(events);
        });
    } else {
        emitter.on(eventName, callback);
    }
};

var check = function(eventName, checkFunction) {
    var eventHandler = new EventHandler(eventName, checkFunction);
    eventHandlers.push(eventHandler);
    return eventHandler;
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
    sandboxCache.put(key, value, 1000 * ttl);
};

var get = function (key) {
    return sandboxCache.get(key);
};

var sandbox = {
    alarm: alarm,
    on: on,
    check: check,
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
    eventHandlers.map(function(eventHandler) {
        if(eventHandler.interval === null || eventHandler.times === null
            || eventHandler.message === null) {
            return;
        }
        emitter.on(eventHandler.eventName, function(event) {
            try {
                var checkResult = eventHandler.checkFunction(event);
            } catch (err) {
                process.send({error: {
                    type: 'runtimeError',
                    message: 'Alarm Rule: ' + err.toString(),
                    tagID: tag._id
                }});
                return;
            }
            if(checkResult === true) {
                var past = get(event.nodeID + eventHandler.eventName);
                var timestamps = [];
                if(past !== null) {
                    var now = new Date();
                    timestamps = past.filter(function(pastTimestamp) {
                        return now - pastTimestamp < eventHandler.interval * 1000;
                    });
                    if(timestamps.length + 1 >= eventHandler.times) {
                        alarm(event, eventHandler.message, eventHandler.interval);
                    }
                }
                timestamps.push(event.timestamp);
                put(event.nodeID + eventHandler.eventName, timestamps);
            }
        })
    });
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

