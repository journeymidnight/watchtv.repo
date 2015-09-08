var React = require('react');

var unit = require('../unit.js');
var Utility = require('../utility.js');
var GraphInfo = require('./graphInfo.js');

var BaseGraph = React.createClass({
    getInitialState: function(){
        var host = Utility.catHost(this.props.selected.ip);
        return {
            data: [],
            host: host,
            timePeriod:Utility.fitTimePeriod(null,this.props.selected.timePeriod),
            metricArr: this.props.selected.metricArr,
            node_id: this.props.selected.node_id,
            uniq_id: this.props.selected.key,
            config: this.props.config
        }
    },
    queryInfluxDB: function(queryString,ip,metric,type,newTimePeriod) {
        $.ajax({
            url: this.state.config.influxdbURL + '/query?' +
                $.param(Utility.q_param(this.state.config, queryString)),
            dataType: 'json',
            success: function (data) {
                var currdata = this.state.data;
                currdata[currdata.length] = {
                    data:Utility.get_value(data),
                    ip:ip,
                    metric:metric,
                    type:type
                }
                this.setState({data: currdata,timePeriod:newTimePeriod});
            }.bind(this)
        })
    },
    executeQuery: function(fromTime, toTime, timePeriod, host,type,metric){
        var query = Utility.buildQuery(fromTime, toTime, timePeriod, host, metric[0], metric[1],metric[2]);
        if(query == null) return;
        this.queryInfluxDB(query,host,metric,type,timePeriod);
    },
    handleGraph: function(fromTime, toTime,newTimePeriod){
        var timePeriod = this.state.timePeriod;
        if(fromTime!=null&&toTime!=null) timePeriod = null;
        if(newTimePeriod!=null) timePeriod = newTimePeriod;
        var host = this.state.host.split(',');
        var metricArr = this.state.metricArr;
        for(var i = 0;i<host.length;i++){
            for(var j = 0;j<metricArr.length;j++){
                this.executeQuery(
                    fromTime,
                    toTime,
                    timePeriod,
                    host[i],
                    j+1,
                    Utility.splitMetric(metricArr[j]).split(",")
                );
            }
        }
    },
    componentWillMount: function(){
        this.handleGraph();
    },
    refreshGraph: function(graphs,type){
        if(type != "delete"){
            var host = Utility.catHost(graphs.ips);
            var metricArr =  graphs.metrics;
            this.setState({
                data:[],
                host:host,
                time:graphs.time,
                timePeriod:Utility.fitTimePeriod(null,graphs.time),
                metricArr:metricArr,
                uniq_id:this.state.node_id+host.split(',')[0]
            });
            this.handleGraph();
        }else{
            this.props.onRefresh();
        }
    },
    getFittedData: function(){
        var fitted_data=[];
        for(var i = 0;i<this.state.data.length;i++){
            fitted_data[i] = {
                data:Utility.fitData(this.state.data[i].data),
                ip:this.state.data[i].ip,
                metric:this.state.data[i].metric,
                type:this.state.data[i].type
            }
        }
        return fitted_data;
    },
    componentDidUpdate: function() {
        var fitted_data=this.getFittedData();
        // unit is the last part of measure name, e.g.
        // tx_Bps, Committed_AS_byte, etc.
        var formatter=[], unitSuffix=[];
        var metricArr = this.state.metricArr;
        for(var i = 0;i<metricArr.length;i++){
            var split = Utility.splitMetric(metricArr[i]).split(","),
                measure = split[split.length-1];
            if(measure) {
                var u = measure.split('_').slice(-1)[0];
            }
            if(unit[u]) {
                formatter[formatter.length] = unit[u];
                unitSuffix[unitSuffix.length] = u;
            } else {
                formatter[formatter.length] = Utility.numberFormatter;
                unitSuffix[unitSuffix.length] = "";
            }
        }
        Utility.plotGraph('#graph' + this.state.uniq_id,
                fitted_data,
                formatter
        );
        var that = this;
        $('#graph' + that.state.uniq_id)
            .unbind()
            .bind("plothover", function (event, pos, item) {
                if (item) {
                    var x = new Date(item.datapoint[0]).toLocaleString(),
                        y = Utility.numberFormatter(item.datapoint[1],null,unitSuffix[fitted_data[item.seriesIndex].type-1]);
                        metric = fitted_data[item.seriesIndex].metric,
                        ip = fitted_data[item.seriesIndex].ip,
                        position = Utility.getElePosition(this);
                    var left = item.pageX - position.left + 20,
                        top = item.pageY - position.top + 20,
                        obj = $('#tooltip'+that.state.uniq_id);
                    obj.html(ip + '<br>' + metric + '<br>' + y + '<br>' + x );
                    if((item.pageX + obj.width()) > ($("body").width()-30)){
                        left -= (obj.width()+30);
                    }
                    obj.css({left:left,top:top}).show();
                } else {
                    $('#tooltip'+that.state.uniq_id).hide();
                }
            })
            .bind("plotselected", function (event, ranges) {
                var fitted_data=that.getFittedData();
                var start = that.state.timePeriod[0].getTime(),
                    end = that.state.timePeriod[1].getTime();
                var from = (ranges.xaxis.from - start)/(end - start),
                    to = (ranges.xaxis.to - start)/(end - start);
                var data = that.state.data;
                for(var i = 0;i<fitted_data.length;i++){
                    var arr = fitted_data[i].data;
                    var oriData = data[i].data;
                    fitted_data[i].data = arr.slice(parseInt(from*arr.length),parseInt(to*arr.length));
                    var dataStart = parseInt(from*oriData.length),
                        dataEnd = parseInt(to*oriData.length);
                    dataStart%2 == 0?dataStart = dataStart:dataStart = dataStart+1;
                    dataEnd%2 == 0?dataEnd = dataEnd:dataEnd = dataEnd+1;
                    data[i].data = oriData.slice(dataStart,dataEnd);
                }
                that.setState({data:data,timePeriod:[new Date(ranges.xaxis.from),new Date(ranges.xaxis.to)]});
                Utility.plotGraph('#graph' + that.state.uniq_id,
                          fitted_data,
                          formatter
                )
            });
    },
    componentWillReceiveProps:function(){
        if(this.props.type == 'single'){
            this.setState({data:[]});
            this.handleGraph(null,null,Utility.fitTimePeriod(null,this.props.selected.timePeriod));
        }
    },
    render: function(){
        var graphTitle = this.state.metricArr;
        return (
            <div>
                <div className="graph">
                    <div className="graphTitle" 
                        title={graphTitle}>
                        {graphTitle}
                    </div>
                    <div id={'graph'+this.state.uniq_id} style={{width: '100%', height: '145px',backgroundColor: "#1f1f1f"}}></div>
                    <div id={'tooltip'+this.state.uniq_id} 
                        className = "tool"
                        style={{
                            position: 'absolute',
                            display: "none",
                            padding: "5px",
                            backgroundColor: "#3f3f3f",
                            borderRadius: "4px",
                            zIndex:"1"
                        }}>
                    </div>
                    <GraphInfo title="Edit"  ips = {this.props.ips} nodeGraph={this.props.nodeGraph}
                               selected={this.props.selected} timeList = {this.props.timeList} onRefresh={this.refreshGraph}/>
                </div>
            </div>
        )
    }
});

module.exports = BaseGraph;
