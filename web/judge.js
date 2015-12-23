"use strict";

var net = require('net');
var child_process = require('child_process');
var dgram = require('dgram');
var path = require('path');

var db = require('./db.js');
var config = require('./config.js');
var logger = require('./logger.js').getLogger('Judge');
var cache = require('./cache.js');

process.title = 'node - WatchTV - Judge';

var emailProcess = child_process.fork(path.join(__dirname, 'alarm', 'email.js'));
var periodicWorker = child_process.fork(path.join(__dirname, 'alarm', 'periodicWorker.js'));
var basicEvaluator = child_process.fork(path.join(__dirname, 'alarm', 'basicEvaluator.js'));

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

var ring = function(alarm) {
    // Send alarm via email
    var fetchNode = new Promise(function(resolve, reject) {
        db.Node.findById(alarm.nodeID, function(err, node) {
            if(err) return reject(err);
            resolve(node);
        }).populate('region idc project', 'name');
    });
    var fetchReceivers;
    if(alarm.tagID != null) {
        fetchReceivers = new Promise(function(resolve, reject){
            db.Tag.findById(alarm.tagID, function(err, tag) {
                if(err) return reject(err);
                resolve(tag.alarmReceivers.join(','));
            })
        });
    } else {
        fetchReceivers = new Promise(function(resovle, reject) {
            db.Node.findById(alarm.nodeID, function(err, node) {
                if(err) return reject(err);
                db.Project.findById(node.project, function(err, project) {
                    if(err) return reject(err);
                    resovle(project.leader.name + '@letv.com');
                }).populate('leader', 'name');
            })
        });
    }
    Promise.all([fetchNode, fetchReceivers])
           .then(function(values){
               var node = values[0],
                   receivers = values[1];
               var content = 'Name: ' + node.name + ' Region: ' + node.region.name +
                   ' IDC: ' + node.idc.name + ' Project: ' + node.project.name + '\n';
               content += 'IP(s): ' + node.ips.join(',') + '\n';
               content += 'Time: ' + alarm.timestamp.toString() + '\n';
               content += alarm.message + '\n';
               emailProcess.send({
                   content: content,
                   to: receivers,
                   subject: 'Alarm from ' + node.name
               });
           })
           .catch(function(error){
               logger('Raise alarm failed:', error);
           });
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

// TODO aggregation
// alarmQueue[nodeID] = [Alarm]
//var alarmQueue = {};

var handleAlarmMessage = function (alarm) {
    // Date type becomes string after pipe, so rebuild it
    alarm.timestamp = new Date(alarm.timestamp);
    ring(alarm);
    insertAlarm(alarm);
    logger('ALARM:', alarm.id, alarm.ip, alarm.message, alarm.receivers);
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
            var p = child_process.fork(path.join(__dirname, 'alarm', 'sandbox.js'));
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
    data.split('\n').map(function (metricEntry) {
        var splitted = metricEntry.split(' ');
        var measure = splitted[0],
            value = Number(splitted[1]),
            timestamp = new Date(Number(splitted[2]) * 1000);
        var ip = measure.split('.')[1].replace(/_/g, '.');
        var eventName = measure.split('.').slice(2, 4).join('.');
        var device = measure.split('.')[4];

        var node = ip2node.get(ip);
        if(node === null) return;
        emitEventToProcess({
            name: eventName,
            nodeID: node.nodeID,
            ip: ip,
            timestamp: timestamp,
            ttl: 60 * 1000,
            device: device,
            payload: value
        });
    })
};

var forwardData = function (data, udpSender) {
    udpSender.send(data, 0, data.length,
            config.judge.sinkPort, config.judge.sinkIP);
};

var startGraphiteServer = function() {
    var udpSender = dgram.createSocket('udp4');
    var server = net.createServer(function(socket) {
        var dataBuffer = '';
        socket.on('data', function(data) {
            dataBuffer += data.toString('ascii');
            var n = dataBuffer.lastIndexOf('\n');
            if(n !== -1) {
                socket.emit('line', dataBuffer.substring(0, n));
                dataBuffer = dataBuffer.substring(n+1);
            }
        });
        socket.on('line', function(data) {
            processData(data);
            forwardData(data, udpSender);
        });
        socket.on('error', function(error) {
            logger('Socket error', error);
        });
    }).listen(config.judge.graphitePort);

    server.on('error', function(error) {
        logger('Server error', error);
    });
};

// TODO aggregation
var aggregateAlarm = function() {
    for(let nodeID in alarmQueue) {
        if(!alarmQueue.hasOwnProperty((nodeID))) continue;

    }
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

logger('Judge started');
updateRules();
setInterval(updateRules, config.judge.ruleUpdateInterval);
startGraphiteServer();
setInterval(flushToDB, 60 * 1000);
