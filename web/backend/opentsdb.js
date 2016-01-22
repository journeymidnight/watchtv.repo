var net = require('net');

var config = require('../config.js');
var logger = require('../logger.js').getLogger('OpenTSDB');

var writable = false;
var createSender = function() {
    var sender = new net.Socket();
    var connect = function() {
        sender.connect(config.judge.sinkPort, config.judge.sinkIP, function() {
            writable = true;
            logger('Connected to opentsdb');
        });
    };
    connect();
    var onError = function(error) {
        writable = false;
        logger('Sender error', error);
        setTimeout(connect, 30 * 1000);  // wait 30s before connection retry
    };
    sender.on('error', onError);
    return sender;
};

var forwardData = function(data, sender) {
    if(!writable) return;
    data.split('\n').map(function (metricEntry) {
        var split = metricEntry.split(' ');
        var measure = split[0],
            value = split[1],
            timestamp = split[2];
        try {
            var ip = measure.split('.')[1].replace(/_/g, '.');
            var eventName = measure.split('.').slice(2, 4).join('.');
            var device = measure.split('.')[4];
        } catch (err) {
            logger('Error parse metric entry', metricEntry, err);
            return;
        }

        var toWrite = 'put ' + eventName + ' ' + timestamp + ' ' + value + ' ip=' + ip;
        if(device) {
            toWrite += ' device=' + device;
        }
        toWrite += '\n';
        sender.write(toWrite);
    })
};


module.exports = {
    createSender: createSender,
    forwardData: forwardData
};