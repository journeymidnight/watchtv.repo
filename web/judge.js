var async = require('async');
var request = require('request');
var net = require('net');
var child_process = require('child_process');

var db = require('./db.js');
var config = require('./config.js');
var logger = require('./logger.js').getLogger('Judge');


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

                logger('State of', node.ips, ' ', state);
                var update = {};
                if(state) {
                    update = {
                        state: 'Good',
                        failedRules: []
                    }
                } else {
                    update = {
                        state: 'Error',
                        failedRules: ['Diamond does not respond']
                    }
                }

                db.Node.findOneAndUpdate(
                    { _id: node._id },
                    { '$set': update},
                    function(err, state) {
                        if(err) {logger('Create/update state ', err)}
                    }
                )
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
                                      config.judge.NodeCheckInterval);
                livenessCheckJobList.push(job);
            })
        }
    )
};

var livenessCheckStarter = function() {
    livenessCheck();
    setInterval(livenessCheck, config.judge.NodeListUpdateInterval);
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
                    ips: ips,
                    ids: ids
                };
            })
        })
    });
};

var alarmQueue = [];
var emailProcess = child_process.fork('email.js');

var alarm = function (alarm) {
    alarmQueue.push(alarm);
    logger('ALARM:', alarm.id, alarm.ip, alarm.message);
};

var handleEvaluationError = function (message) {
    // TODO
    console.log('ERROR:', message);
};

var alarmAggregation = function () {
    var alarms = {};
    alarmQueue.map(function(alarm) {
        var newAlarm = {ip: alarm.ip, message: alarm.message};
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
                alarms[alarm.id].push({ip: alarm.ip, message: alarm.message})
            }
        } else {
            alarms[alarm.id] = [newAlarm];
        }
    });
    alarmQueue = [];
    for(var nodeID in alarms) {
        if(!alarms.hasOwnProperty(nodeID)) continue;
        db.Node.findById(nodeID, function (err, node) {
            var content = node.name + ' ' + node.region.name + ' ' + node.idc.name +
                          ' ' + node.project.name + '\n\n';
            alarms[nodeID].map(function(alarm){
                content += alarm.ip + ' ' + alarm.message + '\n'
            });
            emailProcess.send({
                content: content,
                to: 'zhangcan@letv.com',
                subject: 'Alarm from ' + node.name
            })
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
                handleEvaluationError(message['syntaxError']);
            } else if(message['runtimeError'] != null) {
                handleEvaluationError(message['runtimeError']);
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
                id: tagBasedRules[tag].ids[i]
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
        processes[p.pid] = tag;
    }
};

var tagBasedRulesCheck = function() {
    var metrics = {};
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

    setInterval(alarmAggregation, config.judge.tagBasedRulesCheckInterval * 2);
};

var checkList = [livenessCheckStarter, tagBasedRulesCheck];

logger('Judge started');
// Enable all checkers in checkList
checkList.map(function(checker){
    checker();
});

