var async = require('async');
var request = require('request');

var db = require('./db.js');
var config = require('./config.js');
var logger = require('./logger.js').getLogger('Judge');

var NodeCheckInterval = config.judge.NodeCheckInterval;
var NodeListUpdateInterval = config.judge.NodeListUpdateInterval;

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
                    if(result.hello == 'diamond') {
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
                var job = setInterval(nodeLivenessCheckFactory(node), NodeCheckInterval);
                livenessCheckJobList.push(job);
            })
        }
    )
};

var checkList = [livenessCheck];

logger('Judge started');
// Enable all checkers in checkList
checkList.map(function(checker){
    checker();
    setInterval(checker, NodeListUpdateInterval);
});

