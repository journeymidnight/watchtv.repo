
var config = {};

config.webServer = {
    port: 80,
    defaultDiamondPort: 5000,
    sessionSecret: 'change_this_to_a_random_string_or_being_hacked',
    sessionDuration: 30 * 60 * 1000, // in ms
    sessionActiveDuration: 10 * 60 * 1000  // in ms
};

config.webApp = {
    itemsPerPage: 10,
    influxdbURL: "http://10.58.180.114:8086",
    influxdbUser: "root",
    influxdbPassword: "root",
    influxdbDatabase: "graphite"
};

config.db = {
    mongodbURL: "mongodb://watchtv:watchtv@localhost:27017/watchtv"
};

config.judge = {
    NodeCheckInterval: 5 * 60 * 1000, // 5min, in ms
    NodeListUpdateInterval: 60 * 60 * 1000 // 1h, in ms
};

config.log = {
    path: "/var/log/watchtv/watchtv.log"
};


module.exports = config;
