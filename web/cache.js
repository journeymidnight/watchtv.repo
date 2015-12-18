'use strict';

// A cache with TTL
// Implements TTL lazily, trade memory for CPU(or should we trade CPU for memory?)

var Record = function(value, ttl) {
    this.timestamp = new Date();
    this.value = value;
    this.ttl = ttl;
};

var Cache = function(defaultTtl) {
    if(defaultTtl != null) this.ttl = defaultTtl;
    var cache = {};
    this.put = function(key, value, ttl) {
        cache[key] = new Record(value, ttl || this.ttl);
    };
    this.get = function(key) {
        var record = cache[key];
        if(record == undefined) return null;
        var now = new Date();
        if(now - record.timestamp < record.ttl) return record.value;

        delete cache[key];
        return null;
    };
};

module.exports = {
    Cache: Cache
};
