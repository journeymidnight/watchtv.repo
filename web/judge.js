"use strict";

var net = require('net');
var child_process = require('child_process');
var path = require('path');

var db = require('./db.js');
var config = require('./config.js');
var logger = require('./logger.js').getLogger('Judge Dispatcher');

process.title = 'node - WatchTV - Judge Dispatcher';


var judgeProcesses = [];
for(let i = 0; i < config.judge.instanceNumber; i++) {
    judgeProcesses.push(
        child_process.fork(path.join(__dirname, 'alarm', 'judgeInstance.js'))
    )
}
if(config.periodicWorker.enable) {
    judgeProcesses[0].send({command: 'enablePeriodicWorker'});
}

var processData = function (data) {
    data.split('\n').map(function (metricEntry) {
        var splitted = metricEntry.split(' ');
        var measure = splitted[0],
            value = Number(splitted[1]),
            timestamp = new Date(Number(splitted[2]) * 1000);
        try {
            var ip = measure.split('.')[1].replace(/_/g, '.');
            var ipHash = ip.split('.').reduce(function(pre, curr) {
                return pre + Number(curr);
            }, 0);
            var eventName = measure.split('.').slice(2, 4).join('.');
            var device = measure.split('.')[4];
        } catch (err) {
            logger('Error parse metric entry', metricEntry, err);
            return;
        }
        // Hash by IP so certain metrics from same IP would be sent to
        // the same judge process
        judgeProcesses[ipHash % config.judge.instanceNumber].send({
            event: {
                name: eventName,
                ip: ip,
                timestamp: timestamp,
                device: device,
                payload: value
            }
        });
    })
};

var forwardData = require('./backend/' + config.db.timeSeriesBackend + '.js').forwardData;
var createSender = require('./backend/' + config.db.timeSeriesBackend + '.js').createSender;

var startGraphiteServer = function() {
    var sender = createSender();
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
            forwardData(data, sender);
        });
        socket.on('error', function(error) {
            logger('Socket error', error);
        });
    }).listen(config.judge.graphitePort);

    server.on('error', function(error) {
        logger('Server error', error);
    });
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

logger('Judge started');
ignoreOldAlarms();
startGraphiteServer();
