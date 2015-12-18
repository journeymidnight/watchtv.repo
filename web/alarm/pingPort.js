var net = require('net');

var config = require('../config.js');

process.on('message', function(message) {
    var pingInfo = message['pingPort'];
    var s = new net.Socket();
    var timeout = setTimeout(function(){
        s.destroy();
        process.send({Event: {
            name: 'pingPort',
            nodeID: pingInfo.nodeID,
            ip: pingInfo.ip,
            timestamp: new Date(),
            ttl: 2 * pingInfo.interval,
            payload: 'failed'
        }})
    }, 1000);
    s.connect({
        host: pingInfo.ip,
        port: pingInfo.port
    }).on('connect', function() {
        clearTimeout(timeout);
        s.destroy();
    }).on('error', function() {return});
});
