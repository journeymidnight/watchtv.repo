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
var fd = fs.openSync(config.log.path, 'a');
fs.closeSync(fd);
try {
    fs.chmodSync(config.log.path, '666');
} catch(err) {
    console.log('Cannot chmod log file to 666:', err);
}


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
