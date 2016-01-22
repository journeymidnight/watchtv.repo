var React = require('react');

var unit = require('../unit.js');
var utility = require('../utility.js');

// The component to actually draw a graph

// data structures:
// data: [{data: [metric data from DB], ip: '1.2.3.4', metric: 'cpu,cpu0,idle',
//          metricIndex: 2, enabled: 1}, ...]
// formatters: [formatter for metricIndex[0], formatter for metricIndex[1], ...]
// suffixes: [suffix for metricIndex[0], suffix for metricIndex[1], ...]
// graph: same as in DB schema

// props:
// graph: graph object described above. The graphs to draw are (graph.ips x graph.metrics)
// period: [fromTime, toTime], fromTime and toTime are Date objects. The time interval to draw.
// onRefresh: callback function(fromTime, toTime). Used to pass back dragged period.
// showShareDialog: callback function(graph_id). Used to open share dialog.
// showEditDialog: callback function(graph_id). Used to open edit dialog.

var BaseGraph = React.createClass({
    getInitialState: function(){
        return {
            data: [],
            graphWidth: $('#' + this.props.graph._id).width()
        };
    },
    executeQuery: function(timePeriod, ip, metricIndex, metric) {
        var queryParameters = {
            from: timePeriod[0],
            to: timePeriod[1],
            ip: ip,
            measurement: metric[0],
            device: metric[1],
            measure: metric[2]
        };
        $.ajax({
            url: '/timeseries/metric?' + $.param(queryParameters),
            dataType: 'json',
            success: function (data) {
                var currdata = this.state.data;
                currdata[currdata.length] = {
                    data: data,
                    ip: ip,
                    metric: metric,
                    metricIndex: metricIndex,
                    enabled: 1  // 1 for enabled, 0 for disabled. If shown on graph
                };
                this.setState({data: currdata});
            }.bind(this)
        });
    },
    fetchGraphData: function(nextProps){
        var that = this, props = this.props;
        if(nextProps != null) props = nextProps;

        props.graph.ips.map(function(ip){
            props.graph.metrics.map(function(metric, metricIndex) {
                that.executeQuery(
                    that.props.period,
                    utility.dotted2underscoredIP(ip),
                    metricIndex,
                    utility.splitMetric(metric).split(',')
                );
            });
        });
    },
    getFittedData: function(){
        var fitted_data=[];
        for(var i = 0;i<this.state.data.length;i++){
            fitted_data[i] = {
                data: this.state.data[i].enabled ?
                    utility.fitData(this.state.data[i].data) : [],
                ip:this.state.data[i].ip,
                metric:this.state.data[i].metric,
                metricIndex:this.state.data[i].metricIndex
            };
        }
        return fitted_data;
    },
    componentWillMount: function(){
        this.fetchGraphData();
    },
    componentWillReceiveProps:function(nextProps){
        var fetch = function() {
            this.fetchGraphData(nextProps);
        };
        var differentArray = function(a, b) {
            if(a.length !== b.length) return true;

            for(var i=0;i<a.length;i++) {
                if(a[i] !== b[i]) return true;
            }
            return false;
        };
        if(differentArray(nextProps.period, this.props.period) ||
            differentArray(nextProps.graph.ips, this.props.graph.ips) ||
            differentArray(nextProps.graph.metrics, this.props.graph.metrics)) {
            this.setState({data:[]}, fetch);
        }
    },
    componentDidMount: function () {
        var that = this;

        // check and set the state of graphWidth so as to redraw the graphs
        // when graph width changes
        var checkGraphWidth = function () {
            var graph = $('#' + that.props.graph._id);
            var graphWidth = graph.width();
            return function () {
                if(graphWidth !== graph.width()) {
                    graphWidth = graph.width();
                    that.setState({graphWidth: graphWidth});
                }
            };
        }();
        setInterval(checkGraphWidth, 1200);

        // For updating graph title
        $("#" + this.props.graph._id + " .titleInput").off().on('blur', function(){
            if($(this).val()=="") return;
            var graph = {
                title: $(this).val()
            };
            $.ajax({
                type: 'PUT',
                url: 'graph/' + that.props.graph._id,
                data: {graph: graph},
                success: function(){
                },
                error:function(xhr, status, err){
                    if (xhr.status === 401) {
                        location.assign('/login.html');
                    }
                    console.log("error");
                }
            });
        });
        $(".singleDefault .titleInput").off().attr("disabled",true);
    },
    componentDidUpdate: function() {
        var fitted_data=this.getFittedData();
        // unit is the last part of measure name, e.g.
        // tx_Bps, Committed_AS_byte, etc.
        var formatter=[], unitSuffix=[];
        for(var i = 0;i<fitted_data.length;i++){
            var split = fitted_data[i].metric,
                measure = split[split.length-1];
            if(measure) {
                var u = measure.split('_').slice(-1)[0];
            }
            if(unit[u]) {
                formatter[formatter.length] = unit[u];
                unitSuffix[unitSuffix.length] = u;
            } else {
                formatter[formatter.length] = utility.numberFormatter;
                unitSuffix[unitSuffix.length] = "";
            }
        }

        var graph = this.props.graph;
        utility.plotGraph('#graph' + graph._id,
            fitted_data,
            formatter
        );
        var that = this;
        $('#graph' + graph._id)
            .unbind()
            .bind("plothover", function (event, pos, item) {
                var tooltip = $('#tooltip' + graph._id);
                if(!item) {
                    tooltip.hide();
                    return;
                }
                var x = utility.dateFormat(new Date(item.datapoint[0]),"yyyy-MM-dd hh:mm:ss"),
                    y = utility.numberFormatter(item.datapoint[1],
                            null, unitSuffix[fitted_data[item.seriesIndex].metricIndex]),
                    metric = fitted_data[item.seriesIndex].metric,
                    ip = fitted_data[item.seriesIndex].ip,
                    position = utility.getElePosition(this);
                var left = item.pageX - position.left + 20,
                    top = item.pageY - position.top + 20;
                tooltip.html(ip + '<br>' + metric.toString().replace(",,",",") + '<br>' + y + '<br>' + x );
                if((item.pageX + tooltip.width()) > ($("body").width()-30)){
                    left -= (tooltip.width()+30);
                }
                tooltip.css({left:left,top:top}).show();
            })
            .bind("plotselected", function (event, ranges) {
                var timePeriod = [new Date(ranges.xaxis.from),new Date(ranges.xaxis.to)];
                $(".zoomTime .zoomInfo").html(
                    utility.dateFormat(timePeriod[0],"MM-dd hh:mm:ss")+" to "+
                    utility.dateFormat(timePeriod[1],"MM-dd hh:mm:ss"));
                that.props.onRefresh(timePeriod, 'stopRefresh');
            }
        );
        // Toggle serie legend labels to show/hide corresponding serie line
        $('#' + that.props.graph._id + ' td.legendLabel').parent()
            .map(function(index, label){ // this is jQuery selector map(), index comes first
                if(that.state.data[index].enabled) {
                    $(this).removeClass("disabled");
                } else {
                    $(this).addClass("disabled");
                }
                $(this).off().on('click', function () {
                    var data = that.state.data;
                    data[index].enabled = 1 - data[index].enabled;
                    that.setState({data: data});
                });
                var text = $(this).text();
                if(text.indexOf(",,")>0){
                    $(this).find(".legendLabel").text(text.replace(",,",","));
                }
        });
    },
    showShareDialog: function() {
        this.props.showShareDialog(this.props.graph._id);
    },
    showGraphEditDialog: function() {
        this.props.showEditDialog(this.props.graph._id);
    },
    render: function(){
        var graph = this.props.graph;
        var placeholderText = "Click Here to Edit Graph Name";
        if(graph.title!=null&&graph.title!="") placeholderText = graph.title;

        return (
            <div id={graph._id}>
                <div className="graph">
                    <input type="text" name="title" className="titleInput" placeholder={placeholderText}/>
                    <div className="loading"></div>
                    <div id={'graph' + graph._id}
                         style={{width: '100%', height: '145px',backgroundColor: "#1f1f1f",marginTop:'10px'}}>
                    </div>
                    <div id={'tooltip' + graph._id}
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
                    <div className='shareBtnParent'>
                        <div className="graphBtn" onClick={this.showShareDialog}>
                            <i className='fa fa-share fa-white'></i>
                        </div>
                    </div>
                    <div className="btnParent">
                        <div className="graphBtn" onClick={this.showGraphEditDialog}>
                            <i className="fa fa-pencil fa-white"></i>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
});

module.exports = BaseGraph;
