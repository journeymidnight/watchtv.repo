var mkdirp = require('mkdirp');
var getDirName = require('path').dirname;
var fs = require('fs');

var config = require('./config.js');


var logDir = getDirName(config.log.path);
mkdirp(logDir, function(err){
    if(err) {
        console.log("Cannot create log dir: ", err)
    }
});

// Ensure the config file
var oldMask,
    newMask = 0000;
oldMask = process.umask(newMask);
var fd = fs.openSync(config.log.path, 'a', 0666);
fs.closeSync(fd);
process.umask(oldMask);


var getLogger = function(name) {
    return function() {
        var currentTime = new Date();
        var log = '';
        for (var i = 0;i < arguments.length; i++) {
            log += arguments[i] + ' ';
        }
        fs.appendFile(
            config.log.path,
            '[' + currentTime + '][' + name  + '] ' + log + '\n',
            function(err) {
                if(err) {console.log('Failed to log for ' + name + ': ', err)}
            }
        )
    }
};


module.exports = {
    getLogger: getLogger
};
