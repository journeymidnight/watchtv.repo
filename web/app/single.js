var React = require('react');

var mixins = require('./mixins.js');
var NavigationBar = require('./ui/navigationBar.js');
var Utility = require('./utility.js');
var BaseGraph  = require('./ui/baseGraph.js');
var Zoom  = require('./ui/zoomGraph.js');
var GraphEditor = require('./ui/graphEditor.js');

var GraphList = React.createClass({
    mixins: [mixins.materialMixin],
    getInitialState: function () {
        var url = window.location.href,
            node_id = url.split("?")[1].split("=")[1];
        return {
            node_id: node_id,
            graphs: [],
            defaultGraphs: [],
            ips: [],
            measurements: null,
            timePeriod: null,
            node:{
                project:{name:""},
                idc:{name:""},
                region:{name:""},
                description:"",
            },//node info
            refreshTimePeriod:[]//zoom out 以及 自动刷新后展示graph的新的时间段
        };
    },
    getBasics: function () {
        var that = this;
        $.ajax({
            url: "/node/" + this.state.node_id,
            type: "GET",
            success: function(data) {
                var ips = data.ips;
                that.setState({ips: ips,node:data});

                for(var i = 0; i<ips.length; i++) {
                    var hostIP = Utility.dotted2underscoredIP(ips[i]);
                    // Similar to graphSelector.js
                    $.ajax({
                        url: '/influxdb/query?' +
                            encodeURIComponent("SHOW SERIES WHERE host='" + hostIP + "'"),
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
                                title: graph.title,
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
                if (xhr.status === 401) {
                    location.assign('/login.html');
                }
                console.log('Error fetching node graphs', xhr, status, error);
            }
        });
    },
    componentDidMount: function() {
        this.getBasics();
        this.getNodeGraphs();
    },
    refreshGraph: function(fromTime, toTime, timePeriod){
        if(fromTime != null && toTime != null) {//drag
            // scale graphs
            var timePeriod;
            timePeriod = [new Date(fromTime), new Date(toTime)];
            this.setState({timePeriod:timePeriod});
            return;
        }else if(timePeriod!=null){//new graph
            this.setState({timePeriod:timePeriod},this.getNodeGraphs());
        }else{
            this.getNodeGraphs();//delete
        }
    },
    refreshTime: function(timePeriod){//zoom out
        this.setState({timePeriod:timePeriod});
    },
    render: function(){
        var that = this;
        var defaultGraphList = that.state.defaultGraphs.map(function(graph) {
            // default graphs are not editable by users
            var dummyEditor = React.createClass({render: function () {return <div></div>}});
            return <BaseGraph key={graph._id}
                              graph={graph} onRefresh={that.refreshGraph}
                              node_id={that.state.node_id}
                              graphEditor={dummyEditor}
                              timePeriod={that.state.timePeriod}
                   />;
        });
        var graphList = that.state.graphs.map(function(graph) {
            return <BaseGraph key={graph._id}
                              graph={graph} onRefresh={that.refreshGraph}
                              node_id={that.state.node_id}
                              nodeIPs={that.state.ips}
                              measurements={that.state.measurements}
                              graphEditor={GraphEditor}
                              timePeriod={that.state.timePeriod}
                              refreshTimePeriod={that.state.refreshTimePeriod}
                   />;
        });
        return (
            <div>
                <Zoom onRefresh={this.refreshTime}/>
                <div className="nodeInfo">
                    <span>IP:{this.state.node.ips}</span>
                    <span>Project:{this.state.node.project.name}</span>
                    <span>IDC:{this.state.node.idc.name}</span>
                    <span>Region:{this.state.node.region.name}</span>
                    <span>Description:{this.state.node.description}</span>
                </div>
                <div className="graphList">
                    <div className="singleDefault">{defaultGraphList}</div>
                    {graphList}
                </div>
                <GraphEditor title="Add new graph"
                             ips = {this.state.ips}
                             needToQueryMeasurements={false}
                             measurements={this.state.measurements}
                             onRefresh={this.refreshGraph}
                             node_id={this.state.node_id}
                             timePeriod={this.state.timePeriod}
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
