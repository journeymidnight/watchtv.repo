/*
Extract strings to be translated
 */

var fs = require('fs');
var path = require('path');

var strings = {};
var reg1 = new RegExp(/__\(\'(.*)\'\)/g);
var reg2 = new RegExp(/__\(\"(.*)\"\)/g);

var walk = function(dir) {
    var files = fs.readdirSync(dir);
    files.map(function(file) {
        var p = path.join(dir, file);
        var stat = fs.statSync(p);
        if(stat.isDirectory() && file === 'static') {
            // ignore static dir
            return;
        }
        if(stat.isDirectory()) {
            walk(p);
        } else {
            if(!p.endsWith('.js')) return;

            console.log('checking', p);
            var content = fs.readFileSync(p, 'utf8');
            var match1, match2;
            while(match1 = reg1.exec(content)) {
                console.log(match1[1]);
                strings[match1[1]] = '';
            }
            while(match2 = reg2.exec(content)) {
                console.log(match2[1]);
                strings[match2[1]] = '';
            }
        }
    })
};

walk(path.join(__dirname, '..', 'app'));

var zh = require('../translation/zh.js');

for(var x in zh) {
    if(!zh.hasOwnProperty(x)) continue;
    if(strings[x] === '') {
        strings[x] = zh[x];
    }
}

console.log('Strings:', strings);