var async = require('async');
var request = require('request');

var db = require('./db.js');

// TODO: Make them configurable
var NodeCheckInterval = 5 * 60 * 1000; // 5min, in ms
var NodeListUpdateInterval = 12 * 60 * 60 * 1000; // 12h, in ms

var nodeLivenessCheckFactory = function(node) {
    return function() {
        async.map(
            node.ips,
            function(ip, callback) {
                request('http://' + ip, function(err, response, body){
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

                console.log('State of ', node.ips, '   ', state);
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
                        if(err) {console.log('Create/update state ', err)}
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
            if(err) {
                console.log('fetching nodes ', err);
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

// Enable all checkers in checkList
checkList.map(function(checker){
    checker();
    setInterval(checker, NodeListUpdateInterval);
});

