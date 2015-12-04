
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
    influxdbURL: "http://10.130.211.68:8086",
    influxdbUser: "root",
    influxdbPassword: "root",
    influxdbDatabase: "graphite"
};

config.judge = {
    graphitePort: 2003,
    cachePeriodNumber: 3,
    tagListUpdateInterval: 60 * 1000, // 1min, in ms
    tagBasedRulesCheckInterval: 10 * 1000, // 10s
    sandboxTimeout: 30 * 1000, // 30s
    NodeCheckInterval: 5 * 60 * 1000, // 5min
    NodeListUpdateInterval: 60 * 60 * 1000 // 1h
};

config.log = {
    path: "/var/log/watchtv/watchtv.log"
};


module.exports = config;
