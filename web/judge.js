"use strict";

var async = require('async');
var request = require('request');
var net = require('net');
var child_process = require('child_process');
var dgram = require('dgram');

var db = require('./db.js');
var config = require('./config.js');
var logger = require('./logger.js').getLogger('Judge');

// Maintain alarm information by nodeID in memory
// alarmInformation[nodeID] = {
//     name,
//     alarms[alarmKey] = [{
//         message,
//         tagID,
//         timestamp,
//         ttl
//     }, ... ]
// }
var alarmInformation = {};
// Maintain evaluation errors in memory
// evaluationError[tagID] = [{
//      timestamp,
//      type,
//      message
//  }, ... ]
var evaluationError = {};

var alarmQueue = [];
var emailProcess = child_process.fork('email.js');

process.on('message', function(message) {
    if(message['nodeAlarms'] != null) {
        var nodeID = message['nodeAlarms'];
        var alarms = {
            nodeID: nodeID,
            alarms: {}
        };
        if(alarmInformation[nodeID] != undefined) {
            alarms.alarms = alarmInformation[nodeID].alarms;
        }
        process.send({nodeAlarms: alarms});
    } else if(message['tagErrors'] != null) {
        var tagID = message['tagErrors'];
        var errors = {
            tagID: tagID,
            errors: {}
        };
        if(evaluationError[tagID] != undefined) {
            errors.errors = evaluationError[tagID];
        }
        process.send({tagErrors: errors});
    }
});

var AlarmNode = function(name) {
    this.name = name;
    this.alarms = {};
};

var Alarm = function(message, tagID, timestamp, ttl) {
    this.message = message;
    this.tagID = tagID;
    this.timestamp = timestamp;
    this.ttl = ttl;
};

var insertAlarm = function(nodeID, nodeName, alarmKey, message, tagID, timestamp, ttl) {
    if(alarmInformation[nodeID] === undefined) {
        alarmInformation[nodeID] = new AlarmNode(nodeName);
    }
    if(alarmInformation[nodeID].alarms[alarmKey] === undefined) {
        alarmInformation[nodeID].alarms[alarmKey] = [];
    }
    alarmInformation[nodeID].alarms[alarmKey].push(new Alarm(message, tagID, timestamp, ttl));
};

var nodeLivenessCheckFactory = function(node) {
    return function() {
        async.map(
            node.ips,
            function(ip, callback) {
                // IP addresses stored in db could be in the form
                // 1.2.3.4 or 1.2.3.4:1234
                // for the former format, we should append default port when checking
                if(ip.split(':')[1] == undefined) {
                    ip += ':' + config.webServer.defaultDiamondPort;
                }
                request({
                    url: 'http://' + ip,
                    timeout: 30 * 1000 // 30s
                }, function(err, response, body){
                    if(err || response.statusCode != 200) {
                        callback(null, false);
                        return;
                    }
                    try {
                        var result = JSON.parse(body);
                    } catch(err) {
                        callback(null, false);
                        return;
                    }
                    if(result.hello === 'diamond') {
                        callback(null, true);
                    } else {
                        callback(null, false);
                    }
                })
            },
            function(err, results) {
                var state = results.reduce(function(previous, current){
                    return (previous || current);
                }, false);

                logger('Liveness of', node.ips, state);
                if(state === false) {
                    insertAlarm(node._id, node.name, 'diamond', 'Diamond does not respond',
                        null, new Date(), config.judge.nodeLivenessCheckInterval * 3);
                    // TODO: send alarm to leader of node's project
                }
            }
        )
    }
};

var livenessCheckJobList = [];
var livenessCheck = function() {
    db.Node.find({},
        function(err, nodes) {
            if(err || nodes == null) {
                logger('Error fetching nodes ', err);
                return;
            }
            livenessCheckJobList.map(function(job){
                clearInterval(job);
            });
            livenessCheckJobList = [];
            nodes.map(function(node){
                var job = setInterval(nodeLivenessCheckFactory(node),
                                      config.judge.nodeLivenessCheckInterval);
                livenessCheckJobList.push(job);
            })
        }
    )
};

var livenessCheckStarter = function() {
    livenessCheck();
    setInterval(livenessCheck, config.judge.nodeListUpdateInterval);
};

// Convert metrics received from graphite protocol:
// servers.10_58_180_60.iostat.average_queue_length.dm-0 0 1448951122\n
// servers.10_58_180_60.iostat.io_ms.dm-0 34 1448951122\n
// into metrics data structure:
// {'10.58.180.60': {'iostat':
//      {'average_queue_length': {'dm-0': [0, ..., N]},
//       'io_ms': {'dm-0': [34, ..., N]}}
// }}
// where N is how many data points to cache per metric
var processData = function(data, metrics) {
    data.split('\n').map(function(metricEntry) {
        var splited = metricEntry.split(' ');
        var measure = splited[0],
            value = Number(splited[1]),
            // TODO: make use of timestamp
            timestamp = new Date(Number(splited[2] * 1000));
        var n = config.judge.cachePeriodNumber;

        measure.split('.').slice(1)  // ignore first part now since it's always `server`
               .reduce(function (previousValue, currentValue, currentIndex, array) {
                   if(previousValue[currentValue] === undefined) {
                       if(currentIndex === array.length - 1) {
                           previousValue[currentValue] = new Array(n+1);
                           previousValue[currentValue][n] = 0; // point to next data slot
                       } else {
                           previousValue[currentValue] = {};
                       }
                   }
                   if(currentIndex === array.length - 1) {
                       var d = previousValue[currentValue];
                       d[d[n]] = value;
                       d[n] = (d[n] + 1) % n;
                   }
                   return previousValue[currentValue];
               }, metrics);
    })
};

var updateTagRules = function(tagBasedRules) {
    db.Tag.find({}, function(err, tags) {
        if(err) {
            logger('Error fetching tags:', err);
            return;
        }
        tags.map(function (tag) {
            if(tag.alarmRules.length === 0) return;
            db.Node.find({tags: {$in: [tag._id]}}, function(err, nodes) {
                if(err) {
                    logger('Error fetching nodes:', err);
                    return;
                }
                var ips = [], ids = [];
                nodes.map(function(node) {
                    if(node.judgeEnabled === false) return;
                    ips = ips.concat(node.ips);
                    ids = ids.concat(new Array(ips.length).fill(node._id)); //`fill` is an ES6 method
                });
                tagBasedRules[tag._id] = {
                    rules: tag.alarmRules,
                    receivers: tag.alarmReceivers,
                    ips: ips,
                    ids: ids
                };
            })
        })
    });
};

var alarm = function (alarm) {
    alarmQueue.push(alarm);
    logger('ALARM:', alarm.id, alarm.ip, alarm.message, alarm.receivers);
};

var insertEvaluationError = function (message, type) {
    if(evaluationError[message.tagID] === undefined) {
        evaluationError[message.tagID] = [];
    }
    evaluationError[message.tagID].push({
        timestamp: new Date(),
        type: type,
        message: message.message
    })
};

var alarmAggregation = function () {
    var alarms = {};
    alarmQueue.map(function(alarm) {
        var newAlarm = {
            ip: alarm.ip,
            message: alarm.message,
            receivers: alarm.receivers,
            tagID: alarm.tagID
        };
        if(alarms[alarm.id] != null) {
            var exist = false;
            for (var i = 0; i < alarms[alarm.id].length; i++) {
                if(alarms[alarm.id][i].ip === newAlarm.ip
                    && alarms[alarm.id][i].message === newAlarm.message) {
                    exist = true;
                    break;
                }
            }
            if(!exist) {
                alarms[alarm.id].push(newAlarm);
            }
        } else {
            alarms[alarm.id] = [newAlarm];
        }
    });
    alarmQueue = [];
    for(let nodeID in alarms) {
        if(!alarms.hasOwnProperty(nodeID)) continue;
        db.Node.findById(nodeID, function (err, node) {
            var content = 'Name: ' + node.name + ' Region: ' + node.region.name +
                          ' IDC: ' + node.idc.name +
                          ' Project: ' + node.project.name + '\n\n';
            var receivers = [];
            alarms[nodeID].map(function(alarm){
                content += alarm.ip + ' ' + alarm.message + '\n';
                alarm.receivers.map(function(receiver) {
                    if(receivers.indexOf(receiver) === -1) {
                        receivers.push(receiver);
                    }
                });
                insertAlarm(nodeID, node.name, alarm.ip, alarm.message, alarm.tagID, new Date(),
                            config.judge.tagBasedRulesCheckInterval * 3);
            });
            emailProcess.send({
                content: content,
                to: receivers.join(','),
                subject: 'Alarm from ' + node.name
            });
        }).populate('region idc project', 'name');
    }
};

var pingPortProcess = child_process.fork('pingPort.js');

var checkRules = function(processes, tagBasedRules, metrics) {
    for(var tag in tagBasedRules) {
        if(!tagBasedRules.hasOwnProperty(tag)) continue;

        var p = child_process.fork('sandbox.js');
        p.on('message', function (message) {
            if(message['alarm'] != null) {
                alarm(message['alarm']);
            } else if(message['syntaxError'] != null) {
                insertEvaluationError(message['syntaxError'], 'syntaxError');
            } else if(message['runtimeError'] != null) {
                insertEvaluationError(message['runtimeError'], 'runtimeError');
            } else if(message['pingPort'] != null) {
                pingPortProcess.send({pingPort: message['pingPort']});
            }
        });
        // Send nodes array and user defined scripts to sandbox
        var nodes = [];
        for(var i = 0; i < tagBasedRules[tag].ips.length; i++) {
            var ip = tagBasedRules[tag].ips[i];
            var node = {
                ip: ip,
                id: tagBasedRules[tag].ids[i],
                tagID: tag
            };
            var underscoredIP = ip.replace(/\./g, '_');
            if(metrics[underscoredIP]) {
                node['metrics'] = metrics[underscoredIP];
            } else {
                node['metrics'] = {};
            }
            nodes.push(node);
        }
        p.send({nodes: nodes});
        p.send({rules: tagBasedRules[tag].rules});
        p.send({receivers: tagBasedRules[tag].receivers});
        processes[p.pid] = {
            timestamp: new Date(),
            process: p
        };
    }
};

var cleanProcess = function (processes) {
    var now = new Date();
    Object.keys(processes).map(function(pid) {
        if(now - processes[pid].timestamp > config.judge.sandboxProcessTimeOut) {
            processes[pid].process.kill();
            delete processes[pid];
        }
    })
};

var forwardData = function (data, udpSender) {
    udpSender.send(data, 0, data.length, config.judge.sinkPort,
                    config.judge.sinkIP);
};

var tagBasedRulesCheck = function() {
    var metrics = {};
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
            processData(data, metrics);
            forwardData(data, udpSender);
        });
        socket.on('error', function(error) {
            logger('Socket error', error);
        });
    }).listen(config.judge.graphitePort);

    server.on('error', function(error) {
        logger('Server error', error);
    });

    var tagBasedRules = {};
    updateTagRules(tagBasedRules);
    setInterval(updateTagRules.bind(null, tagBasedRules), config.judge.tagListUpdateInterval);

    pingPortProcess.on('message', function (message) {
        if(message['alarm'] != null) {
            alarm(message['alarm']);
        }
    });
    var processes = {};
    setInterval(checkRules.bind(null, processes, tagBasedRules, metrics),
                config.judge.tagBasedRulesCheckInterval);
    setInterval(cleanProcess.bind(null, processes), config.judge.sandboxProcessTimeOut);

    setInterval(alarmAggregation, config.judge.tagBasedRulesCheckInterval * 2);
};

var periodicChecker = function () {
    var now = new Date();
    for(var nodeID in alarmInformation) {
        if(!alarmInformation.hasOwnProperty(nodeID)) continue;

        var alarmCount = 0;
        var alarms = alarmInformation[nodeID].alarms;
        for(var alarmKey in alarms) {
            if(!alarms.hasOwnProperty(alarmKey)) continue;

            alarms[alarmKey] = alarms[alarmKey].filter(function(alarm) {
                if(now - alarm.timestamp > alarm.ttl) {
                    return false;
                } else {
                    alarmCount += 1;
                    return true;
                }
          })
        }
        var update = {
            state: 'Good'
        };
        if(alarmCount > 0) {
            update.state = 'Error';
        }
        db.Node.findByIdAndUpdate(
            {_id: nodeID},
            {'$set': update},
            function(err, state) {
                if(err) {logger('Error update node state:', err)}
            }
        )
    }
    for(var tagID in evaluationError) {
        if(!evaluationError.hasOwnProperty(tagID)) continue;

        evaluationError[tagID] = evaluationError[tagID].filter(function (error) {
            return now - error.timestamp < 60 * 1000;
        })
    }
};

setInterval(periodicChecker, 60 * 1000);

var checkList = [livenessCheckStarter, tagBasedRulesCheck];

logger('Judge started');
// Enable all checkers in checkList
checkList.map(function(checker){
    checker();
});
