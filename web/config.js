
var config = {};

config.webServer = {
    port: 80,
    defaultDiamondPort: 5000,
    sessionSecret: 'change_this_to_a_random_string_or_being_hacked',
    sessionDuration: 7 * 24 * 60 * 60 * 1000, // in ms
    sessionActiveDuration: 7 * 24 * 60 * 60 * 1000  // in ms
};

config.db = {
    mongodbURL: "mongodb://localhost:27017/watchtv",
    timeSeriesBackend: "opentsdb",  // influxdb or opentsdb
    opentsdbURL: "http://10.140.80.10:4242",
    influxdbURL: "http://10.58.180.151:8086",
    influxdbUser: "root",
    influxdbPassword: "root",
    influxdbDatabase: "graphite"
};

config.judge = {
    graphitePort: 2004,
    sinkIP: '10.140.80.108',
    sinkPort: 4242,
    ruleUpdateInterval: 60 * 1000, // 1min, in ms
    alarmThrottleSpan: 3 * 60 * 60 * 1000 // 3h
};

config.sandbox = {
    timeout: 10 * 1000 // 10s
};

config.periodicWorker = {
    nodeLivenessCheckInterval: 5 * 60 * 1000, // 5min
    nodeListUpdateInterval: 10 * 60 * 1000, // 10min
    tagListUpdateInterval: 60 * 1000 // 1min
};

config.email = {
    server: '10.130.211.68'
};

config.log = {
    path: "/var/log/watchtv/watchtv.log"
};


module.exports = config;
