"use strict";

var fs = require('fs');
var path = require('path');
var express = require('express');
var bodyParser = require('body-parser');
var validator = require('validator');
var async = require('async');
var request = require('request');
var session = require('client-sessions');
var swig = require('swig');
var url = require('url');
var querystring = require('querystring');

var db = require('./db.js');
var config = require('./config.js');
var logger = require('./logger.js').getLogger('API');

var app = express();

var userPopulateArgument = {
    path: "projects panels",
    select: "name ips metrics title"
};

var isArray = function (value) {
    return (value.constructor === Array);
};

var isUndefined = function (value) {
    return (value === undefined);
};

var notUndefined = function (value) {
    return (value !== undefined);
};

var notNull = function(value) {
    return (value !== null);
};

var valueWithDefault = function(value, defaultValue) {
    if (isUndefined(value)) {
        return defaultValue;
    }
    return value;
};

// s is a set(array), push i into s
var setAdd = function(s, i) {
    if(s.indexOf(i) === -1) {
        s.push(i);
    }
};

// a & b are sets(arrays), return array c which is set(a) + set(b)
var setMerge = function(a, b) {
    var c = a.slice();  // c is now a copy of a
    b.map(function(item){
        setAdd(c, item);
    });
    return c;
};

// a & b are sets(arrays), return array c which is set(a) - set(b),
// order matters
var setDiff = function(a, b) {
    var c = [];
    a.map(function(item) {
        if(b.indexOf(item) === -1) {
            c.push(item);
        }
    });
    return c;
};

app.engine('html', swig.renderFile);
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'app', 'static', 'views'));
app.set('port', (config.webServer.port || 3000));

var requireLogin = function (req, res, next) {
    logger(req.method, req.url);
    if (req.url.indexOf('/login') >= 0 || req.url.indexOf('/js') >= 0 ||
            req.url.indexOf('/css') >= 0 || req.url.indexOf('/images') >= 0 ||
            req.url.indexOf('/logout') >= 0) {
        next();
        return;
    }
    // For API test
    //req.user = {
    //    _id: '560b644fb2aafe01657b78c1'
    //};
    //next();
    //return;
    if (req.session && req.session.user) {
        db.User.findOne({name: req.session.user},
            function (err, u) {
                if (u) {
                    req.user = u;
                    next();
                } else {
                    res.status(401).send('Please login again');
                }
            }).populate(userPopulateArgument.path, userPopulateArgument.select);
    } else {
        if (req.url.indexOf('.html') >= 0 || req.url === '/') { // page requests are from browser
            res.redirect('/login.html');
            return;
        }
        res.status(401).send('Please login again');
    }
};

// for users >= Leader
var requireLeader = function (req, res, next) {
    if (req.user.role === 'Leader' || req.user.role === 'Root') {
        next();
    } else {
        res.status(403).send('You should be Leader to perform this action');
    }
};

var requireRoot = function (req, res, next) {
    if (req.user.role === 'Root') {
        next();
    } else {
        res.status(403).send('You should be Root to perform this action');
    }
};

app.use(session({
    cookieName: 'session',
    secret: config.webServer.sessionSecret,
    duration: config.webServer.sessionDuration,
    activeDurations: config.webServer.sessionActiveDuration
}));
app.use(requireLogin);
app.use('/static/', express.static(path.join(__dirname, 'app', 'static')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.listen(app.get('port'), function() {
    logger('Server started: http://0.0.0.0:' + app.get('port'));
});

var handlePluralGet = function(req, res, name, model, query, extraModelActions) {
    // used in GET /nodes, /tags, /users and queryTag

    // name: string, used in notification string and result key name
    // model: mongoose model
    // query: query sent to mongodb
    // extraModelActions: actions to apply to mongoose query, in format
    //                  [{
    //                      methodName: 'method',
    //                      arguments: ['arg1', 'arg2', ...]
    //                  },
    //                  { ... }, ...]
    if(isUndefined(extraModelActions)) extraModelActions = [];

    var skip = valueWithDefault(req.query.skip, 0),
        limit = valueWithDefault(req.query.limit, 15);
    skip = parseInt(skip);
    limit = parseInt(limit);

    model.count(query, function (err, count) {
        if (err) {
            res.status(500).send("Cannot count " + name + " number");
            logger(err);
            return;
        }
        var q = extraModelActions.reduce(
            function(preValue, currValue){
                return preValue[currValue.methodName].apply(preValue, currValue.arguments);
        },
        model.find(query)
             .skip(skip)
             .limit(limit)
        );
        q.exec(function (err, instances) {
            if(err) {
                res.status(500).send("Cannot fetch " + name + " list");
                logger(err);
                return;
            }
            res.setHeader('Content-Type', 'application/json');
            res.send({
                total: count,
                skip: skip,
                limit: limit,
                result: instances
            });
        });
    });
};

var handleDeleteById = function(req, res, name, model) {
    // Used to simplify DELETE /<name>/<name_id> methods
    //
    // name: string, used 1) to get corresponding id, 2) in error string
    // model: mongoose model

    var id = req.params[name + '_id'];
    model.findByIdAndRemove(id, function(err) {
        if(err) {
            var errString = 'Failed to delete ' + name + ' ' + id;
            res.status(500).send(errString);
            logger(errString, err);
            return;
        }
        res.status(200).send(name + ' ' + id + ' has been deleted');
    });
};

var handleGetById = function(req, res, name, model, extraModelActions) {
    // Used to simplify GET /<name>/<name_id> methods
    //
    // Meanings of name, model and extraModelActions are same as
    // in `handlePluralGet`

    if (isUndefined(extraModelActions)) extraModelActions = [];

    var id = req.params[name + '_id'];

    var q = extraModelActions.reduce(
        function(preValue, currValue) {
            return preValue[currValue.methodName].apply(preValue, currValue.arguments);
        },
        model.findById(id)
    );
    q.exec(function (err, found) {
        var errString;
        if(err) {
            errString = 'Error fetching ' + name + ' info';
            res.status(500).send(errString);
            logger(errString);
            return;
        }
        if(!found) {
            errString = name + ' ' + id + ' does not exist';
            res.status(404).send(errString);
            return;
        }
        res.send(found);
    });
};

var handleCreate = function(res, toCreate, name, model, callback) {
    model.create(toCreate, function(err, created) {
        if(err) {
            res.status(500).send(name + ' create failed');
            logger(name + ' create failed: ', err);
            return;
        }
        if(callback) callback(err, created);
        res.status(201)
            .location('/' + name.toLowerCase() + '/' + created._id)
            .send(name + ' created');
    });
};

var handlePost = function(req, res, name, model, requiredFields, optionalFields) {
    // Used to simplify POST /<name>s methods
    //
    // name: string, used in logs and error strings, and building location header URLs
    // model: mongoose model
    // requiredFields: mandatory field names and functions to check them, in format:
    //                  [{
    //                      name: 'fieldName',
    //                      checkFunction: function(fieldValue) {
    //                                          return true or false to denote if
    //                                          the field is acceptable
    //                                     }
    //                    }, {...}, ...]
    // optionalFields: optional field names and their default values if not provided in
    //                 POST body; checkFunction is optional. in format:
    //                  [{
    //                      name: 'fieldName',
    //                      defaultValue: value,
    //                      checkFunction: function(fieldValue) {
    //                                          return true or false to denote if
    //                                          the field is acceptable
    //                                     }
    //                   }, {...}, ...]

    if(isUndefined(optionalFields)) optionalFields = [];

    var toCreate = {}, failed = false, failedField = null;
    requiredFields.map(function (field) {
        var value = req.body[field.name];
        if (field.checkFunction(value)) {
            toCreate[field.name] = value;
        } else {
            failed = true;
            failedField = field;
        }
    });
    if(failed) {
        res.status(400).send('Mandatory field [' + failedField.name + '] checking failed');
        return;
    }
    optionalFields.map(function (field){
        var value = valueWithDefault(req.body[field.name], field.defaultValue);
        if (isUndefined(field.checkFunction) || field.checkFunction(value)) {
            toCreate[field.name] = value;
        } else {
            failed = true;
            failedField = field;
        }
    });
    if(failed) {
        res.status(400).send('Optional field [' + failedField.name + '] checking failed');
        return;
    }

    handleCreate(res, toCreate, name, model);
};

var findByIdAndUpdate = function(res, documentId, toUpdate, name, model) {
    model.findOneAndUpdate(
        { _id: documentId },
        { '$set': toUpdate },
        function(err, original) {
            if(err) {
                res.status(500).send(name + ' update failed');
                logger('DB error when updating ' + name, err);
                return;
            }
            if(!original) {
                res.status(404).send(name + ' '  + documentId + ' does not exist');
                return;
            }
            res.status(200).send(name + ' updated');
        }
    );
};

var parseAcceptLanguage = function(al) {
    var regex = /((([a-zA-Z]+(-[a-zA-Z]+)?)|\*)(;q=[0-1](\.[0-9]+)?)?)*/g;
    var strings = (al || "").match(regex);
    return strings.map(function(m){
        if(!m){
            return;
        }

        var bits = m.split(';');
        var ietf = bits[0].split('-');

        return {
            code: ietf[0],
            region: ietf[1],
            quality: bits[1] ? parseFloat(bits[1].split('=')[1]) : 1.0
        };
    }).filter(function(r){
        return r;
    }).sort(function(a, b){
        return b.quality - a.quality;
    });
};

var render = function(name, params) {
    return function(req, res) {
        var languages = parseAcceptLanguage(req.headers['accept-language']);
        var translation = {};
        for(var i = 0; i < languages.length; i++) {
            if(languages[i].code === 'en') break;  // English is the default
            try {
                translation = require('./translation/' + languages[i].code + '.js');
                break;
            } catch (err) {}
        }
        if(!params) params = {};
        params.translation = JSON.stringify(translation);
        res.render(name, params);
    };
};

app.get('/', render('node'));
app.get('/index.html', render('node'));
app.get('/dashboard.html', render('dashboard'));
app.get('/project.html', render('project'));
app.get('/single.html', render('single', {single: true}));
app.get('/tag.html', render('tag'));
app.get('/user.html', render('user'));
app.get('/login.html', render('login'));

app.get('/nodes', function(req, res) {
    var q = {}, projects = [];
    // req.user.projects are populated so extract only ids
    req.user.projects.map(function(project){
        projects.push(project._id);
    });
    if(req.user.role !== 'Root') {
        q = {project: {$in: projects}};
    }
    handlePluralGet(req, res,
        'node', db.Node, q,
        [
            {
                methodName: 'populate',
                arguments: ['tags region idc project', 'name']
            }
        ]);
});

var isIPandPort = function(s) {
    // Some old versions of nodejs don't support `endsWith`
    //if (s.endsWith(':')){ return false }
    if (s[s.length-1] === ':'){ return false }
    var addr = s.split(':')[0],
        port = s.split(':')[1];  // could be `undefined`
    return (
        validator.isIP(addr) &&
        (!port || validator.isInt(port))
    )
};

// nodeCommander communicates with nodes to enable or disable monitor items.
// nodes: ["ip:port", ...]
// enables: ["item", ...]
// disables: ["item", ...]
var nodeCommander = function(nodes, enables, disables) {
    logger('Command to Diamond: nodes:', nodes, ', enables:', enables,
           ', disables:', disables);
    enables = enables.filter(function (en) {
        return en != null && typeof en === 'string' && en.trim() !== '';
    }).map(function(en){
        return ({
            "name": en.trim(),
            "config": {}
        });
    });
    disables = disables.filter(function (dis) {
        return dis != null && typeof dis === 'string' && dis.trim() !== '';
    }).map(function(dis){
        return ({
            "name": dis.trim(),
            "config": {}
        });
    });
    async.map(
        nodes,
        function(n, map_callback) {
            var addr = n.split(':')[0],
                port = n.split(':')[1];
            if (!port) {
                port = config.webServer.defaultDiamondPort;
            }
            request({
                    method: "POST",
                    url: 'http://' + addr + ':' + port + '/collector/enabled',
                    timeout: 30 * 1000, // 30s
                    json: true,
                    headers: {
                        "content-type": "application/json"
                    },
                    body: {
                        "enable": enables,
                        "disable": disables
                    }
                },
                function (err, resp, body) {
                    logger('Node command results:', err, JSON.stringify(body));
                }
            );
        },
        function (err, _) {
            if (err) {
                logger(err)
            }
        }
    )
};

// Find document by name from collection model `databaseModel`,
// if `insertIfNotExist` is true, then insert if not exist
// `additionalDefaults` are some additional parameters when inserting new documents,
// return results via callback
var documentFromName = function (name, databaseModel, insertIfNotExist, callback, additionalDefaults) {
    if(isUndefined(insertIfNotExist)) {
        insertIfNotExist = false;
    }
    var result;  // now undefined
    databaseModel.findOne({name: name},
        function(err, doc) {
            var needCreate = false;
            if (!err) {
                if(doc === null && insertIfNotExist) {
                    needCreate = true;

                    var toCreate = {name: name};
                    if(additionalDefaults) {
                        for (var k in additionalDefaults) {
                            toCreate[k] = additionalDefaults[k];
                        }
                    }
                    databaseModel.create(toCreate,
                        function(err, doc) {
                            if(!err) {
                                result = doc;
                            }
                            return callback(err, doc);
                        }
                    );
                }
                result = result || doc;
            }
            // if needCreate === true, callback is called in
            // databaseModel.create, so don't call it again here
            if(!needCreate) {
                return callback(err, result);
            }
        }
    );
};

app.post('/nodes', function(req, res) {
    var name = req.body.name,
        description = valueWithDefault(req.body.description, ''),
        ips = req.body.ips,
        tags = valueWithDefault(req.body.tags, ['']),
        region = req.body.region,
        idc = req.body.idc,
        project = req.body.project;

    if (!name) {
        res.status(400).send("Must specify a name");
        return;
    }

    if (isUndefined(ips) || ips.constructor !== Array) {
        res.status(400).send("IP address is required for adding new nodes");
        return;
    }
    ips = ips.filter(isIPandPort);
    if (ips.length===0) {
        res.status(400).send("At least one valid IP address is required");
        return;
    }
    if ((!region) || (!idc) || (!project)) {
        res.status(400).send("Region/IDC/Project fields are all mandatory");
        return;
    }

    if (tags.constructor !== Array) {
        res.status(400).send('Invalid tag format');
        return;
    }

    async.parallel([  // expand region, idc, project to corresponding documents
        function (callback) {
            documentFromName(region, db.Region, true, callback);
        },
        function (callback) {
            documentFromName(idc, db.Idc, true, callback);
        },
        function (callback) {
            documentFromName(project, db.Project, true, callback, {leader: null});
        }
    ],  function(err, results) {
            if(err) {
                res.status(500).send('Some database error');
                logger(err);
                return;
            }
            var region_doc = results[0],
                idc_doc = results[1],
                project_doc = results[2];
            async.map(tags,
                function (tag, map_callback) {
                    documentFromName(tag, db.Tag, false, map_callback);
                },
                function (err, results) {
                    var monitorItems = [];
                    tags = results.filter(
                        function (t) {
                            if (t) {
                                monitorItems = setMerge(monitorItems, t.monitorItems);
                                return true;
                            } else {
                                return false;
                            }
                        }
                    );
                    handleCreate(res, {
                        name: name,
                        description: description,
                        ips: ips,
                        tags: tags,
                        region: region_doc,
                        idc: idc_doc,
                        project: project_doc,
                        state: 'Good'
                    }, 'Node', db.Node);
                    if (monitorItems.length !== 0) {
                        nodeCommander(ips, monitorItems, []);
                    }
                });
        }
    );
});

app.put('/node/:node_id', function (req, res) {
    var node_id = req.params.node_id;
    modifyNode(node_id, req, res);
});

// FIXME too long a function
var modifyNode = function(node_id, req, res) {
    var name = req.body.name,
        description = req.body.description,
        ips = req.body.ips,
        tags = valueWithDefault(req.body.tags, null),
        region = req.body.region,
        idc = req.body.idc,
        project = req.body.project,
        judgeEnabled = req.body.judgeEnabled !== 'false',
        ignoredAlarms = req.body.ignoredAlarms;
    var update = {};
    if (ips) {
        ips = ips.filter(isIPandPort);
        if (ips.length === 0) {
            res.status(400).send("At least one valid IP address is required");
            return;
        }
    }
    if (name) update.name = name;
    if (description) update.description = description;
    if (ips) update.ips = ips;
    if (tags !== null && tags.constructor !== Array) {
        res.status(400).send('Invalid tag format');
        return;
    }
    update.judgeEnabled = judgeEnabled;
    if(ignoredAlarms && ignoredAlarms.length === 1 && ignoredAlarms[0] === '') {
        ignoredAlarms = [];
    }
    update.ignoredAlarms = ignoredAlarms;

    async.parallel([  // expand region, idc, project to corresponding documents
            function (callback) {
                if(region) {
                    documentFromName(region, db.Region, true, callback);
                } else {
                    callback(null, null);
                }
            },
            function (callback) {
                if(idc) {
                    documentFromName(idc, db.Idc, true, callback);
                } else {
                    callback(null, null);
                }
            },
            function (callback) {
                if(project) {
                    documentFromName(project, db.Project, true, callback, {leader: null});
                } else {
                    callback(null, null);
                }
            }
        ], function(err, results) {
            if(err) {
                res.status(500).send('Some database error');
                logger(err);
                return;
            }
            if(results[0]) update.region = results[0];
            if(results[1]) update.idc = results[1];
            if(results[2]) update.project = results[2];
            if(!tags) {
                findByIdAndUpdate(res, node_id, update, 'Node', db.Node);
                return;
            }
            async.map(tags,
                function(tag, map_callback){
                    documentFromName(tag, db.Tag, false, map_callback);
                },
                function(err, results) {
                    var updatedMonitorItems = [];
                    update.tags = results.filter(
                        function (t) {
                            if (t) {
                                updatedMonitorItems = setMerge(updatedMonitorItems, t.monitorItems);
                                return true;
                            } else {
                                return false;
                            }
                        }
                    );
                    db.Node.findOneAndUpdate(
                        { _id: node_id },
                        { '$set': update },
                        function (err, n) {
                            // n is the original node record before update
                            if(err) {
                                res.status(500).send('Existence checking failed');
                                logger(err);
                                return
                            }
                            if(!n) {
                                res.status(404).send(node_id + ' does not exist');
                                return
                            }
                            async.map(n.tags, // n.tags is an array of ids
                                function (tag, map_callback) {
                                    db.Tag.findById(tag,
                                        function (err, t) {
                                            if (err) {
                                                logger(err);
                                                return;
                                            }
                                            map_callback(null, t);
                                        });
                                },
                                function (err, results) {
                                    var originalMonitorItems = [];
                                    results.map(function (t) {
                                            if (t) {
                                                originalMonitorItems = setMerge(originalMonitorItems, t.monitorItems);
                                            }
                                        }
                                    );
                                    var toDisable = setDiff(originalMonitorItems, updatedMonitorItems);
                                    var toEnable = setDiff(updatedMonitorItems, originalMonitorItems);
                                    if(!(toEnable.length === 0 && toDisable.length === 0)) {
                                        nodeCommander(n.ips, toEnable, toDisable);
                                    }
                                    if(ips) {
                                        var newIPs = ips.filter(function(ip){
                                            return n.ips.indexOf(ip) === -1;
                                        });
                                        if(newIPs.length !== 0) {
                                            nodeCommander(newIPs, updatedMonitorItems, []);
                                        }
                                    }
                                }
                            );
                            res.status(200).send('Node updated');
                        }
                    );
                }
            );
        }
    );
};

app.get('/node/:node_id',function(req, res) {
    handleGetById(req, res, 'node', db.Node,
        [
            {
                methodName: 'populate',
                // return only names for them
                arguments: ['tags region idc project', 'name']
            }
        ]
    );
});

app.get('/node/:node_id/ips', function(req, res) {
    var node_id = req.params.node_id;
    db.Node.findOne({
        _id: node_id
    }, {ips: 1}, function (err, found){
        if(err) {
            res.status(500).send('Error fetching node IPs');
            return;
        }
        if(!found) {
            res.send({});
            return;
        }
        res.send(found);
    });
});

// Add tags to filtered nodes on `Nodes` page
app.post('/node/tags', function (req, res) {
    var project = req.body.project,
        region = req.body.region,
        idc = req.body.idc,
        node = req.body.keywords,
        tags = req.body.tags;
    var user_id = req.user._id;

    // TODO: copied from `queryNode` and modified accordingly, should refactor
    async.parallel([  // expand region, idc, and project to db documents
        function(callback) {
            if(notUndefined(region)) {
                documentFromName(region, db.Region, false, callback);
            } else {
                callback(null, null);
            }
        },
        function(callback) {
            if(notUndefined(idc)) {
                documentFromName(idc, db.Idc, false, callback);
            } else {
                return callback(null, null);
            }
        },
        function(callback) {
            if(notUndefined(project)) {
                documentFromName(project, db.Project, false, callback);
            } else {
                return callback(null, null);
            }
        }
    ], function(err, results) {
        var regionDoc = results[0],
            idcDoc = results[1],
            projectDoc = results[2];

        if(project && req.user.role !== 'Root') {
            var projectFiltered = req.user.projects.filter(function(userProject){
                if(!projectDoc || !userProject) return false;
                // projectDoc._id is an ObjectId and userProject._id is a string
                return projectDoc._id.equals(userProject._id);
            });
            if(projectFiltered.length === 0) {
                res.status(403).send('User is not allowed to access this project');
                return;
            }
        }
        var filter = {}, projects = [];
        if(regionDoc) filter['region'] = regionDoc._id;
        if(idcDoc) filter['idc'] = idcDoc._id;
        // if project is assigned, filter as requested,
        // otherwise filter with user's projects
        if(projectDoc) {
            filter['project'] = projectDoc._id;
        } else if(req.user.role !== 'Root') {
            // req.user.projects are populated so extract only ids
            req.user.projects.map(function(project){
                projects.push(project._id);
            });
            filter['project'] = { $in: projects };
        }
        async.map(
            node.split(' '),
            function(s, map_callback){
                async.parallel([
                        function (callback) {
                            var tagRegExp;
                            if(s.indexOf(':') !== -1) { // handle 'tag:xxx'
                                var k = s.split(':')[0],
                                    v = s.split(':')[1];
                                if(k === 'tag') {
                                    tagRegExp = new RegExp(v, 'i');
                                } else {
                                    callback(null, []);
                                    return;
                                }
                            } else {
                                tagRegExp = new RegExp(s, 'i');
                            }
                            var q = {name: tagRegExp};
                            db.Tag.find(q, {_id: 1}, // only return id
                                function (err, tags) {
                                    if (err) {
                                        callback(err, {});
                                    }
                                    var ids = tags.map(function (tag) {
                                        return tag._id;
                                    });
                                    var nodeFilter = {tags: {$in: ids}};
                                    for(var k in filter) {
                                        nodeFilter[k] = filter[k];
                                    }
                                    db.Node.find(nodeFilter,
                                        function (err, nodes) {
                                            if (err) {
                                                callback(err, {});
                                            }
                                            callback(null, nodes);
                                        }).populate('tags region idc project', 'name');
                                }
                            );
                        },
                        function (callback) {
                            var q = {};
                            if(s.indexOf(':') !== -1) { // handle 'name:xxx' and 'ip:xxx'
                                var k = s.split(':')[0],
                                    v = s.split(':')[1];
                                if(k === 'name') {
                                    q.name = new RegExp(v, 'i');
                                } else if(k === 'ip') {
                                    q.ips = new RegExp(v, 'i');
                                } else {
                                    callback(null, []);
                                    return;
                                }
                            } else {
                                var sregx = new RegExp(s, 'i');
                                q = { $or: [
                                    {name: sregx},
                                    {ips: sregx}
                                ]};
                            }
                            for(var k in filter) {
                                q[k] = filter[k];
                            }
                            db.Node.find(q,
                                function (err, nodes) {
                                    callback(err, nodes);
                                }).populate('tags region idc project', 'name');
                        }
                    ],
                    function(err, r){
                        if(err){
                            logger(err);
                            res.status(500).send("Cannot complete your query");
                            return;
                        }
                        var uniq_nodes = {};
                        r.map(function(nodes){
                            nodes.map(function (node) {
                                uniq_nodes[node._id] = node;
                            });
                        });
                        map_callback(null, uniq_nodes);
                    });
            },
            function(err, results) {
                var ans = results.reduce(
                    function(pre, curr, index, array){
                        if(pre == null){
                            return curr;
                        } else {
                            var ans = {};
                            // intersection of pre and curr
                            for (var p in pre) {
                                if (curr[p] != undefined){
                                    ans[p] = pre[p];
                                }
                            }
                            return ans;
                        }
                    },
                    null
                );
                var resultNodes = [];
                for (var k in ans) {
                    resultNodes.push(ans[k]);
                }
                async.map(tags, function (t, callback) {
                    if(t === '') return callback(null, null);
                    documentFromName(t, db.Tag, false, callback);
                }, function (err, results) {
                    var toEnable = [];
                    var tagIDs = results.filter(function (r) {
                        return r != null
                    }).map(function (r) {
                        toEnable = setMerge(toEnable, r.monitorItems);
                        return r._id;
                    });
                    if(tagIDs.length === 0) return;
                    if(resultNodes.length === 0) return;

                    resultNodes.map(function (node) {
                        var currentTags = node.tags.map(function (tag) {
                            return String(tag._id);
                        });
                        var tagsToAdd =  tagIDs.filter(function (tagID) {
                            return currentTags.indexOf(String(tagID)) === -1;
                        });
                        db.Node.findByIdAndUpdate(node._id,
                            { $push: { tags: {$each: tagsToAdd}}},
                            function (err, u) {
                                if(err) {
                                    logger('Batch tag add failed', err);
                                }
                                if(toEnable.length > 0) {
                                    nodeCommander(u.ips, toEnable, []);
                                }
                            }
                        )
                    });
                });
                res.status(200).send('Tags added');
            }
        );
    });
});

app.get('/node/:node_id/alarms', function(req, res) {
    var node_id = req.params.node_id;
    db.Node.findById(node_id, function(err, node) {
        if(err) {
            res.status(500).send('Error fetching node');
            return;
        }
        res.send(node.alarms);
    }).populate('alarms', 'timestamp message');
});

app.get('/node/:node_id/alarm-history', function(req, res) {
    var node_id = req.params.node_id;
    db.Node.findById(node_id, function(err, node) {
        if(err) {
            res.status(500).send('Error fetching node');
            return;
        }
        res.send(node.alarmHistory);
    }).populate('alarmHistory', 'timestamp message');
});

// Get graphs for specific node, for current user
app.get('/node/:node_id/graphs', function (req, res) {
    var node_id = req.params.node_id,
        user_id = req.user._id;
    db.Node.findOne({
        _id: node_id,
        'graphInfo.user': user_id
    }, {'graphInfo.$': 1}, function (err, found) {
        if(err) {
            res.status(500).send('Error fetching node');
            return;
        }
        if(!found) {
            res.send([]); // found would be null if not found
            return;
        }
        async.map(found.graphInfo[0].graphs,
            function(graphId, map_callback) {
                db.Graph.findById(graphId, map_callback);
            },
            function (err, results) {
                if(err) {
                    res.status(500).send('Error fetching graph');
                    return;
                }
                res.send(results);
            }
        );
    });
});

// Add a new graph for specific node, for current user
app.post('/node/:node_id/graphs', function (req, res){
    var node_id = req.params.node_id,
        user_id = req.user._id;
    var type = valueWithDefault(req.body.type, 'Line'),
        ips = req.body.ips,
        metrics = req.body.metrics,
        title = valueWithDefault(req.body.title, '');
    if(!metrics || metrics.constructor !== Array || metrics.length === 0) {
        res.status(400).send('Missing metrics or bad format');
        return;
    }
    db.Graph.create({
        type: type,
        ips: ips,
        metrics: metrics,
        title: title
    }, function(err, created){
        if(err) {
            res.status(500).send('Graph create failed');
            return;
        }
        db.Node.findOne({
            _id: node_id,
            'graphInfo.user': user_id
        }, {'graphInfo.$': 1}, function(err, found){
            if(err) {
                res.status(500).send('Error fetching node');
                return;
            }
            if(!found) { // user's graphInfo for this node does not exist yet
                db.Node.findById(node_id, function(err, node){
                    if(err) {
                        res.status(500).send('Error fetching node');
                        return;
                    }
                    if(!node) {
                        res.status(400).send('Node ' + node_id + ' does not exist');
                        return;
                    }
                    node.graphInfo.push({
                        user: user_id,
                        graphs: [created]
                    });
                    node.save(function(err, node){
                        if(err) {
                            res.status(500).send('Error saving node graphInfo: ' + err);
                            return;
                        }
                        res.status(201)
                            .location('/graph/' + created._id)
                            .send('Graph added for node ' + node_id + ' user ' + user_id);
                    });
                });
            } else { // user's graphInfo exists, needs update
                var graphs = found.graphInfo[0].graphs;
                graphs.push(created);

                db.Node.findOneAndUpdate({
                    _id: node_id,
                    "graphInfo.user": user_id
                }, {
                    $set: {
                        "graphInfo.$.graphs": graphs
                    }
                }, function(err, n){
                    if(err) {
                        res.status(500).send('Error saving node graphInfo: ' + err);
                        return;
                    }
                    res.status(201)
                        .location('/graph/' + created._id)
                        .send('Graph added for node ' + node_id + ' user ' + user_id);
                });
            }
        });
    });
});

app.delete('/node/:node_id/graph/:graph_id', function(req, res) {
    var node_id = req.params.node_id,
        graph_id = req.params.graph_id,
        user_id = req.user._id;
    db.Node.findOne({
        _id: node_id,
        'graphInfo.user': user_id
    }, {'graphInfo.$': 1}, function(err, found){
        if(err) {
            res.status(500).send('Error fetching node');
            return;
        }
        if(!found) {
            res.status(400).send('Node graph not found');
            return;
        }
        var graphs = found.graphInfo[0].graphs.filter(function(graph) {
            return !graph.equals(graph_id);
        });
        if(graphs.length !== found.graphInfo[0].graphs.length-1) {
            res.status(400).send('Graph not found for node');
            return;
        }
        db.Node.findOneAndUpdate({
            _id: node_id,
            'graphInfo.user': user_id
        }, {
            $set: {
                'graphInfo.$.graphs': graphs
            }
        }, function(err, n) {
            if(err) {
                res.status(500).send('Error saving node graphInfo: ' + err);
                return;
            }
            handleDeleteById(req, res, 'graph', db.Graph);
        });

    });
});

app.delete('/node/:node_id', function(req, res) {
    var node_id = req.params.node_id;
    db.Node.findById(node_id, function(err, node) {
        logger('User', req.session.user, 'deletes node', node.name, node.ips);
        handleDeleteById(req, res, 'node', db.Node);
    });
});

app.get('/tags', function(req, res) {
    handlePluralGet(req, res,
        'tag', db.Tag, {}, []);
});

app.post('/tags', function (req, res) {
    handlePost(req, res, 'Tag', db.Tag,
        [{
            name: 'name',
            checkFunction: notUndefined
        }],
        [
            {
                name: 'monitorItems',
                defaultValue: [],
                checkFunction: isArray
            },
            {
                name: 'alarmRule',
                defaultValue: '',
                checkFunction: notUndefined
            },
            {
                name: 'periodicJob',
                defaultValue: '',
                checkFunction: notUndefined
            },
            {
                name: 'alarmReceivers',
                defaultValue: [],
                checkFunction: isArray
            }
        ]
    );
});

app.get('/tag/:tag_id', function(req, res){
    handleGetById(req, res, 'tag', db.Tag);
});

app.get('/tag/:tag_id/errors', function(req, res) {
    var tag_id = req.params.tag_id;
    db.Tag.findById(tag_id, function(err, tag) {
        if(err) {
            res.status(500).send('Error fetching tag');
            return;
        }
        res.send(tag.evaluationErrors);
    })
});

app.put('/tag/:tag_id', function(req, res){
    var tag_id = req.params.tag_id;
    var name = req.body.name,
        monitorItems = req.body.monitorItems,
        periodicJob = req.body.periodicJob,
        alarmRule = req.body.alarmRule,
        alarmReceivers = req.body.alarmReceivers;
    var update = {};
    if(name) update.name = name;
    if(monitorItems && monitorItems.constructor === Array) {
        update.monitorItems = monitorItems
    }
    if(periodicJob) update.periodicJob = periodicJob;
    if(alarmRule) update.alarmRule = alarmRule;
    if(alarmReceivers && alarmReceivers.constructor === Array) {
        update.alarmReceivers = alarmReceivers
    }
    db.Tag.findOneAndUpdate(
        { _id: tag_id },
        { '$set': update },
        function (err, t) {  // t is the original tag record
            if(err) {
                res.status(500).send('Existence checking failed');
                logger(err);
                return
            }
            if(!t) {
                res.status(404).send(tag_id + ' does not exist');
                return
            }
            if(update.monitorItems) {
                db.Node.find({tags: t._id},
                    function(err, nodes) {
                        if(err) {
                            logger('fetching nodes by tag', err);
                        }
                        var nodeAddrs = [];
                        nodes.map(function(n){
                            nodeAddrs = nodeAddrs.concat(n.ips)
                        });
                        var toDisable = setDiff(t.monitorItems, update.monitorItems),
                            toEnable = setDiff(update.monitorItems, t.monitorItems);
                        if(!(toEnable.length === 0 && toDisable.length === 0)) {
                            nodeCommander(nodeAddrs, toEnable, toDisable);
                        }
                    }
                )
            }
            res.status(200).send('Updated');
        }
    )
});

app.delete('/tag/:tag_id', function(req, res) {
    var tag_id = req.params.tag_id;
    db.Tag.findById(tag_id, function(err, tag) {
        logger('User', req.session.user, 'deletes tag', tag.name, tag.monitorItems);
        handleDeleteById(req, res, 'tag', db.Tag);
    });
});

var queryNode = function(req, res) {
    var skip = valueWithDefault(req.query.skip, 0),
        limit = valueWithDefault(req.query.limit, 15),
        node = req.query.node,
        region = req.query.region,
        idc = req.query.idc,
        project = req.query.project;
    skip = parseInt(skip);
    limit = parseInt(limit);

    async.parallel([  // expand region, idc, and project to db documents
        function(callback) {
            if(notUndefined(region)) {
                documentFromName(region, db.Region, false, callback);
            } else {
                callback(null, null);
            }
        },
        function(callback) {
            if(notUndefined(idc)) {
                documentFromName(idc, db.Idc, false, callback);
            } else {
                return callback(null, null);
            }
        },
        function(callback) {
            if(notUndefined(project)) {
                documentFromName(project, db.Project, false, callback);
            } else {
                return callback(null, null);
            }
        }
    ], function(err, results) {
        var regionDoc = results[0],
            idcDoc = results[1],
            projectDoc = results[2];

        if(project && req.user.role !== 'Root') {
            var projectFiltered = req.user.projects.filter(function(userProject){
                if(!projectDoc || !userProject) return false;
                // projectDoc._id is an ObjectId and userProject._id is a string
                return projectDoc._id.equals(userProject._id);
            });
            if(projectFiltered.length === 0) {
                res.status(403).send('User is not allowed to access this project');
                return;
            }
        }
        var filter = {}, projects = [];
        if(regionDoc) filter['region'] = regionDoc._id;
        if(idcDoc) filter['idc'] = idcDoc._id;
        // if project is assigned, filter as requested,
        // otherwise filter with user's projects
        if(projectDoc) {
            filter['project'] = projectDoc._id;
        } else if(req.user.role !== 'Root') {
            // req.user.projects are populated so extract only ids
            req.user.projects.map(function(project){
                projects.push(project._id);
            });
            filter['project'] = { $in: projects };
        }
        async.map(
            node.split(' '),
            function(s, map_callback){
                async.parallel([
                        function (callback) {
                            var tagRegExp;
                            if(s.indexOf(':') !== -1) { // handle 'tag:xxx'
                                var k = s.split(':')[0],
                                    v = s.split(':')[1];
                                if(k === 'tag') {
                                    tagRegExp = new RegExp(v, 'i');
                                } else {
                                    callback(null, []);
                                    return;
                                }
                            } else {
                                tagRegExp = new RegExp(s, 'i');
                            }
                            var q = {name: tagRegExp};
                            db.Tag.find(q, {_id: 1}, // only return id
                                function (err, tags) {
                                    if (err) {
                                        callback(err, {});
                                    }
                                    var ids = tags.map(function (tag) {
                                        return tag._id;
                                    });
                                    var nodeFilter = {tags: {$in: ids}};
                                    for(var k in filter) {
                                        nodeFilter[k] = filter[k];
                                    }
                                    db.Node.find(nodeFilter,
                                        function (err, nodes) {
                                            if (err) {
                                                callback(err, {});
                                            }
                                            callback(null, nodes);
                                        }).populate('tags region idc project', 'name');
                                }
                            );
                        },
                        function (callback) {
                            var q = {};
                            if(s.indexOf(':') !== -1) { // handle 'name:xxx' and 'ip:xxx'
                                var k = s.split(':')[0],
                                    v = s.split(':')[1];
                                if(k === 'name') {
                                    q.name = new RegExp(v, 'i');
                                } else if(k === 'ip') {
                                    q.ips = new RegExp(v, 'i');
                                } else {
                                    callback(null, []);
                                    return;
                                }
                            } else {
                                var sregx = new RegExp(s, 'i');
                                q = { $or: [
                                    {name: sregx},
                                    {ips: sregx}
                                ]};
                            }
                            for(var k in filter) {
                                q[k] = filter[k];
                            }
                            db.Node.find(q,
                                function (err, nodes) {
                                    callback(err, nodes);
                                }).populate('tags region idc project', 'name');
                        }
                    ],
                    function(err, r){
                        if(err){
                            logger(err);
                            res.status(500).send("Cannot complete your query");
                            return;
                        }
                        var uniq_nodes = {};
                        r.map(function(nodes){
                            nodes.map(function (node) {
                                uniq_nodes[node._id] = node;
                            });
                        });
                        map_callback(null, uniq_nodes);
                    });
            },
            function(err, results) {
                var ans = results.reduce(
                    function(pre, curr, index, array){
                        if(pre == null){
                            return curr;
                        } else {
                            var ans = {};
                            // intersection of pre and curr
                            for (var p in pre) {
                                if (curr[p] != undefined){
                                    ans[p] = pre[p];
                                }
                            }
                            return ans;
                        }
                    },
                    null
                );
                var resultNodes = [];
                for (var k in ans) {
                    resultNodes.push(ans[k]);
                }
                var returnObject = {
                    total: resultNodes.length,
                    skip: skip,
                    limit: limit,
                    result: resultNodes.slice(skip, skip + limit)
                };
                res.setHeader('Content-Type', 'application/json');
                res.status(200).send(returnObject);
            }
        );
    });
};

var queryTag = function(req, res) {
    var query = req.query.tag;
    var sregx = new RegExp(query.trim(), 'i');
    var q = {name: sregx};
    handlePluralGet(req, res,
        'tag', db.Tag, q, []);
};

var queryUser = function(req, res) {
    var user = req.query.user,
        project = req.query.project;
    var sregx = new RegExp(user.trim(), 'i');
    var q = {name: sregx};
    if(notUndefined(project)) {
        documentFromName(project, db.Project, false, function(err, p){
            if(!err && p) q.projects = {'$in': [p._id]};

            handlePluralGet(req, res,
                'user', db.User, q,
                [{
                    methodName: 'populate',
                    arguments: [userPopulateArgument.path,userPopulateArgument.select]
                }]);
        })
    } else {
        handlePluralGet(req, res,
            'user', db.User, q,
            [{
                methodName: 'populate',
                arguments: [userPopulateArgument.path,userPopulateArgument.select]
            }]);
    }
};

var queryOauthUser = function(req, res) {
    var query = req.query.oauthuser;
    if (query.length < 3) {
        // Only send request to OAuth server if more than 2 letters in query,
        // otherwise the response would be VERY SLOW(by @lidezhi)
        res.send([]);
        return
    }
    request({
        rejectUnauthorized: false,  // same reason as app.post('/login')
        method: 'GET',
        url: 'https://oauth.lecloud.com/watchtvgetldapuser?username='
        + query + '&appid=watchtv&appkey=watchtv&limit=5',
        json: true,
        timeout: 10 * 1000
    },
        function(err, resp, body) {
            if(err) {
                logger('Error connecting to OAuth server');
                res.status(500).send('Error connecting to OAuth server');
                return
            }
            var result = body.map(function(user){
                // get user name from email address
                return user.email.split('@')[0]
            });
            res.send(result)
        }
    );
};

var queryProject = function(req, res) {
    var project = req.query.project;
    var sregx = new RegExp(project.trim(), 'i');
    var q = {name: sregx};
    handlePluralGet(req, res,
        'project', db.Project, q,
        [{
            methodName: 'populate',
            arguments: ['leader', 'name']
        }]);
};

var queryRegion = function(req, res) {
    var region = req.query.region;
    var sregx = new RegExp(region.trim(), 'i');
    var q = {name: sregx};
    handlePluralGet(req, res,
        'region', db.Region, q, []);
};

var queryIdc = function(req, res) {
    var idc = req.query.idc;
    var sregx = new RegExp(idc.trim(), 'i');
    var q = {name: sregx};
    handlePluralGet(req, res,
        'idc', db.Idc, q, []);
};

var queryMonitoredItems = function(req, res) {
    var collectors = [
        "CephCollector",
        "LoadAverageCollector",
        "CPUCollector",
        "DiskSpaceCollector",
        "DiskUsageCollector",
        "NetworkCollector",
        "MemoryCollector"
    ];
    var query = req.query.monitored.toLowerCase();
    res.send(collectors.filter(function(c){
        return c.toLowerCase().indexOf(query) !== -1;
    }))
};

// For "Find anything"
app.get('/q', function(req, res) {
    if (req.query.node != undefined) {
        // /q?node=xxx
        queryNode(req, res);
    } else if (req.query.tag != undefined) {
        // /q?tag=xxx
        queryTag(req, res);
    } else if (req.query.user != undefined) {
        // /q?user=xxx
        queryUser(req, res);
    } else if (req.query.oauthuser != undefined) {
        // /q?oauthuser=xxx
        // for auto-complete of user names
        queryOauthUser(req, res);
    } else if (req.query.project != undefined) {
        // /q?project=xxx
        queryProject(req, res);
    } else if (req.query.region != undefined) {
        // q?region=xxx
        queryRegion(req, res);
    } else if (req.query.idc != undefined) {
        // q?idc=xxx
        queryIdc(req, res);
    } else if (req.query.monitored) {
        // q?monitored=xxx
        // for auto-complete of `Monitored Items`
        queryMonitoredItems(req, res);
    } else {
        res.status(400).send("Invalid query");
    }
});

app.get('/users', requireLeader, function(req, res) {
    handlePluralGet(req, res,
        'user', db.User, {},
        [{
            methodName: 'populate',
            arguments: [userPopulateArgument.path,userPopulateArgument.select]
        }]
    )
});

app.post('/users', requireLeader,
    function(req, res){
    var name = req.body.name,
        role = valueWithDefault(req.body.role, 'User'),
        projects = valueWithDefault(req.body.projects, ['']);
    if(isUndefined(name)) {
        res.status(400).send('Must specify a name');
        return
    }
    if(req.user.role === 'Leader' && role === 'Root') {
        res.status(403).send('You cannot create a Root user as Leader');
        return
    }

    request({
            rejectUnauthorized: false,  // same reason as in app.post('/login')
            method: 'GET',
            url: 'https://oauth.lecloud.com/watchtvgetldapuser?username='
                 + name + '&appid=watchtv&appkey=watchtv&limit=3',
            json: true,
            timeout: 10 * 1000
        },
        function(err, resp, body) {
            if(err) {
                logger('Error connecting to OAuth server', err);
                res.status(500).send('Error connecting to OAuth server');
                return
            }

            if(body.length > 0 && body[0].email == name+'@le.com') {
                async.map(projects,
                    function(project, map_callback) {
                        documentFromName(project, db.Project, false, map_callback);
                    },
                    function(err, results) {
                        projects = results.filter(
                            function(p) {
                                if(!p) return false;
                                if(!p.leader) return false;
                                // p.leader is an ObjectId and user._id is a string
                                return p.leader.equals(req.user._id);  // Users can only add projects
                                                                       // under their control
                            }
                        );
                        db.User.create({
                                name: name,
                                showName: '',
                                panels: [],
                                graphColumnNumber: 2,
                                graphRefreshInterval: 0,
                                role: role,
                                projects: projects
                            },
                            function(err, u) {
                                if(err) {
                                    res.status(500).send('User add failed');
                                    logger(err);
                                    return
                                }
                                logger('User added', u);
                                db.Panel.create({
                                    name: 'Default',
                                    graphs: [],
                                    owner: u._id
                                }, function (err, p) {
                                    db.User.findOneAndUpdate(
                                        {_id: u._id},
                                        {'$push': {panels: p._id}},
                                        function () {} // best effort
                                    );
                                });
                                res.status(201)
                                    .location('/user/' + u._id)
                                    .send('User added');
                            }
                        )
                    }
                )
            } else {
                res.status(400).send('User name not found from Letv OAuth');
            }
        }
    );
});

app.put('/user/:user_id', requireLeader, function(req, res){
    var user_id = req.params.user_id;
    modifyUser(user_id, req, res);
});

var modifyUser = function(user_id, req, res) {
    var name = req.body.name,
        projects = req.body.projects,
        role = req.body.role;
    var update = {};
    if(name) {
        res.status(403).send('Cannot modify user name');
        return
    }
    if(role) {
        if(req.user.role === 'Leader' && role === 'Root') {
            res.status(403).send('You cannot create a Root user as Leader');
            return
        }
        update.role = role
    }
    if(!projects) {
        findByIdAndUpdate(res, user_id, update, 'User', db.User);
        return
    }
    if(projects.constructor !== Array) {
        res.status(400).send('Invalid tag format');
        return
    }

    db.User.findOne({ _id: user_id })
           .populate('projects', 'name')
           .exec(function(err, originalUser){
                if(err) {
                    res.status(500).send("Database error");
                    return;
                }
                var originalProjectIds = originalUser.projects.map(function(project){
                    return project._id;
                });
                async.map(projects,
                    function(project, map_callback) {
                        documentFromName(project, db.Project, false, map_callback);
                    },
                    function(err, results) {
                        update.projects= results.filter(
                            function(p) {
                                if(!p) return false;

                                // If the project exists previously,
                                // it should definitely still exist
                                var existsPreviously = false;
                                for(var i=0; i<originalProjectIds.length; i++) {
                                    if(originalProjectIds[i].equals(p._id)) {
                                        existsPreviously = true;
                                        break;
                                    }
                                }
                                if(existsPreviously) return true;

                                if(!p.leader) return false;
                                // p.leader is an ObjectId and user._id is a string
                                return p.leader.equals(req.user._id);  // Users can only add projects
                                                                       // under their control
                            }
                        );
                        findByIdAndUpdate(res, user_id, update, 'User', db.User);
                    }
                );
        });
};

app.put('/preferences', function (req, res) {
    var user_id = req.user._id;
    var showName = req.body.showName,
        graphColumnNumber = req.body.graphColumnNumber,
        graphRefreshInterval = req.body.graphRefreshInterval;
    var update = {};
    if(showName != null) update.showName = showName;
    if(graphColumnNumber) {
        if(validator.isInt(graphColumnNumber)) {
            update.graphColumnNumber = graphColumnNumber;
        } else {
            res.status(400).send('Graph column number should be a number');
            return;
        }
    }
    if(graphRefreshInterval) {
        if(validator.isInt(graphRefreshInterval)) {
            update.graphRefreshInterval = graphRefreshInterval;
        } else {
            res.status(400).send('Graph refresh interval should be a number');
            return;
        }
    }
    findByIdAndUpdate(res, user_id, update, 'User preferences', db.User);
});

// for users to get info about themselves
app.get('/user', function(req, res) {
    res.send(req.user); // req.user is assigned in `requireLogin`
});

// for users to get their panels and graphs on dashboard
// return value format: [panels]
app.get('/user/graphs', function(req, res) {
    db.User.findById(req.user._id, function(err, user) {
        if(err) {
            res.status(500).send('Error fetching user ' + req.user._id);
            return;
        }
        if(!user.panels) {
            res.send({});
            return;
        }
        async.map(user.panels, function(panel_id, cb) {
            db.Panel.findById(panel_id, function(err, panel) {
                if(err) {
                    cb(null, null);
                    return;
                }
                cb(null, panel);
            }).populate('graphs', 'type ips metrics title');
        }, function(err, results) {
            if(err) {
                res.status(500).send('Error fetching graphs for user ' + req.user._id);
                return;
            }
            res.send(results.filter(notNull));
        });
    });
});

// Add new projects to user
app.post('/user/:user_id/projects', function(req, res) {
    var user_id = req.params.user_id;
    var projects = req.body.projects;

    async.map(projects, function(project, map_callback) {
            documentFromName(project, db.Project, false, map_callback);
        },
        function(err, results) {
            var filtered = results.filter(function(p) {
                    if(!p) return false;

                    if(!p.leader) return false;
                    // p.leader is an ObjectId and user._id is a string
                    return p.leader.equals(req.user._id);  // Users can only add projects
                                                           // under their control
                }
            );
            db.User.findByIdAndUpdate(user_id,
                { $push: { projects: {$each: filtered} }},
                function(err, u) {
                    if(err) {
                        res.status(500).send('Adding projects to user failed');
                        return;
                    }
                    res.status(201)
                       .location('/user/' + user_id)
                       .send('Projects added to user');
                }
            )
        }
    )
});

app.post('/user/panels', function(req, res) {
    var user_id = req.user._id;
    var name = valueWithDefault(req.body.name, 'Panel');

    db.Panel.create({
        name: name,
        graphs: [],
        owner: user_id
    }, function(err, created) {
        if(err) {
            res.status(500).send('Panel create failed');
            return;
        }
        db.User.findByIdAndUpdate(user_id,
            { $push: { panels: created}},
        function(err, u) {
            if(err) {
                res.status(500).send('Adding panel to user failed');
                return;
            }
            res.status(201).send('Panel added to user');
        });
    });
});

// Can only change panel name since graph manipulation is handled by /user/graph
app.put('/user/panel/:panel_id', function(req, res) {
    var user_id = req.user._id;
    var name = req.body.name;
    var panel_id = req.params.panel_id;
    var update = { name: name };

    ensureUserOwnsPanel(user_id, panel_id, req, res, function () {
        findByIdAndUpdate(res, panel_id, update, 'Panel', db.Panel);
    });
});

// add new graph to current user
app.post('/user/graphs', function(req, res) {
    var type = valueWithDefault(req.body.type, 'Line'),
        ips = req.body.ips,
        metrics = req.body.metrics,
        title = valueWithDefault(req.body.title, ''),
        panel_id = req.body.panel_id;
    if(!metrics || metrics.constructor !== Array || metrics.length === 0) {
        res.status(400).send('Missing metrics or bad format');
        return;
    }
    if(!panel_id) {
        res.status(400).send('Missing panel_id');
        return;
    }
    db.Graph.create({
        type: type,
        ips: ips,
        metrics: metrics,
        title: title
    }, function(err, created) {
        if(err) {
            res.status(500).send('Graph create failed');
            return;
        }
        db.Panel.findByIdAndUpdate(panel_id,
            { $push: { graphs: created }},
            function(err, u) {
                if(err) {
                    res.status(500).send('Adding graph to user failed');
                    return;
                }
                res.status(201)
                    .location('/graph/' + created._id)
                    .send('Graph added to user');
            }
        )
    });
});

// import graphs to user's dashboard
// for historical reasons, url is prefixed with /user
app.post('/user/graphs/imports', function(req, res) {
    var graphs = req.body.graphs,
        panel_id = req.body.panel_id;
    if(graphs.constructor !== Array) {
        res.status(400).send('Graphs should be an array');
        return;
    }
    if(!panel_id) {
        res.status(400).send('Missing panel_id');
        return;
    }
    for(var i=0; i<graphs.length; i++) {
        var graph = graphs[i];
        if(!graph.metrics || graph.metrics.constructor !== Array || graph.metrics.length === 0) {
            res.status(400).send('Missing metrics or bad format for graph#' + i);
            return;
        }
    }
    db.Graph.create(graphs, function(err, created){
        if(err) {
            res.status(500).send('Graph import failed');
            return;
        }
        db.Panel.findByIdAndUpdate(panel_id,
            { $push: {graphs: {$each: created}}},
            function(err, p) {
                if(err) {
                    res.status(500).send('Adding graph to user failed');
                    return;
                }
                res.status(201)
                    .location('/user/graphs')
                    .send('Graphs imported to user');
            }
        )
    })
});

app.post('/user/graph/move/:graph_id', function (req, res) {
    var graph_id = req.params.graph_id;
    var from_panel_id = req.body.from_panel_id,
        to_panel_id = req.body.to_panel_id;
    var user_id = String(req.user._id);
    if(!graph_id || !from_panel_id || !to_panel_id) {
        res.status(400).send('Missing one or some of parameters: graph_id, from_panel_id, to_panel_id');
        return;
    }
    async.map([from_panel_id, to_panel_id], function(panel_id, map_cb) {
        db.Panel.findById(panel_id, map_cb);
    }, function(err, result_panels) {
        if(err) {
            res.status(500).send('Error querying panels');
            return;
        }
        var from_panel = result_panels[0], to_panel = result_panels[1];
        if(!from_panel || !to_panel
            || String(from_panel.owner) !== user_id
            || String(to_panel.owner) !== user_id) {
            res.status(403).send("Only panel's owner could modify it");
            return;
        }
        db.Panel.findByIdAndUpdate(to_panel_id,
            { $push: { graphs: graph_id}},
            function(err, p) {
                if(err) {
                    res.status(500).send('Error modifying panel: ' + to_panel_id);
                    return;
                }
                db.Panel.findByIdAndUpdate(from_panel_id,
                    { $pull: {graphs: graph_id}},
                    function(err, p) {
                        if(err) {
                            res.status(500).send('Error modifying panel: ' + from_panel_id);
                            return;
                        }
                        res.send('Move graph successful: ' + graph_id);
                    }
                );
            }
        );
    });
});

// import panels to a user's dashboard
// pass by panel ids, i.e. by reference
app.post('/user/panels/imports', function (req, res) {
    var panels = req.body.panels;
    var user_id = req.user._id;
    db.User.findById(user_id, function (err, u) {
        var exists = false;
        var existedPanels = [];
        u.panels.forEach(function (p) {
            var panelIdString = String(p);
            if(panels.indexOf(panelIdString) !== -1) {
                exists = true;
                existedPanels.push(panelIdString);
            }
        });
        if(exists) {
            res.status(400).send('Panels already exist: ' + existedPanels);
            return;
        }
        db.User.findByIdAndUpdate(user_id,
            { $push: {panels: {$each: panels}}},
            function (err, u) {
                if(err) {
                    res.status(500).send('Adding panel to user failed');
                    return;
                }
                res.status(200).send('Panels imported to user');
            });
    })
});

var ensureUserOwnsPanel = function(user_id, panel_id, req, res, next) {
    db.Panel.findById(panel_id, function(err, panel) {
        if(err) {
            res.status(500).send('Error fetching panel ' + panel_id);
            return;
        }
        if(!panel) {
            res.status(500).send('Database returned null value');
            return;
        }
        if(String(user_id) !== String(panel.owner)) {
            res.status(403).send("Only panel's owner could delete it");
            return;
        }
        next();
    })
};

// delete panel
app.delete('/user/panel/:panel_id', function(req, res) {
    var user_id = req.user._id;
    var panel_id = req.params.panel_id;

    db.User.findByIdAndUpdate(user_id,
        { $pull: {panels: panel_id}},
        function (err, u) {
            if(err) {
                res.status(500).send('Error removing panel ' + panel_id + ' for user ' + user_id);
                return;
            }
            db.Panel.findById(panel_id, function (err, panel) {
                if(err) {
                    res.status(200).send('Error fetching panel ' + panel_id);
                    return;
                }
                if(!panel) {
                    res.status(200).send('Database returned null value');
                    return;
                }
                if(String(user_id) !== String(panel.owner)) {  // current user is not panel owner
                    res.status(200).send('Remove panel successfully');
                } else { // current user is panel owner
                    handleDeleteById(req, res, 'panel', db.Panel);
                    // TODO : also delete the graphs inside panel
                }
            });
        })
});

// delete graph with graph_id
app.delete('/user/graph/:panel_id/:graph_id', function(req, res) {
    var user_id = req.user._id;
    var panel_id = req.params.panel_id,
        graph_id = req.params.graph_id;
    ensureUserOwnsPanel(user_id, panel_id, req, res, function () {
        db.Panel.findByIdAndUpdate(panel_id,
            { $pull: {graphs: graph_id}},
            function(err, u) {
                if(err) {
                    res.status(500).send('Removing graph for user failed');
                    return;
                }
                handleDeleteById(req, res, 'graph', db.Graph);
            }
        )
    })
});

app.get('/user/:user_id', requireLeader, function(req, res) {
    handleGetById(req, res, 'user', db.User,
    [
        {
            methodName: 'populate',
            arguments: [userPopulateArgument.path, userPopulateArgument.select]
        }
    ])
});

app.delete('/user/:user_id', requireRoot,
    function(req, res) {
        var user_id = req.params.user_id;
        db.User.findById(user_id, function(err, user){
            logger('User', req.session.user, 'deletes user', user.name, user.projects);
            handleDeleteById(req, res, 'user', db.User);
        });
    }
);

app.put('/graph/:graph_id', function(req, res) {
    var graph_id = req.params.graph_id,
    graph = req.body.graph;

    // currently `graph` from client is in format {graph: graph}, so no need to reformat
    findByIdAndUpdate(res, graph_id, graph, 'Graph', db.Graph);
});

app.get('/graph/:graph_id', function(req, res) {
    handleGetById(req, res, 'graph', db.Graph)
});

app.get('/graphs/default', function(req, res) {
    db.Graph.find({type: "default"}, function (err, found) {
        if (err) {
            res.status(500).send("Cannot fetch graph default");
            logger(err);
            return
        }
        if(!found) {
            res.status(404).send("Cannot get info about graph default");
            return
        }
        res.send(found);
    });
});

app.post('/login', function(req, res) {
    var user = req.body.user,
        password = encodeURIComponent(req.body.password),
        captcha = req.body.captcha;

    if (captcha == "" || captcha.length < 1000) {
        res.status(401).send('Invalid captcha');
        return
    }
    /* FUCKING GFW
    request({
        method: "POST",
        url:"https://www.google.com/recaptcha/api/siteverify?secret=6LdhISkTAAAAAMPGl1wfbobeeQagOrmDuB_uFMDe" +
            '&response=' + captcha,
    },
        function (err, resp, body) {
            console.log(err, resp, body)
        }
    );
    */

    if(!user || !password) {
        res.status(400).send('Invalid username or password');
        return
    }
    var url = 'https://oauth.lecloud.com/nopagelogin?username=' + user +
            '&password=' + password + '&ldap=true';
    logger(url);
    request({
        rejectUnauthorized: false,// This is a workaround since the certs of
                                  // lecloud.com seems not configured properly.
                                  // Read https://github.com/coolaj86/node-ssl-root-cas
                                  // for more info.
        method: "GET",
        url: 'https://oauth.lecloud.com/nopagelogin?username=' + user +
             '&password=' + password + '&ldap=true',
        json: true,
        timeout: 10 * 1000
        },
        function(err, resp, body) {
            if(err) {
                logger('Error connecting to OAuth server');
                res.status(500).send('Error connecting to OAuth server');
                return
            }
            if(body.error) {
                logger('Authentication error,', body);
                res.status(401).send('Incorrect username or password');
                return
            }
            db.User.update(
                {name: user},
                {name: user},
                {upsert: true}, // save user to our db if not exist
                function() {
                    req.session.user = user;
                    res.redirect('/dashboard.html');
                }
            );
        }
    );
});

app.get('/logout', function(req, res) {
    req.session.reset();
    res.redirect('/login.html');
});

// get regions, could be filtered by IDC and project
app.get('/regions', function(req, res) {
    var idc = req.query.idc,
        project = req.query.project;
    if(!idc && !project) {
        db.Region.find({}, function(err, regions) {
            if(err) {
                res.status(500).send('Cannot list regions');
                logger(err);
                return;
            }
            res.send(regions);
        });
        return;
    }

    async.parallel([
        function(callback) {
            if(idc) {
                documentFromName(idc, db.Idc, false, callback);
            } else {
                callback(null, null);
            }
        },
        function(callback) {
            if(project) {
                documentFromName(project, db.Project, false, callback);
            } else {
                callback(null, null);
            }
        }
    ], function(err, results){
        if(err) {
            res.status(500).send('Some database error');
            logger(err);
            return;
        }
        var query = {};
        if(results[0]) query.idc = results[0]._id;
        if(results[1]) query.project = results[1]._id;
        db.Node.distinct('region', query, function(err, regions) {
            if(err) {
                res.status(500).send('Cannot get regions');
                logger(err);
                return;
            }
            async.map(regions, // regions is an array of region ids
                function (r, map_callback) {
                    db.Region.findById(r, function(err, region){
                        if(err) {
                            logger(err);
                            return;
                        }
                        map_callback(null, region);
                    })
                },
                function(err, results) {
                    if(err) {
                        res.status(500).send('Cannot populate regions');
                        logger(err);
                        return;
                    }
                    res.send(results);
                }
            )
        })
    });
});

app.post('/regions', function(req, res) {
    handlePost(req, res, 'Region', db.Region,
        [{
            name: 'name',
            checkFunction: notUndefined
        }]
    )
});

app.put('/region/:region_id', function(req, res) {
    var name = req.body.name,
        region_id = req.params.region_id;
    if(isUndefined(name)) {
        res.status(400).send("Must specify a name");
        return;
    }
    var update = {};
    update.name = name;
    findByIdAndUpdate(res, region_id, update, 'Region', db.Region);
});

app.delete('/region/:region_id', function(req, res) {
    handleDeleteById(req, res, 'region', db.Region)
});

app.get('/region/:region_id', function(req, res) {
    handleGetById(req, res, 'region', db.Region);
});


// FIXME: mirror of GET /regions, abstract them someday
app.get('/idcs', function(req, res) {
    var region = req.query.region,
        project = req.query.project;
    if(!region && !project) {
        db.Idc.find({}, function(err, idcs) {
            if(err) {
                res.status(500).send('Cannot list IDCs');
                logger(err);
                return;
            }
            res.send(idcs);
        });
        return;
    }

    async.parallel([
        function(callback) {
            if(region) {
                documentFromName(region, db.Region, false, callback);
            } else {
                callback(null, null);
            }
        },
        function(callback) {
            if(project) {
                documentFromName(project, db.Project, false, callback);
            } else {
                callback(null, null);
            }
        }
    ], function(err, results){
        if(err) {
            res.status(500).send('Some database error');
            logger(err);
            return;
        }
        var query = {};
        if(results[0]) query.region = results[0]._id;
        if(results[1]) query.project = results[1]._id;
        db.Node.distinct('idc', query, function(err, idcs) {
            if(err) {
                res.status(500).send('Cannot get IDCs');
                logger(err);
                return;
            }
            async.map(idcs, // idcs is an array of IDC ids
                function (i, map_callback) {
                    db.Idc.findById(i, function(err, idc){
                        if(err) {
                            logger(err);
                            return;
                        }
                        map_callback(null, idc);
                    })
                },
                function(err, results) {
                    if(err) {
                        res.status(500).send('Cannot populate IDCs');
                        logger(err);
                        return;
                    }
                    res.send(results);
                }
            )
        })
    });
});

app.post('/idcs', function(req, res){
    handlePost(req, res, 'IDC', db.Idc,
        [{
            name: 'name',
            checkFunction: notUndefined
        }]
    )
});

app.put('/idc/:idc_id', function(req, res) {
    var name = req.body.name,
        idc_id = req.params.idc_id;
    if(isUndefined(name)) {
        res.status(400).send("Must specify a name");
        return;
    }
    var update = {};
    update.name = name;
    findByIdAndUpdate(res, idc_id, update, 'IDC', db.Idc);
});

app.delete('/idc/:idc_id', function(req, res){
    handleDeleteById(req, res, 'idc', db.Idc);
});

app.get('/idc/:idc_id', function(req, res){
    handleGetById(req, res, 'idc', db.Idc);
});


app.get('/projects', function(req, res){
    var q = {}, projects = [];
    // req.user.projects are populated so extract only ids
    req.user.projects.map(function(project){
        projects.push(project._id)
    });
    if(req.user.role !== 'Root') {
        q = {_id: {$in: projects}}
    }
    handlePluralGet(req, res, 'project', db.Project, q,
    [{
        methodName: 'populate',
        arguments: ['leader', 'name']
    }])
});

var ensureUserExistence = function(user, res, callback) {
    // used in POST and PUT /project to create project leader(a user) if the
    // user not already exists in DB
    //
    // user: string, user name
    // callback: function(userDocument) {
    //              do something with the user document from DB
    //           }
    async.parallel({
        existsInDB: function (callback) {
            db.User.findOne({name: user},
                function(err, u) {
                    if(err) {
                        callback(err, false);
                        return;
                    }
                    if(u) {
                        callback(null, u);
                    } else {
                        callback(null, false);
                    }
                }
            )
        },
        existsInOauth: function (callback) {
            request({
                rejectUnauthorized: false,  // same reason as in app.post('/login')
                method: 'GET',
                url: 'https://oauth.lecloud.com/watchtvgetldapuser?username='
                + user + '&appid=watchtv&appkey=watchtv&limit=3',
                json: true,
                timeout: 10 * 1000
            }, function(err, resp, body) {
                if(err) {
                    callback(err, false);
                    return;
                }
                if(body.length > 0 && body[0].email == user + '@le.com') {
                    callback(null, true);
                } else {
                    callback(null, false);
                }
            })
        }
    }, function(err, results) {
        if (err) {
            res.status(500).send('Project create failed');
            callback(err, null);
            return
        }
        if (results.existsInDB) {
            callback(null, results.existsInDB);
        } else if (results.existsInOauth) {
            db.User.create({
                name: user,
                role: 'Leader',
                panels: []
            }, function (err, u) {
                if (err) {
                    res.status(500).send('Project create failed');
                }
                db.Panel.create({
                    name: 'Default',
                    graphs: [],
                    owner: u._id
                }, function (err, p) {
                    db.User.findOneAndUpdate(
                        {_id: u._id},
                        {'$push': {panels: p._id}},
                        function () {} // best effort
                    );
                });
                callback(err, u);
            })
        } else {
            res.status(400).send('User [' + user + '] not found');
            callback('not found', null);
        }
    })
};

app.post('/projects', requireRoot, function(req, res){
    var name = req.body.name,
        leader = req.body.leader;
    if(!name) {
        res.status(400).send('Must specify a name');
        return;
    }
    if(leader) {
        ensureUserExistence(leader, res, function(err, user) {
            if(!err) {
                handleCreate(res, {
                    name: name,
                    leader: user
                }, 'Project', db.Project, function (err, project) {
                    db.User.findOneAndUpdate(
                        { _id: user._id },
                        { '$push': { projects: project._id }},
                        function(err, original) {}  // best effort
                    )
                });
            }
        })
    } else {
        handleCreate(res, {name: name, leader: null}, 'Project', db.Project);
    }
});

app.put('/project/:project_id', requireRoot, function(req, res){
    var project_id = req.params.project_id;
    var name = req.body.name,
        leader = req.body.leader;
    var update = {};
    if(name) update.name = name;

    if(leader) {
        ensureUserExistence(leader, res, function(err, user) {
            if(!err) {
                update.leader = user;
                findByIdAndUpdate(res, project_id, update, 'Project', db.Project);
                db.User.findOneAndUpdate(
                    { _id: user._id },
                    { '$push': { projects: project_id }},
                    function(err, original) {}  // best effort
                )
            }
        })
    } else {
        findByIdAndUpdate(res, project_id, update, 'Project', db.Project);
    }
});

app.delete('/project/:project_id', requireRoot, function(req, res){
    var project_id = req.params.project_id;
    db.Project.findById(project_id, function (err, project) {
        logger('User', req.session.user, 'deletes project', project.name, project.leader);
        handleDeleteById(req, res, 'project', db.Project);
    });
});

app.get('/project/:project_id', requireRoot, function(req, res){
    handleGetById(req, res, 'project', db.Project,
        [{
            methodName: 'populate',
            arguments: ['leader', 'name']
        }]
    );
});

app.get('/influxdb/query', function(req, res) {
    var query = decodeURIComponent(url.parse(req.url).query);
    var parameters = {
        u: config.db.influxdbUser,
        p: config.db.influxdbPassword,
        db: config.db.influxdbDatabase,
        q: query
    };
    request({
        url: config.db.influxdbURL + '/query?' +
                querystring.stringify(parameters),
        json: true,
        timeout: 10000 // 10s
    }, function(err, resp, body) {
        if(err) {
            logger('InfluxDB connection error:', err);
            res.status(500).send('Error querying InfluxDB');
            return;
        }
        res.send(body);
    })
});

var getIPFromNode = function(node) {
    if(node.metricIdentifier) {
        return node.metricIdentifier;
    }
    return node.ips[0];
};

var fetchMetadata = require('./backend/' + config.db.timeSeriesBackend + '.js').fetchMetadata;

var fetchMetadataWrapper = function(res, ip, tsdbUrl) {
    fetchMetadata(ip, function(err, data) {
        if(err) {
            res.status(500).send('Error querying metadata');
            return;
        }
        res.send(data);
    }, tsdbUrl);
};

// /timeseries/meta?ip=xxx
// /timeseries/meta?node=xxx
// return metadata for specific node, for measurement selectors
app.get('/timeseries/meta', function(req, res) {
    if(req.query.ip == undefined && req.query.node == undefined) {
        res.status(400).send('At least one of IP/nodeID should be specified in query parameter');
        return;
    }
    var ip = req.query.ip;
    if(ip) {
        fetchMetadataWrapper(res, ip);
    } else {
        db.Node.findById(req.query.node, function(err, node) {
            if(err) {
                logger('Error fetching node', err);
                res.status(500).send('Error fetching node: ' + err);
                return;
            }
            if(!node) {
                res.status(404).send('Cannot find metadata');
                return;
            }
            ip = getIPFromNode(node);
            fetchMetadataWrapper(res, ip, node.tsdbUrl);
        })
    }
});

var fetchMetric = require('./backend/' + config.db.timeSeriesBackend + '.js').fetchMetric;

var fetchMetricWrapper = function(res, fromTime, toTime, ip, measurement, device, measure,
                                  tsdbUrl) {
    fetchMetric(fromTime, toTime, ip, measurement, device, measure, function(err, data) {
        if(err) {
            res.status(500).send('Error querying metrics ' + err);
            return;
        }
        res.send(data);
    }, tsdbUrl);
};

// /timeseries/metric?from=xxx&to=xxx&ip=xxx&measurement=xxx&device=xxx&measure=xxx
// /timeseries/metric?from=xxx&to=xxx&node=xxx&measurement=xxx&device=xxx&measure=xxx
app.get('/timeseries/metric', function(req, res) {
    var fromTime = req.query.from,
        toTime = req.query.to,
        ip = req.query.ip,
        node = req.query.node,
        measurement = req.query.measurement,
        device = req.query.device,
        measure = req.query.measure;
    if(fromTime == undefined || measurement == undefined || measure == undefined) {
        res.status(400).send('from, measurement, measure are required');
        return;
    }
    if(ip == undefined && node == undefined) {
        res.status(400).send('At least one of IP/nodeID should be specified in query parameter');
        return;
    }
    if(toTime == undefined) toTime = Date.now();

    if(ip) {
        fetchMetricWrapper(res, fromTime, toTime, ip, measurement, device, measure);
    } else {
        db.Node.findById(node, function(err, n) {
            if(err) {
                logger('Error fetching node', err);
                res.status(500).send('Error fetching node: ' + err);
                return;
            }
            if(!n) {
                res.status(404).send('Cannot find metric');
                return;
            }
            ip = getIPFromNode(n);
            fetchMetricWrapper(res, fromTime, toTime, ip, measurement, device, measure,
                n.tsdbUrl);
        })
    }
});