"use strict";

var child_process = require('child_process');
var path = require('path');

var db = require('../db.js');
var config = require('../config.js');
var logger = require('../logger.js').getLogger('Judge');
var cache = require('../cache.js');

process.title = 'node - WatchTV - Judge';

var emailProcess = child_process.fork(path.join(__dirname, 'email.js'));
var basicEvaluator = child_process.fork(path.join(__dirname, 'basicEvaluator.js'));

// tagID -> {
//  alarmRule,
//  process
// }
var processes = {};
// dotted IP address -> {
//  tags: [tag id],
//  nodeID: xxx
// }
// TTL is 2 * update interval
// Also controls which nodes to alarm.
var ip2node = new cache.Cache(2 * config.judge.ruleUpdateInterval);

var emitEventToProcess = function(event) {
    var node = ip2node.get(event.ip);
    if(node === null) return;
    node.tags.map(function(tag) {
        if(processes[tag] == undefined) return;
        processes[tag].process.send({event: event});
    });
    basicEvaluator.send({event: event});
};

// alarmQueue[nodeID][tagID] = [alarm object], used to aggregate messages
var alarmQueue = {};
// nodes[nodeID] = node
var nodes = {};
var queueAlarm = function(alarm, node) {
    if(alarmQueue[alarm.nodeID] == null) alarmQueue[alarm.nodeID] = {};
    if(alarmQueue[alarm.nodeID][alarm.tagID] == null) alarmQueue[alarm.nodeID][alarm.tagID] = [];
    alarmQueue[alarm.nodeID][alarm.tagID].push(alarm);
    nodes[alarm.nodeID] = node;
};

var ring = function() {
    for(let nodeID in alarmQueue) {
        if(!alarmQueue.hasOwnProperty(nodeID)) continue;

        let nodeAlarms = alarmQueue[nodeID];
        let node = nodes[nodeID];

        for(let tagID in nodeAlarms) {
            if(!nodeAlarms.hasOwnProperty(tagID)) continue;
            if(nodeAlarms[tagID].length === 0) continue;

            var fetchReceivers;
            if(tagID !== 'null') {
                fetchReceivers = new Promise(function(resolve, reject) {
                    db.Tag.findById(tagID, function(err, tag) {
                        if(err) return reject(err);
                        resolve(tag.alarmReceivers.join(','));
                    })
                });
            } else {
                fetchReceivers = new Promise(function(resolve, reject) {
                    db.Node.findById(nodeID, function(err, node) {
                        if(err) return reject(err);
                        db.Project.findById(node.project, function(err, project) {
                            if(err) return reject(err);
                            if(project.leader) {
                                resolve(project.leader.name + '@le.com');
                                return;
                            }
                            resolve(config.judge.lastContact || 'zhangcan@le.com');
                        }).populate('leader', 'name');
                    })
                });
            }

            let content = 'Name: ' + node.name + ' Region: ' + node.region.name +
                ' IDC: ' + node.idc.name + ' Project: ' + node.project.name + '\r\n';
            content += 'IP(s): ' + node.ips.join(',') + '\r\n';
            nodeAlarms[tagID].map(function(alarm) {
                content += 'Time: ' + alarm.timestamp.toString() + '\r\n';
                content += alarm.message + '\r\n';
            });
            nodeAlarms[tagID] = [];

            fetchReceivers.then(function(receivers) {
                    emailProcess.send({
                        content: content,
                        to: receivers,
                        subject: 'Alarm from ' + node.name
                    });
                })
                .catch(function(error){
                    logger('Raise alarm failed:', error);
                });
        }
    }
};

// Maintain alarm information by nodeID in memory
// alarmInformation[nodeID] = [Alarm Object]
var alarmInformation = {};

var insertAlarm = function(alarm) {
    // maintain in memory
    if(alarmInformation[alarm.nodeID] == undefined) {
        alarmInformation[alarm.nodeID] = [];
    }
    alarmInformation[alarm.nodeID].push(alarm);

    // Save to mongodb
    var createAlarm = new Promise(function(resolve, reject) {
        db.Alarm.create({
            timestamp: alarm.timestamp,
            message: alarm.message,
            ttl: alarm.ttl,
            tag: alarm.tagID
        }, function(err, created) {
            if(err) return reject(err);
            resolve(created);
        })
    });
    createAlarm.then(function(createdAlarm) {
        alarm.alarmID = createdAlarm._id;
        var alarms = alarmInformation[alarm.nodeID].map(function(alarm) {
            return alarm.alarmID;
        });
        db.Node.findByIdAndUpdate(createdAlarm.nodeID,
            {$set: { alarms: alarms}},
            function(err, node) {
                if(err) {
                    logger('Update node alarms failed:', err);
                }
            }
        )
    });
};

var alarmThrottle = new cache.Cache(config.judge.alarmThrottleSpan);
var handleAlarmMessage = function (alarm) {
    // Date type becomes string after pipe, so rebuild it
    alarm.timestamp = new Date(alarm.timestamp);

    db.Node.findById(alarm.nodeID, function(err, node) {
        if(err) {
            logger('Error fetching node', alarm.nodeID);
            return;
        }
        if(node.ignoredAlarms && alarm.name) {
            for(let i = 0; i < node.ignoredAlarms.length; i++) {
                // ignoredAlarms could be <name>.<device> or <name>
                if(alarm.name.indexOf(node.ignoredAlarms[i]) !== -1) {
                    return;
                }
            }
        }
        if(alarmThrottle.get(alarm.nodeID + alarm.message) !== null) return;
        alarmThrottle.put(alarm.nodeID + alarm.message, 1); // value is dummy

        queueAlarm(alarm, node);
        insertAlarm(alarm);
        logger('ALARM:', 'node:', alarm.nodeID, 'tag:', alarm.tagID, alarm.timestamp, alarm.message);
    }).populate('region idc project', 'name');
};

basicEvaluator.on('message', function(message) {
    if(message['alarm'] != null) {
        handleAlarmMessage(message.alarm);
    }
});

// Maintain evaluation errors in memory
// evaluationError[tagID] = [{
//      timestamp,
//      type,
//      message
//  }, ... ]
var evaluationError = {};

var insertEvaluationError = function (message) {
    if(evaluationError[message.tagID] === undefined) {
        evaluationError[message.tagID] = [];
    }
    evaluationError[message.tagID].push({
        timestamp: new Date(),
        type: message.type,
        message: message.message
    })
};

var updateRules = function() {
    db.Tag.find({}, function(err, tags) {
        if(err) {
            logger('Error fetching tags:', err);
            return;
        }
        tags.map(function (tag) {
            if(tag.alarmRule == undefined
                || tag.alarmRule === '') return;
            if(processes[tag._id] != undefined) {
                if (processes[tag._id].alarmRule === tag.alarmRule) {
                    return;
                } else {
                    processes[tag._id].process.kill();
                    delete processes[tag._id];
                }
            }
            var p = child_process.fork(path.join(__dirname, 'sandbox.js'));
            p.on('message', function (message) {
                if(message['alarm'] != null) {
                    handleAlarmMessage(message['alarm']);
                } else if(message['error'] != null) {
                    insertEvaluationError(message['error']);
                }
            });
            p.on('exit', function (code, signal) {
                processes[tag._id] = undefined;
            });
            p.send({tag: tag});
            processes[tag._id] = {
                alarmRule: tag.alarmRule,
                process: p
            }
        })
    });
    db.Node.find({}, function(err, nodes) {
        if(err) {
            logger('Error fetching nodes:', err);
            return;
        }
        nodes.map(function (node) {
            if(node.judgeEnabled === false) return;
            node.ips.map(function (ip) {
                ip2node.put(ip, {
                    tags: node.tags,
                    nodeID: node._id
                });
            })
        });
    });
};

var processData = function (data) {
        // metricEntry is something like:
        // servers.111_206_211_68.network.tx_fifo.eth2 0 1456934412
        var split = data.metricEntry.split(' ');
        var measure = split[0],
            value = Number(split[1]),
            timestamp = new Date(Number(split[2]) * 1000);
        try {
            var eventName = measure.split('.').slice(2, 4).join('.');
            var device = measure.split('.')[4];
        } catch (err) {
            logger('Error parse metric entry', data.metricEntry, err);
            return;
        }
        var node = ip2node.get(data.ip);
        if(node === null) return;
        emitEventToProcess({
            name: eventName,
            nodeID: node.nodeID,
            ip: data.ip,
            timestamp: timestamp,
            ttl: 60 * 1000,
            device: device,
            payload: value
        });
};

var flushToDB = function() {
    var now = new Date();

    // check if ttl expires and flush to alarmHistory
    for(let nodeID in alarmInformation) {
        if(!alarmInformation.hasOwnProperty(nodeID)) continue;
        var expiredAlarmIds = [], currentAlarmIds = [], currentAlarms = [];
        for(var i = 0; i < alarmInformation[nodeID].length; i++) {
            var alarm = alarmInformation[nodeID][i];
            if(now - alarm.timestamp < alarm.ttl) {
                currentAlarms.push(alarm);
                currentAlarmIds.push(alarm.alarmID);
            } else {
                expiredAlarmIds.push(alarm.alarmID)
            }
        }
        alarmInformation[nodeID] = currentAlarms;
        var state = 'Good';
        if(currentAlarms.length !== 0) state = 'Error';
        db.Node.findByIdAndUpdate(nodeID,
            {
                $push: {alarmHistory: {$each: expiredAlarmIds}},
                $set: {alarms: currentAlarmIds, state: state}
            }, function(err, node) {
                if(err) logger('Flush to node failed:', err);
            }
        )
    }

    // flush evaluation errors
    for(let tagID in evaluationError) {
        if(!evaluationError.hasOwnProperty(tagID)) continue;
        evaluationError[tagID] = evaluationError[tagID].filter(function(errorEntry) {
            return now - errorEntry.timestamp < 60 * 1000;
        });
        var errorStrings = evaluationError[tagID].map(function(errorEntry) {
            return errorEntry.timestamp.toString() + ' ' + errorEntry.type + ': ' + errorEntry.message;
        });
        db.Tag.findByIdAndUpdate(
            {_id: tagID},
            {'$set': {evaluationErrors: errorStrings}},
            function(err, tag) {
                if(err) logger('Error update tag evaluation errors:', err);
            }
        )
    }
};

var ignoreOldAlarms = function() {
    db.Node.update({}, {
        state: 'Good',
        alarms: []
    }, {multi: true}, function(err, raw) {
        if(err) {
            logger('Error updating database', err);
            process.exit(-1);
        }
    })
};

var enablePeriodicWorker = function() {
    var periodicWorker = child_process.fork(path.join(__dirname, 'periodicWorker.js'));
    periodicWorker.on('message', function(message) {
        if(message.event != null) {
            var event = message.event;
            if(event.ip.constructor === Array) {
                event.ip.map(function(ip) {
                    emitEventToProcess({
                        name: event.name,
                        nodeID: event.nodeID,
                        ip: ip,
                        timestamp: event.timeStamp,
                        ttl: event.ttl,
                        payload: event.payload
                    });
                });
            } else { // event.ip is a string, a single IP
                emitEventToProcess(event);
            }
        }
    });
};

process.on('message', function(message) {
    if(message.event) {
        processData(message.event);
    } else {
        if(message.command && message.command === 'enablePeriodicWorker') {
            enablePeriodicWorker();
        }
    }
});

updateRules();
setInterval(updateRules, config.judge.ruleUpdateInterval);
setInterval(flushToDB, 60 * 1000);
setInterval(ring, 60 * 1000);
