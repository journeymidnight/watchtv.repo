var React = require('react');
var mui = require('material-ui');

var mixins = require('./mixins.js');
var NavigationBar = require('./ui/navigationbar.js');
var Utility = require('./utility.js');
var BaseGraph  = require('./ui/baseGraph.js');
var GraphEditor = require('./ui/graphEditor.js');

var GraphList = React.createClass({
    mixins: [mixins.materialMixin, mixins.configMixin],
    getInitialState: function () {
        var url = window.location.href,
            node_id = url.split("?")[1].split("=")[1];
        return {
            node_id: node_id,
            graphs: [],
            defaultGraphs: [],
            zoomTimeIndex: 5, // last 12h
            ips: [],
            measurements: null,
            timePeriod: null
        };
    },
    getBasics: function () {
        var that = this;
        $.ajax({
            url: "/node/" + this.state.node_id + '/ips',
            type: "GET",
            success: function(data) {
                var ips = data.ips;
                that.setState({ips: ips});

                for(var i = 0; i<ips.length; i++) {
                    var hostIP = Utility.dotted2underscoredIP(ips[i]);
                    // Similar to graphSelector.js
                    $.ajax({
                        url: that.state.config.influxdbURL + '/query?' + $.param(
                            Utility.q_param(that.state.config,
                                "SHOW SERIES WHERE host='" + hostIP + "'")),
                        dataType: 'json',
                        success: function (data) {
                            var measurements = Utility.get_measurements(data);
                            if(!$.isEmptyObject(measurements)) {
                                that.setState({measurements: measurements});
                            }
                        },
                        error: function (xhr, status, err) {
                            console.error('Error init measurements structure', status, err.toString());
                        }
                    });
                }

                $.ajax({
                    url: '/graphs/default',
                    type: 'GET',
                    success: function(data) {
                        var graphs = data.map(function(graph) {
                            return {
                                _id: graph._id,
                                metrics: graph.metrics,
                                ips: ips,
                                time: 43200  // 12h by default
                            };
                        });
                        that.setState({defaultGraphs: graphs});
                    },
                    error: function (xhr, status, error) {
                        console.log('Error fetching default graphs', xhr, status, error);
                    }
                });

            },
            error: function(xhr, status, error) {
                console.log('Error fetching node IPs', xhr, status, error);
            }
        });
    },
    getNodeGraphs: function () {
        var that = this;
        $.ajax({
            url: "/node/" + this.state.node_id + '/graphs',
            type: "GET",
            success: function(data) {
                that.setState({graphs: data});
            },
            error: function(xhr, status, error) {
                console.log('Error fetching node graphs', xhr, status, error);
            }
        });
    },
    componentDidMount: function() {
        this.getBasics();
        this.getNodeGraphs();
    },
    refreshGraph: function(fromTime, toTime){
        if(fromTime != null && toTime != null) {
            // scale graphs
            var timePeriod;
            timePeriod = [new Date(fromTime), new Date(toTime)];
            this.setState({timePeriod:timePeriod});
            return;
        }
        this.getNodeGraphs();
    },
    showZoomTime:function(){
        $(".zoomTime ul").toggle();
        $(".zoomTime ul").css('display')=="none"?
                $(".zoomTime .zoomInfo").removeClass("selected"):$(".zoomTime .zoomInfo").addClass("selected");
    },
    zoomOut: function(){
        var index = this.state.zoomTimeIndex + 1;
        if(index > $(".zoomTime ul li").size()-1) return;
        var obj = $(".zoomTime ul li").eq(index);
        this.resetTime(obj);
    },
    changeTimeList:function(){
        var obj = Utility.getEvent().target;
        this.resetTime($(obj));
    },
    resetTime:function(obj){
        var text = obj.html(),
            value = obj.val(),
            graphs = this.state.graphs,
            defaultGraphs = this.state.defaultGraphs;
        $(".zoomTime .zoomInfo").html(text);
        $(".zoomTime li,.zoomTime .zoomInfo").removeClass("selected");
        obj.addClass("selected");
        $(".zoomTime ul").hide();
        for(var i=0;i<graphs.length;i++){
            graphs[i].time = value;
        }
        for(var i=0;i<defaultGraphs.length;i++){
            defaultGraphs[i].time = value;
        }
        this.setState({ graphs: graphs, defaultGraphs: defaultGraphs, zoomTimeIndex:obj.index() });
    },
    componentWillMount:function(){
        $("body").bind("click",function(){
            var event = Utility.getEvent();
            if($(event.target).parents(".zoomTime").size()==0){
                $(".zoomTime ul").hide();
                $(".zoomTime .zoomInfo").removeClass("selected");
            }
        });
    },
    render: function(){
        var that = this;
        var defaultGraphList = that.state.defaultGraphs.map(function(graph) {
            // default graphs are not editable by users
            var dummyEditor = React.createClass({render: function () {return <div></div>}});
            return <BaseGraph config={that.state.config} key={graph._id}
                              graph={graph} onRefresh={that.refreshGraph}
                              node_id={that.state.node_id}
                              graphEditor={dummyEditor}
                              timePeriod={that.state.timePeriod}
                   />;
        });
        var graphList = that.state.graphs.map(function(graph) {
            return <BaseGraph config={that.state.config} key={graph._id}
                              graph={graph} onRefresh={that.refreshGraph}
                              node_id={that.state.node_id}
                              nodeIPs={that.state.ips}
                              measurements={that.state.measurements}
                              graphEditor={GraphEditor}
                              timePeriod={that.state.timePeriod}
                   />;
        });
        var timeList = Utility.getTimeList();
        var zoomTimeList = timeList.map(function(subArr,index){
            if(index == 5)//last 12h
                return <li className="selected" value={subArr.value} key={index} onClick={that.changeTimeList}>{subArr.text}</li>;
            else
                return <li value={subArr.value} key={index} onClick={that.changeTimeList}>{subArr.text}</li>;
        });
        return (
            <div>
                <div className="zoomTime">
                    <div className="zoom" onClick = {this.zoomOut}>Zoom Out</div>
                    <div>
                        <div className="zoomInfo" onClick={this.showZoomTime}>last 12h</div>
                        <ul>
                            {zoomTimeList}
                        </ul>
                    </div>
                </div>
                <div className="graphList">
                    <div className="singleDefault">{defaultGraphList}</div>
                    {graphList}
                </div>
                <GraphEditor title="Add new graph"
                             ips = {this.state.ips}
                             needToQueryMeasurements={false}
                             measurements={this.state.measurements}
                             config={this.state.config}
                             onRefresh={this.refreshGraph}
                             node_id={this.state.node_id}
                />
            </div>
        );
    }
});

React.render(
    <div>
        <NavigationBar title="Single" />
        <GraphList />
    </div>,
    document.getElementById('content')
);
