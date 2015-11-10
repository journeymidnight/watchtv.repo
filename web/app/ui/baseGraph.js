var React = require('react');
var Dialog = require('material-ui/lib/dialog');
var TextField = require('material-ui/lib/text-field');

var unit = require('../unit.js');
var Utility = require('../utility.js');

// The component to actually draw a graph

// data structures:
// data: [{data: [metric data from DB], ip: '1.2.3.4', metric: 'cpu,cpu0,idle',
//          metricIndex: 2, enabled: 1}, ...]
// formatters: [formatter for metricIndex[0], formatter for metricIndex[1], ...]
// suffixes: [suffix for metricIndex[0], suffix for metricIndex[1], ...]
// graph: same as in DB schema

// props:
// graph: graph object described above. The graphs to draw are (graph.ips x graph.metrics)
// node_id: mongodb id. Used to build URLs, could be null for Dashboard page, but not
//                      for Single page.
// nodeIPs: array of string. Used for single page to select from.
// graphEditor: react component, could be dashboardGraphEditor or singleGraphEditor.
//              Used to render the edit dialog.
// onRefresh: callback function(fromTime, toTime).

// measurements: pass through to graphEditor, then GraphSelector

var BaseGraph = React.createClass({
    getInitialState: function(){
        return {
            data: [],
            ips: this.props.graph.ips,
            metrics: this.props.graph.metrics,
            time: this.props.graph.time,
            title: this.props.graph.title,
            windowWidth: $(window).width()
        };
    },
    queryInfluxDB: function(queryString, ip, metric, metricIndex, newTimePeriod) {
        $.ajax({
            url: '/influxdb/query?' + encodeURIComponent(queryString),
            dataType: 'json',
            success: function (data) {
                var currdata = this.state.data;
                currdata[currdata.length] = {
                    data:Utility.get_value(data),
                    ip:ip,
                    metric:metric,
                    metricIndex: metricIndex,
                    enabled: 1  // 1 for enabled, 0 for disabled. If shown on graph
                };
                // A workaround. Should reconsider the relationship between time and timePeriod
                if(this.props.node_id) {
                    this.setState({data: currdata});
                } else {
                    this.setState({data: currdata, timePeriod: newTimePeriod});
                }
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
        }, this.handleGraph);
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
                if (xhr.status === 401) {
                    location.assign('/login.html');
                }
                console.log('Error updating user graph', xhr, status, error);
            }
        });
    },
    getFittedData: function(){
        var fitted_data=[];
        for(var i = 0;i<this.state.data.length;i++){
            fitted_data[i] = {
                data: this.state.data[i].enabled ?
                    Utility.fitData(this.state.data[i].data) : [],
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
    componentDidMount: function () {
        var that = this;

        // check and set the state of windowWidth so as to redraw the graphs
        // when window width changes
        var checkWindowWidth = function () {
            var windowWidth = $(window).width();
            return function () {
                if(windowWidth !== $(window).width()) {
                    windowWidth = $(window).width();
                    that.setState({windowWidth: windowWidth});
                }
            };
        }();
        setInterval(checkWindowWidth, 1200);

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
                    obj.html(ip + '<br>' + metric.toString().replace(",,",",") + '<br>' + y + '<br>' + x );
                    if((item.pageX + obj.width()) > ($("body").width()-30)){
                        left -= (obj.width()+30);
                    }
                    obj.css({left:left,top:top}).show();
                } else {
                    $('#tooltip' + uniq_id).hide();
                }
            })
            .bind("plotselected", function (event, ranges) {
                var timePeriod = [new Date(ranges.xaxis.from),new Date(ranges.xaxis.to)];
                $(".zoomTime .zoomInfo").html(
                    Utility.dateFormat(timePeriod[0],"MM-dd hh:mm:ss")+" to "+
                    Utility.dateFormat(timePeriod[1],"MM-dd hh:mm:ss"));
                that.props.onRefresh(ranges.xaxis.from,ranges.xaxis.to);
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
    componentWillReceiveProps:function(nextProps){
        //graph drag & zoom out & refresh
        if(nextProps.timePeriod!=null&&nextProps.timePeriod !== this.state.timePeriod) {
            this.setState({data:[], timePeriod: nextProps.timePeriod},
                this.handleGraph(nextProps.timePeriod));
        }
    },
    showShareDialog: function () {
        this.refs.shareDialog.show();
    },
    render: function(){
        var placeholderText = "Click Here to Edit Graph Name";
        if(this.state.title!=null&&this.state.title!="") placeholderText = this.state.title;

        var uniq_id = Utility.generateKeyForGraph(this.props.graph);
        var shareAction = [{text: 'Close'}];
        var shareContent = '[' + JSON.stringify({
            ips: this.state.ips,
            metrics: this.state.metrics,
            time: this.state.time,
            title: this.state.title
        }) + ']';
        return (
            <div id={this.props.graph._id}>
                <Dialog title="Copy the contents below to share this graph" actions={shareAction}
                        autoDetectWindowHeight={true} autoScrollBodyContent={true}
                        ref='shareDialog'>
                    <TextField value={shareContent} style={{width: '90%'}}
                               multiLine={true} />
                </Dialog>
                <div className="graph">
                    <input type="text" name="title" className="titleInput" placeholder={placeholderText}/>
                    <div className="loading"></div>
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
                    <div className='shareBtnParent'>
                        <div className="graphBtn" onClick={this.showShareDialog}>
                            <i className='fa fa-share fa-white'></i>
                        </div>
                    </div>
                    <this.props.graphEditor title="Edit" initialIPs={this.state.ips}
                                            ips={this.props.nodeIPs}
                                            initialMetrics={this.state.metrics}
                                            initialTime={this.state.time}
                                            onUpdate={this.handleEditorUpdate}
                                            onRefresh={this.handleDeleteSelf}
                                            graph_id={this.props.graph._id}
                                            node_id={this.props.node_id}
                                            measurements={this.props.measurements}
                    />
                </div>
            </div>
        )
    }
});

module.exports = BaseGraph;
