'use strict';

var events = require('events');

var config = require('../config.js');
var logger = require('../logger.js').getLogger('Basic Evaluator');

process.title = 'node - WatchTV - Basic Evaluator';

var emitter = new events.EventEmitter();

process.on('message', function (message) {
    if(message['event']) {
        console.log('EVENT', message.event);
        emitter.emit(message.event.name, message.event);
    }
});

var evaluateUptime = function(nodes) {
    nodes.map(function(node, index) {
        if(!ready(node.uptime)) return;

        var n = node.uptime.uptime_sec;
        if(n[n.length - 1] < 60 * 15) {
            alarm(index, 'Node seems to have been rebooted');
        }
    })
};

var evaluateDiskUsage = function(nodes) {
    nodes.map(function(node, index) {
        if(!ready(node.diskspace)) return;

        var n = node['diskspace']['free_byte_percent'];
        for(var disk in n) {
            if(!n.hasOwnProperty(disk)) continue;

            if(n[disk][0] < 10) {
                alarm(index, 'Free space of ' + disk + ' < 10%');
            }
        }
    })
};

var evaluateSwapUsage = function(nodes) {
    nodes.map(function(node, index) {
        if (!ready(node.memory)) return;

        var n = node['memory'];
        if(n['SwapFree_byte'][0] / n['SwapTotal_byte'][0] < 0.1) {
            alarm(index, 'Free swap < 10%');
        }
    })
};