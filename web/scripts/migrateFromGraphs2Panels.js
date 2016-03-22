"use strict";

let db = require('../db.js');
let config = require('../config.js');

/*
Migrate database to use panel.
From:
    User
        - graphs
To:
    User
        - panels
    Panel
        - name
        - graphs
        - owner
 */

let migrate = function () {
    db.User.find({}, function(err, users) {
        if(err) {
            console.log(err);
            return;
        }
        users.map(function(user) {
            // user.graphs should exist in db schema, otherwise user.graphs would be undefined
            // console.log(user.graphs);
            db.Panel.create({
                name: 'Default',
                graphs: user.graphs,
                owner: user._id
            }, function(err, createdPanel) {
                if(err) {
                    console.log(err);
                    return;
                }
                db.User.findByIdAndUpdate(user._id,
                    { $push: {panels: createdPanel}},
                    function(err, u) {
                        if(err) {
                            console.log(err);
                            return;
                        }
                        console.log(u);
                    }
                );
            });
        })
    })
};

migrate();