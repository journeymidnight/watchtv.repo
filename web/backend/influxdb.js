var dgram = require('dgram');
var querystring = require('querystring');
var request = require('request');
var _ = require('underscore');

var config = require('../config.js');
var logger = require('../logger.js').getLogger('InfluxDB');

var createSender = function() {
    return dgram.createSocket('udp4');
};

var forwardData = function(data, sender) {
    sender.send(data, 0, data.length,
        config.judge.sinkPort, config.judge.sinkIP);
};

var buildUrl = function(query) {
    var parameters = {
        u: config.db.influxdbUser,
        p: config.db.influxdbPassword,
        db: config.db.influxdbDatabase,
        q: query
    };
    return config.db.influxdbURL + '/query?' +
        encodeURIComponent(querystring.stringify(parameters));
};

var fetch = function(url, callback) {
    request({
        url: url,
        json: true,
        timeout: 5000 // 5s
    }, function(err, resp, body) {
        if(err) {
            logger('InfluxDB connection error:', err);
            callback(err);
            return;
        }
        callback(null, body);
    })
};

var get_measurements = function (data) {
    var series = data.results[0].series,
        measurements = {};
    if (series === undefined) { return {}; }

    series.map(function(s) {
        var keyPosition = {};
        s.columns.map(function(k, i){
            if(k === '_key' || k === 'host' || k === 'type') return;
            keyPosition[k] = i;
        });
        var tags = {};
        s.values.map(function(value){
            for(var k in keyPosition) {
                var position = keyPosition[k];
                if(!tags.hasOwnProperty(k)) tags[k] = {};

                // 1 is dummy since we only care about keys of tags[k]
                tags[k][value[position]] = 1;
            }
        });
        for(var k in tags) {
            tags[k] = Object.keys(tags[k]);
        }
        measurements[s.name] = tags;
    });

    return measurements;
};

var fetchMetadata = function(ip, callback) {
    ip = ip.replace(/\./g, '_');  // influxdb needs underscore split IP address
    var url = buildUrl("SHOW SERIES WHERE host='" + ip + "'");
    fetch(url, function(err, body) {
        if(err) {
            callback(err);
            return;
        }
        callback(null, get_measurements(body));
    });
};

var pointsPerGraph = 300;

var buildQuery = function(fromTime, toTime, host, measurement, device, measure) {
    // fromTime and toTime are all Date objects
    var groupByTime = Math.floor( (toTime - fromTime)/pointsPerGraph/1000 );
    if (groupByTime < 10) { groupByTime = 10; }

    var query = 'SELECT MEAN(value) FROM ' + measurement +
        " WHERE host='" + host +  "' AND measure='" + measure + "'" +
        " AND time > '" + fromTime.toISOString() +  "' AND time < '" +
        toTime.toISOString() + "' ";
    if(device) {
        query += " AND device='" + device + "' ";
    }
    query += ' GROUP BY time(' + groupByTime + 's)';
    return query;
};

var get_value = function (ret) {
    if (ret.results[0].series == undefined) {
        return []
    }
    return _.flatten(ret.results[0].series[0].values);
};

var fitData = function(data) {
    // convert [time, data, time, data ...]
    // to [ [time, data], [time, data], ...]
    var fitted_data = [];
    for (var i = 0; i < data.length; i+=2){
        var d = [Date.parse(data[i]) , data[i+1]];
        fitted_data.push(d);
    }
    if(fitted_data.length < 2) {  // len=0 would cause null value,
        // 1 would cause divide by 0
        return fitted_data;
    }
    // do linear fitting to eliminate null values
    var last_i = null,
        timeSpan = fitted_data[fitted_data.length-1][0] - fitted_data[0][0],
    // don't do fitting if more than 10min data are lost
        thresholdPointNumber = Math.floor((10 * 60 * 1000 * fitted_data.length) / timeSpan);
    for (i = 0; i < fitted_data.length; i += 1) {
        if(fitted_data[i][1]) {
            if (last_i) {
                if(i - last_i > thresholdPointNumber) {
                    last_i = i;
                    continue;
                }
                for(var j = last_i + 1; j < i; j += 1) {
                    var y1 = fitted_data[last_i][1];
                    var y2 = fitted_data[i][1];
                    fitted_data[j][1] = y1 + (y2 - y1) * (j - last_i) / (i - last_i);
                }
            }
            last_i = i;
        }
    }
    return fitted_data;
};

var fetchMetric = function(fromTime, toTime, ip, measurement, device, measure, callback) {
    fromTime = new Date(fromTime);
    toTime = new Date(toTime);
    var query = buildQuery(fromTime, toTime, ip, measurement, device, measure);
    var url = buildUrl(query);
    fetch(url, function(err, body) {
        if(err) {
            callback(err);
            return;
        }
        callback(null, fitData(get_value(body)));
    });
};

module.exports = {
    createSender: createSender,
    forwardData: forwardData,
    fetchMetadata: fetchMetadata,
    fetchMetric: fetchMetric
};