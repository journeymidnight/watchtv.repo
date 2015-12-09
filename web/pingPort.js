var net = require('net');

var config = require('./config.js');

process.on('message', function(message) {
    var pingInfo = message['pingPort'];
    var s = new net.Socket();
    var timeout = setTimeout(function(){
        s.destroy();
        process.send({alarm: {
            ip: pingInfo.ip,
            id: pingInfo.id,
            tagID: pingInfo.tagID,
            message: pingInfo.alarmMessage,
            receivers: pingInfo.receivers
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
