var _ = require('underscore');
var q_param = function(config, q) {
    return {
        u: config.influxdbUser,
        p: config.influxdbPassword,
        db: config.influxdbDatabase,
        q: q
    }
};
var get_value = function (ret) {
    if (ret.results[0].series == undefined){
        return []
    }
    return _.flatten(ret.results[0].series[0].values);
};

var pointPerGraph = 300; // should be configurable

var buildQuery = function(fromTime, toTime, timePeriod, measurement, host, device, measure) {
    // fromTime and toTime are all Date objects
    if(timePeriod != null){
        fromTime = timePeriod[0];
        toTime = timePeriod[1];
    }else if(timePeriod == null && fromTime == null && toTime == null){
        return null;
    }
    var groupByTime = Math.floor( (toTime - fromTime)/pointPerGraph/1000 );
    if (groupByTime < 1) { groupByTime = 1}

    var query = 'SELECT MEAN(value) FROM ' + measurement +
        " WHERE host='" + host +  "' AND measure='" + measure + "'" +
        " AND time > '" + fromTime.toISOString() +  "' AND time < '" +
        toTime.toISOString() + "' ";
    if(device) {
        query += " AND device='" + device + "' ";
    }
    query += ' GROUP BY time(' + groupByTime + 's)';
    return query;
};

var millisecondsPerDay = 24*60*60*1000;
var fitTimePeriod = function(timePeriod,time) {
    if(time == null){
        var state = timePeriod.state.selectedIndex;
        time = parseInt(timePeriod.props.menuItems[state].value);
    }
    var now = new Date();
    if(time == 0) return null;
    else return [new Date(now.getTime()-time*1000),now];
};

var fitData = function(data) {
    // convert [time, data, time, data ...]
    // to [ [time, data], [time, data], ...]
    var fitted_data = [];
    for (var i = 0; i < data.length; i+=2){
        var d = [Date.parse(data[i]) , data[i+1]];
        fitted_data.push(d)
    }
    // do linear fitting to eliminate null values
    var last_i = null;
    for (i = 0; i < fitted_data.length; i += 1) {
        if(fitted_data[i][1]) {
           if (last_i) {
               for(var j = last_i + 1; j < i; j += 1) {
                   var y1 = fitted_data[last_i][1];
                   var y2 = fitted_data[i][1];
                   fitted_data[j][1] = y1 + (y2 - y1) * (j - last_i) / (i - last_i);
               }
           }
           last_i = i;
        }
    }
    return fitted_data;
};

var numberFormatter = function(val, axis, unit) {
    // Copied from
    // http://stackoverflow.com/questions/6784894/add-commas-or-spaces-to-group-every-three-digits
    var str = val.toString().split('.');
    if (str[0].length >= 5) {
        str[0] = str[0].replace(/(\d)(?=(\d{3})+$)/g, '$1,');
    }
    if (unit) {
        return str.join('.') + ' ' + unit;
    } else {
        return str.join('.');
    }
};

var plotGraph = function(placeholder, data, yAxisFormatter) {
    //console.log('placeholder name', placeholder);
    var dataArr = [],yaxis,lineWidth = 1;
    if(data.length == 1) lineWidth = 2;
    for(var i = 0;i<data.length;i++){
        var type = data[i].type;
        if(type>=2) type = 2;
        dataArr[i] = {
            data:data[i].data,
            label:data[i].ip + ": " + data[i].metric,
            yaxis:type
        }
    }
    return $.plot(placeholder,
        dataArr,
        {
            xaxis: {
                mode: "time",
                show: true,
                timezone: "browser",
                color: "#444",
                font: {color: "#AFB2B5"}
            },
            yaxes: [
                {
                    color: "#444",
                    font: {color: "#AFB2B5"},
                    tickFormatter: yAxisFormatter[0]
                },
                {
                    color: "#444",
                    font: {color: "#AFB2B5"},
                    position:"right",
                    tickFormatter: yAxisFormatter[yAxisFormatter.length-1]
                },
            ],
            series: {
                lines: {
                    show: true,
                    lineWidth:lineWidth
                }
            },
            grid: {
                color: "transparent",
                margin: 10,
                hoverable: true
            },
            colors: ["#CACF15","#71C855","#6ED0E0","#B941DA","#EF843C","#4E41BB","#E24D42"],
            crosshair: {
                mode: "x",
                color: "#444"
            },
            selection: {
                mode: "x"
            }
        });
};

var getEvent = function(){ //ie and ff 
    if(document.all)  return window.event;    
    func=getEvent.caller;        
    while(func!=null){  
        var arg0=func.arguments[0]; 
        if(arg0) { 
          if((arg0.constructor==Event || arg0.constructor ==MouseEvent) || (typeof(arg0)=="object" && arg0.preventDefault && arg0.stopPropagation)){  
            return arg0; 
          } 
        } 
        func=func.caller; 
    } 
    return window.event; 
} 

var catHost = function(ip){
    var host="";
    var dot = new RegExp('\\.','g');
    ip = ip.split(",");
    for(var i = 0;i<ip.length;i++){
        host += ip[i].split(':')[0].replace(dot, '_');
        if(ip.length!=1 && i<ip.length-1)
            host += ",";
    }
    return host;
}

var splitMetric = function(metric){
    var metricArr = metric.split(",");
    var semicolon = new RegExp('\\;','g');
    var measurement = '',
        device = '',
        measure = '';
    if(metricArr.length==1){
        measurement = metricArr[0];
        device = '';
        measure = '';
    }else if(metricArr.length==2){
        measurement = metricArr[0];
        device = '';
        measure = metricArr[1];
    }else if(metricArr.length==3){
        measurement = metricArr[0];
        device = metricArr[1];
        measure = metricArr[2];
    }
    measure = measure.replace(semicolon,'');
    return measurement + "," + device + "," + measure;
}

var getElePosition = function(obj){ 
    var topValue = 0,leftValue = 0,result = {};
    while(obj){  
        leftValue += obj.offsetLeft;
        topValue += obj.offsetTop; 
        obj = obj.offsetParent;   
    }   
   result.left = leftValue;
   result.top = topValue;  
   return result; 
}

var Utility = {
    q_param: q_param,
    get_value: get_value,
    buildQuery: buildQuery,
    fitTimePeriod: fitTimePeriod,
    fitData: fitData,
    numberFormatter: numberFormatter,
    plotGraph: plotGraph,
    getEvent: getEvent,
    catHost:catHost,
    splitMetric:splitMetric,
    getElePosition:getElePosition
};
module.exports = Utility;