var React = require('react');

var unit = require('../unit.js');
var Utility = require('../utility.js');
var GraphInfo = require('./graphInfo.js');

// The component to actually draw a graph

// data structures:
// data: [{data: [metric data from DB], ip: '1.2.3.4', metric: 'cpu,cpu0,idle', metricIndex: 2}, ...]
// formatters: [formatter for metricIndex[0], formatter for metricIndex[1], ...]
// suffixes: [suffix for metricIndex[0], suffix for metricIndex[1], ...]
// graph: same as in DB schema

// props:
// graph: graph object described above. The graphs to draw are (graph.ips x graph.metrics)
// node_id: mongodb id. Used to build URLs, could be null for Dashboard page, but not
//                      for Single page.
// config: Watchtv config object, could be fetched by GET /config
// graphEditor: react component, could be dashboardGraphEditor or singleGraphEditor.
//              Used to render the edit dialog.
// onRefresh: callback function(dashboards, fromTime, toTime).

var BaseGraph = React.createClass({
    getInitialState: function(){
        return {
            data: [],
            ips: this.props.graph.ips,
            metrics: this.props.graph.metrics,
            time: this.props.graph.time,
            title: this.props.graph.title,
            config: this.props.config
        };
    },
    queryInfluxDB: function(queryString, ip, metric, metricIndex, newTimePeriod) {
        $.ajax({
            url: this.state.config.influxdbURL + '/query?' +
                $.param(Utility.q_param(this.state.config, queryString)),
            dataType: 'json',
            success: function (data) {
                var currdata = this.state.data;
                // currdata is full, needs to refresh
                if(currdata.length === this.state.ips.length * this.state.metrics.length) {
                    currdata = [];
                }
                currdata[currdata.length] = {
                    data:Utility.get_value(data),
                    ip:ip,
                    metric:metric,
                    metricIndex: metricIndex
                };
                this.setState({data: currdata, timePeriod: newTimePeriod});
            }.bind(this)
        });
    },
    executeQuery: function(timePeriod, ip, metricIndex, metric) {
        var query = Utility.buildQuery(timePeriod, ip,
                                       metric[0], metric[1], metric[2]);
        if(query == null) { return; }
        this.queryInfluxDB(query, ip, metric, metricIndex, timePeriod);
    },
    handleGraph: function(newTimePeriod){
        var that = this, timePeriod = Utility.fitTimePeriod(this.state.time);
        if(newTimePeriod != null) timePeriod = newTimePeriod;

        this.state.ips.map(function(ip){
            that.state.metrics.map(function(metric, metricIndex) {
                that.executeQuery(
                    timePeriod,
                    Utility.dotted2underscoredIP(ip),
                    metricIndex,
                    Utility.splitMetric(metric).split(',')
                );
            });
        });
    },
    handleEditorUpdate: function(editorStates) {
        this.setState({
            data: [],
            ips: editorStates.ips,
            metrics: editorStates.metrics,
            time: editorStates.time
        });
        this.handleGraph();
        var graph = {
            ips: editorStates.ips,
            metrics: editorStates.metrics,
            time: editorStates.time
        };
        $.ajax({
            url: '/graph/' + this.props.graph._id,
            type: 'PUT',
            data: {graph: graph},
            success: function () {
            },
            error: function (xhr, status, error) {
                console.log('Error updating user graph', xhr, status, error);
            }
        });
    },
    getFittedData: function(){
        var fitted_data=[];
        for(var i = 0;i<this.state.data.length;i++){
            fitted_data[i] = {
                data:Utility.fitData(this.state.data[i].data),
                ip:this.state.data[i].ip,
                metric:this.state.data[i].metric,
                metricIndex:this.state.data[i].metricIndex
            };
        }
        return fitted_data;
    },
    handleDeleteSelf: function () {
        this.props.onRefresh();
    },
    componentWillMount: function(){
        this.handleGraph();
    },
    componentDidUpdate: function() {
        var fitted_data=this.getFittedData();
        // unit is the last part of measure name, e.g.
        // tx_Bps, Committed_AS_byte, etc.
        var formatter=[], unitSuffix=[];
        var metrics = this.state.metrics;
        for(var i = 0;i<metrics.length;i++){
            var split = Utility.splitMetric(metrics[i]).split(","),
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

        var uniq_id = Utility.generateKeyForGraph(this.props.graph);

        Utility.plotGraph('#graph' + uniq_id,
                fitted_data,
                formatter
        );
        var that = this;
        $('#graph' + uniq_id)
            .unbind()
            .bind("plothover", function (event, pos, item) {
                if (item) {
                    var x = Utility.dateFormat(new Date(item.datapoint[0]),"yyyy-MM-dd hh:mm:ss"),
                        y = Utility.numberFormatter(item.datapoint[1],
                                null,unitSuffix[fitted_data[item.seriesIndex].metricIndex]),
                        metric = fitted_data[item.seriesIndex].metric,
                        ip = fitted_data[item.seriesIndex].ip,
                        position = Utility.getElePosition(this);
                    var left = item.pageX - position.left + 20,
                        top = item.pageY - position.top + 20,
                        obj = $('#tooltip' + uniq_id);
                    obj.html(ip + '<br>' + metric + '<br>' + y + '<br>' + x );
                    if((item.pageX + obj.width()) > ($("body").width()-30)){
                        left -= (obj.width()+30);
                    }
                    obj.css({left:left,top:top}).show();
                } else {
                    $('#tooltip' + uniq_id).hide();
                }
            })
            .bind("plotselected", function (event, ranges) {
                if(that.props.type == 'single'){
                    var timePeriod = [new Date(ranges.xaxis.from),new Date(ranges.xaxis.to)];
                    $(".zoomTime .zoomInfo").html(
                        Utility.dateFormat(timePeriod[0],"MM-dd hh:mm:ss")+" to "+
                        Utility.dateFormat(timePeriod[1],"MM-dd hh:mm:ss"));
                    that.props.onRefresh(null,ranges.xaxis.from,ranges.xaxis.to);
                }else{
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
                    Utility.plotGraph('#graph' + uniq_id,
                              fitted_data,
                              formatter
                    )
                }
            });

        // For updating graph title
        $("#" + this.props.graph._id + " .titleInput").off().on('blur', function(){
            var graph = {
                title: $(this).val()
            };
            $.ajax({
                type: 'PUT',
                url: 'graph/' + that.props.graph._id,
                data: {graph: graph},
                success: function(){
                },
                error:function(){
                    console.log("error");
                }
            });
        });
    },
    componentWillReceiveProps:function(nextProps){

    },
    render: function(){
        var placeholderText = "Click Here to Edit Graph Name";
        if(this.state.title!=null&&this.state.title!="") placeholderText = this.state.title;

        var uniq_id = Utility.generateKeyForGraph(this.props.graph);
        return (
            <div id={this.props.graph._id}>
                <div className="graph">
                    <input type="text" name="title" className="titleInput" placeholder={placeholderText}/>
                    <div className="loading"></div>
                    <div className="graphTitle"></div>
                    <div id={'graph' + uniq_id}
                         style={{width: '100%', height: '145px',backgroundColor: "#1f1f1f",marginTop:'10px'}}>
                    </div>
                    <div id={'tooltip' + uniq_id}
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
                    <this.props.graphEditor title="Edit" initialIPs={this.state.ips}
                                            initialMetrics={this.state.metrics}
                                            initialTime={this.state.time}
                                            config={this.props.config}
                                            onUpdate={this.handleEditorUpdate}
                                            onRefresh={this.handleDeleteSelf}
                                            graph_id={this.props.graph._id}
                    />
                </div>
            </div>
        )
    }
});

module.exports = BaseGraph;
