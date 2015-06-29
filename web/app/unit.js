
var formatFuncCreator = function(factor, units) {
    return function(val, axis) {
        var original = val;
        var whole, decimal;
        var unitIndex = 0;
        while(true) {
            whole = val.toString().split('.')[0];
            decimal = val.toString().split('.')[1];

            if(whole.length > 3) {
                val = val / factor;
                unitIndex += 1;
            } else { break;}
        }

        if(units[unitIndex]) {
            var suffix = units[unitIndex];
        } else {
            return original + units[0];
        }

        if(decimal) {
            return whole + '.' + decimal.slice(0,2) + suffix;  // keep only 2 decimals
        } else {
            return whole + suffix;
        }
    }
};

var byte = formatFuncCreator(1024, [' B', ' KiB', ' MiB', ' GiB', ' TiB', ' PiB', ' EiB', ' ZiB', ' YiB']);
var bps = formatFuncCreator(1024, [' Bps', ' KiBps', ' MiBps', ' GiBps', ' TiBps', ' PiBps',
                                   ' EiBps', ' ZiBps', ' YiBps']);
var ms = formatFuncCreator(1000, [' ms', ' s']);

var percent = function(val, axis) {
        return val + ' %';
};


module.exports = {
    byte: byte,
    Bps: bps,
    percent: percent,
    ms: ms
};