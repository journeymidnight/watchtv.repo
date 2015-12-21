"use strict";

var async = require('async');
var request = require('request');
var child_process = require('child_process');
var vm = require('vm');

var db = require('../db.js');
var config = require('../config.js');
var logger = require('../logger.js').getLogger('Periodic Worker');

var pingPortProcess = child_process.fork('./pingPort.js');
pingPortProcess.on('message', function (message) {
    if(message['Event'] != undefined) {
        process.send(message);
    }
});

process.title = 'node - WatchTV - Periodic Worker';

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
                    process.send({event: {
                        name: 'diamond.liveness',
                        nodeID: node._id,
                        ip: node.ips,
                        timestamp: new Date(),
                        ttl: 60 * 1000,
                        payload: 'dead'
                    }})
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
                    config.periodicWorker.nodeLivenessCheckInterval);
                livenessCheckJobList.push(job);
            })
        }
    )
};

var livenessCheckStarter = function() {
    livenessCheck();
    setInterval(livenessCheck, config.periodicWorker.nodeListUpdateInterval);
};

// tagBasedJobList[tag id] ->
// { tagHash: xxx, jobs: [Array of jobs] }
var tagBasedJobList = {};
var createSandbox = function(tag, nodes) {
    var sandbox = {};
    sandbox.pingPort = function(port, interval) {
        nodes.map(function(node) {
            node.ips.map(function(ip) {
                var ping = function () {
                    pingPortProcess.send({
                        pingPort: {
                            nodeID: node._id,
                            ip: ip,
                            port: port,
                            interval: interval
                        }
                    })
                };
                ping();
                var job = setInterval(ping, interval);
                if(tagBasedJobList[tag._id] == undefined) {
                    tagBasedJobList[tag._id] = {tagHash: tag.periodicJob, jobs: []}
                }
                tagBasedJobList[tag._id].jobs.push(job);
            })
        })
    };
    return sandbox;
};

var updateTagBasedPeriodicJobs = function() {
    db.Tag.find({}, function(err, tags) {
        if(err) {
            logger('Error fetching tags:', err);
            return;
        }
        tags.map(function (tag) {
            if(tagBasedJobList[tag._id] != undefined) {
                if(tagBasedJobList[tag._id].tagHash === tag.periodicJob) {
                    return;
                }
                tagBasedJobList[tag._id].jobs.map(function (job) {
                    clearInterval(job);
                })
            }
            if(tag.periodicJob == undefined
                || tag.periodicJob === '') return;
            db.Node.find({tags: {$in: [tag._id]}}, function(err, nodes) {
                if(err) {
                    logger('Error fetching nodes:', err);
                    return;
                }
                var context = new vm.createContext(createSandbox(tag, nodes));
                try {
                    var script = new vm.Script(tag.periodicJob);
                } catch (err) {
                    process.send({error: {
                        type: 'syntaxError',
                        message: 'Periodic Job: ' + err.toString(),
                        tagID: tag._id
                    }});
                }
                try {
                    script.runInContext(context, {timeout: config.sandbox.timeout});
                } catch (err) {
                    process.send({error: {
                        type: 'runtimeError',
                        message: 'Periodic Job: ' + err.toString(),
                        tagID: tag._id
                    }});
                }
            });
        });
    })
};

var tagBasedPeriodicJobStarter = function() {
    updateTagBasedPeriodicJobs();
    setInterval(updateTagBasedPeriodicJobs, config.periodicWorker.tagListUpdateInterval);
};

var checkList = [livenessCheckStarter, tagBasedPeriodicJobStarter];

// Enable all checkers in checkList
checkList.map(function(checker){
    checker();
});
