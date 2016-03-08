"use strict";

let request = require('request');

let db = require('../db.js');
let config = require('../config.js');


let fetchIPsInTsdb = function() {
    request({
        url: config.db.opentsdbURL + '/api/search/lookup?use_meta=true&limit=10000&m=loadavg.15',
        json: true,
        timeout: 10000 // 10s
    }, function(err, resp, body) {
        if(err) {
            console.log('OpenTSDB connection error.', err);
            return;
        }
        parseIPs(body);
    })
};

let parseIPs = function(data) {
    data.results.map(function(r) {
        let ip = r.tags.ip;
        //console.log(ip);
        let q = {ips: new RegExp(ip, 'i')};
        db.Node.find(q, function(err, nodes) {
            if(err) {
                console.log('Error finding nodes for ', ip, err);
                return;
            }
            if(nodes.length === 0) return;
            if(nodes.length > 1) {
                console.log('ERROR! Same IP for different nodes:', nodes);
                return;
            }
            let update = {
                metricIdentifier: ip
            };
            db.Node.findOneAndUpdate(
                {_id: nodes[0]._id},
                {'$set': update},
                function(err, original) {
                    if(err) {
                        console.log(nodes[0]._id + ' update failed');
                    }
                    console.log(nodes[0]._id + ' update successfully.');
                }
            )
        })
    })
};


fetchIPsInTsdb();
