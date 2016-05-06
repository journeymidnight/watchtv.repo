var net = require('net');
var request = require('request');

var config = require('../config.js');
var db = require('../db.js');
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
    sender.on('data', function(data) {
        logger('Data point write error: ', data.toString('ascii'));
    });
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

        var metric = eventName + ip;
        if(device) metric += device;
        var toWrite = 'put ' + metric + ' ' + timestamp + ' ' + value + ' _=_' + '\n';
        // NOTE: setting tag to `_=_` is a workaround because OpenTSDB telnet
        // interface requires at least one tag pair

        sender.write(toWrite);
    })
};

var fetch = function(url, callback) {
    request({
        url: url,
        json: true,
        timeout: 100000 // 100s
    }, function(err, resp, body) {
        if(err) {
            logger('OpenTSDB connection error:', err);
            callback(err);
            return;
        }
        callback(null, body);
    })
};

var fetchMetadata = function(ip, callback) {
    db.Metric.findOne({metricIdentifier: ip}, function (err, m) {
        if(err) {
            logger('Error fetching metric meta:', err);
            callback(err, {});
            return;
        }
        if(!m || !m.metrics) {
            callback('Empty metadata', {});
            return;
        }
        callback(null, m.metrics);
    })
};

var pointsPerGraph = 200;

var buildQuery = function(fromTime, toTime, ip, measurement, device, measure) {
    var downSampleInterval = Math.floor((toTime - fromTime)/pointsPerGraph/1000);
    if(downSampleInterval < 1) downSampleInterval = 1;
    var query = 'start=' + fromTime + '&end=' + toTime +
            '&m=avg:' + downSampleInterval + 's-avg:' + measurement + '.' + measure + ip;
    if(device) query += device;

    return query;
};

var get_value = function(res) {
    var ret = [];
    if(res.length === 0 || !res[0].dps) {
        return [];
    }
    var dps = res[0].dps;
    for(var t in dps) {
        ret.push([1000 * Number(t), dps[t]]);
    }
    return ret;
};

var fetchMetric = function(fromTime, toTime, ip, measurement, device, measure, callback, tsdbUrl) {
    tsdbUrl = tsdbUrl || config.db.opentsdbURL;
    var url = tsdbUrl + '/api/query?' +
                buildQuery(fromTime, toTime, ip, measurement, device, measure);
    fetch(url, function(err, body) {
        if(err) {
            callback(err);
            return;
        }
        if(body.error) {
            callback(body.error.message);
            return;
        }
        callback(null, get_value(body));
    })
};

module.exports = {
    createSender: createSender,
    forwardData: forwardData,
    fetchMetadata: fetchMetadata,
    fetchMetric: fetchMetric
};
