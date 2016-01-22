// Generate a time period([fromTime, Now]) from length of time. time is in sec
var periodFromTimeLength = function(time) {
    var now = new Date();
    if(time === 0) return null;
    else return [new Date(now.getTime()-time*1000),now];
};

var fitData = function(data) {
    // convert [time, data, time, data ...]
    // to [ [time, data], [time, data], ...]
    var fitted_data = [];
    for (var i = 0; i < data.length; i+=2){
        var d = [Date.parse(data[i]) , data[i+1]];
        fitted_data.push(d);
    }
    if(fitted_data.length < 2) {  // len=0 would cause null value,
                                  // 1 would cause divide by 0
        return fitted_data;
    }
    // do linear fitting to eliminate null values
    var last_i = null,
        timeSpan = fitted_data[fitted_data.length-1][0] - fitted_data[0][0],
        // don't do fitting if more than 10min data are lost
        thresholdPointNumber = Math.floor((10 * 60 * 1000 * fitted_data.length) / timeSpan);
    for (i = 0; i < fitted_data.length; i += 1) {
        if(fitted_data[i][1]) {
           if (last_i) {
               if(i - last_i > thresholdPointNumber) {
                   last_i = i;
                   continue;
               }
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
    if (str.length>1 && str[1].length >= 3) {
        str[1] = str[1].slice(0,3);
    }
    if (unit) {
        return str.join('.') + ' ' + unit;
    } else {
        return str.join('.');
    }
};
//根据格式判断左右Y轴
var yAxisType = function(yAxisFormatter,i){
    if(yAxisFormatter[i]==yAxisFormatter[0])
        return 1;
    else
        return 2;
};

var plotGraph = function(placeholder, data, yAxisFormatters) {
    var dataArr = [],yaxis;
    for(var i = 0;i<data.length;i++){
        var type = yAxisType(yAxisFormatters, i);
        dataArr[i] = {
            data:data[i].data,
            label:data[i].ip + ": " + data[i].metric,
            yaxis:type
        };
    }
    return $.plot(placeholder,
        dataArr,
        {
            xaxis: {
                mode: "time",
                show: true,
                timezone: "browser",
                color: "#444",
                font: {color: "#fff"}
            },
            yaxes: [
                {
                    color: "#444",
                    font: {color: "#fff"},
                    tickFormatter: yAxisFormatters[0]
                },
                {
                    color: "#444",
                    font: {color: "#fff"},
                    position:"right",
                    tickFormatter: yAxisFormatters[yAxisFormatters.length-1]
                }
            ],
            series: {
                lines: {
                    show: true,
                    lineWidth:2
                }
            },
            grid: {
                color: "transparent",
                margin: 10,
                hoverable: true
            },
            colors: ["#CACF15","#71C855","#6ED0E0","#B941DA","#EF843C","#4E41BB",
                     "#E24D42","#E600FF","#FF0000","#48FF00","#FFE600"],
            crosshair: {
                mode: "x",
                color: "#f00"
            },
            selection: {
                mode: "x"
            }
        });
};

var getEvent = function(){ //ie and ff 
    if(document.all)  return window.event;    
    var func=getEvent.caller;
    while(func!=null){  
        var arg0=func.arguments[0]; 
        if(arg0) { 
          if((arg0.constructor==Event || arg0.constructor ==MouseEvent) 
                || (typeof(arg0)=="object" && arg0.preventDefault && arg0.stopPropagation)){  
            return arg0; 
          } 
        } 
        func=func.caller; 
    } 
    return window.event; 
};

var dotted2underscoredIP = function(ip) {
    var dot = new RegExp('\\.','g');
    return ip.split(':')[0].replace(dot, '_');
};

var catHost = function(ips){//ips is arr
    var host="";
    for(var i = 0;i<ips.length;i++){
        host += dotted2underscoredIP(ips[i]);
        if(ips.length!=1 && i<ips.length-1)
            host += ",";
    }
    return host;
};

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
};

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
};

var getTimeList = function(){
    var arr1 = ['Last 30m','Last 1h' ,'Last 6h' ,'Last 12h','Last 1d' ,
                'Last 2d' ,'Last 3d' ,'Last 4d' ,'Last 5d' ,'Last 6d' ,'Last 7d' ,'Last 30d'];
    var arr2 = [1800,3600,21600,43200,86400,
                172800,259200,345600,432000,518400,604800,2592000];
    var timeList = [];
    for(var i = 0;i<arr1.length;i++){
        timeList[i] = {payload: i+1, text: arr1[i], value: arr2[i]}
    }
    return timeList;
};
var dateFormat = function(time,fmt){
  var o = {   
    "M+" : time.getMonth()+1,                 //月份   
    "d+" : time.getDate(),                    //日   
    "h+" : time.getHours(),                   //小时   
    "m+" : time.getMinutes(),                 //分   
    "s+" : time.getSeconds(),                 //秒   
    "q+" : Math.floor((time.getMonth()+3)/3), //季度   
    "S"  : time.getMilliseconds()             //毫秒   
  };   
  if(/(y+)/.test(fmt))   
    fmt=fmt.replace(RegExp.$1, (time.getFullYear()+"").substr(4 - RegExp.$1.length));   
  for(var k in o)   
    if(new RegExp("("+ k +")").test(fmt))   
  fmt = fmt.replace(RegExp.$1, (RegExp.$1.length==1) ? (o[k]) : (("00"+ o[k]).substr((""+ o[k]).length)));   
  return fmt;   
};

var generateKeyForGraph = function(graph) { // graph is same as in DB schema
    var key = graph._id;
    graph.ips.map(function(ip) {
        key += dotted2underscoredIP(ip);
    });
    graph.metrics.map(function(metric){
        var splittedMetric = metric.split(',');
        key += splittedMetric[0] + splittedMetric[1] + splittedMetric[2];
    });
    return key;
};

var getNames = function(data) {
    return data.result.map(function(item) {
        return item.name;
    })
};
var dataMapper = {
    project: getNames,
    tag: getNames,
    region: getNames,
    idc: getNames
};

//根据当前graph时间段及刷新频率计算新的时间段
var resetTimePeriod = function(oldPeriod,refreshPeriod){
    return [
        new Date(oldPeriod[0].getTime()+refreshPeriod),
        new Date(oldPeriod[1].getTime()+refreshPeriod),
    ];
}
var Utility = {
    periodFromTimeLength: periodFromTimeLength,
    fitData: fitData,
    numberFormatter: numberFormatter,
    plotGraph: plotGraph,
    getEvent: getEvent,
    catHost:catHost,
    splitMetric:splitMetric,
    getElePosition:getElePosition,
    getTimeList:getTimeList,
    dateFormat:dateFormat,
    dotted2underscoredIP: dotted2underscoredIP,
    generateKeyForGraph: generateKeyForGraph,
    dataMapper: dataMapper,
    resetTimePeriod:resetTimePeriod
};
module.exports = Utility;