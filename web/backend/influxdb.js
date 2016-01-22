var dgram = require('dgram');

var config = require('../config.js');

var createSender = function() {
    return dgram.createSocket('udp4');
};

var forwardData = function(data, sender) {
    sender.send(data, 0, data.length,
        config.judge.sinkPort, config.judge.sinkIP);
};


module.exports = {
    createSender: createSender,
    forwardData: forwardData
};