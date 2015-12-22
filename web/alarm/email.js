var email = require('emailjs/email');

var config = require('../config.js');
var logger = require('../logger.js').getLogger('Email');

process.title = 'node - WatchTV - Email Sender';

var server = email.server.connect({
    host: config.email.server,
    ssl: false
});

process.on('message', function (message) {
    server.send({
        text: message.content,
        from: 'WatchTV Alarm Service <alarm@watchtv.letv.io>',
        to: message.to,
        subject: message.subject
    }, function(err, message) {
        if(err) {
            logger('Email failed to send to', email.to, 'with error', err);
        }
    })
});