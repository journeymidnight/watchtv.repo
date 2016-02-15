var React = require('react');
var Dialog = require('material-ui/lib/dialog');
var TextField = require('material-ui/lib/text-field');

var mixins = require('./mixins.js');
var NavigationBar = require('./ui/navigationBar.js');
var utility = require('./utility.js');
var BaseGraph  = require('./ui/baseGraph.js');
var Zoom  = require('./ui/zoomGraph.js');
var GraphEditor = require('./ui/graphEditor.js');

var GraphList = React.createClass({
    mixins: [mixins.materialMixin],
    getInitialState: function () {
        var url = window.location.href,
            node_id = url.split("?")[1].split("=")[1];
        return {
            graphs: [],
            defaultGraphs: [],
            measurements: null,
            period: utility.periodFromTimeLength(43200), // last 12h by default
            node:{
                _id: node_id,
                ips: [],
                project:{name:""},
                idc:{name:""},
                region:{name:""},
                description:""
            },//node info
            shareContent: ''
        };
    },
    getBasics: function () {
        var that = this;
        $.ajax({
            url: "/node/" + this.state.node._id,
            type: "GET",
            success: function(data) {
                var ips = [];
                if(data.metricIdentifier) {
                    ips = [data.metricIdentifier];
                } else {
                    ips = data.ips;
                }
                that.setState({node: data});

                // Similar to graphSelector.js
                $.ajax({
                    url: '/timeseries/meta?node=' + that.state.node._id,
                    dataType: 'json',
                    success: function (data) {
                        if(!$.isEmptyObject(data)) {
                            that.setState({measurements: data});
                        }
                    },
                    error: function (xhr, status, err) {
                        console.error('Error initialize measurements structure',
                            status, err.toString());
                    }
                });

                $.ajax({
                    url: '/graphs/default',
                    type: 'GET',
                    success: function(data) {
                        var graphs = data.map(function(graph) {
                            return {
                                _id: graph._id,
                                metrics: graph.metrics,
                                title: graph.title,
                                ips: ips
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
            url: "/node/" + this.state.node._id + '/graphs',
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
    refreshGraphs: function() {
        this.getNodeGraphs();
    },
    updateGraph: function(graph) {
        var graphs = this.state.graphs;
        for(var i=0;i<graphs.length;i++) {
            if(graphs[i]._id === graph._id) {
                graphs[i].ips = graph.ips;
                graphs[i].metrics = graph.metrics;
            }
        }
        this.setState({graphs: graphs});
    },
    refreshTime: function(timePeriod, stopRefresh) {
        if(stopRefresh) this.refs.zoom.stopRefresh();
        this.setState({period:timePeriod});
    },
    showShareDialog: function(graphID) {
        var graph = null;
        for(var i=0;i<this.state.graphs.length;i++){
            if(this.state.graphs[i]._id === graphID){
                graph = this.state.graphs[i];
                break;
            }
        }
        if(graph) {
            var shareContent = '[' + JSON.stringify({
                    ips: graph.ips,
                    metrics: graph.metrics,
                    title: graph.title
                }) + ']';
            this.setState({shareContent: shareContent});
            this.refs.shareDialog.show();
        }
    },
    showEditDialog: function(graphID) {
        if(!graphID) {
            this.refs.graphEditor.show();
            return;
        }
        var graph = null;
        for(var i=0;i<this.state.graphs.length;i++){
            if(this.state.graphs[i]._id === graphID){
                graph = this.state.graphs[i];
                break;
            }
        }
        this.refs.graphEditor.show(graph);
    },
    render: function(){
        var that = this;
        var defaultGraphList = that.state.defaultGraphs.map(function(graph) {
            // same reason as in `dashboard.js`
            var graphCopy = {
                _id: graph._id,
                title: graph.title,
                ips: graph.ips.slice(),
                metrics: graph.metrics.slice()
            };
            return <BaseGraph key={graph._id}
                              graph={graphCopy}
                              period={that.state.period}
                              onRefresh={that.refreshTime}
                              showShareDialog={that.showShareDialog}
                              // default graph cannot be edited
                              showEditDialog={function() {}}
                   />;
        });
        var graphList = that.state.graphs.map(function(graph) {
            var graphCopy = {
                _id: graph._id,
                title: graph.title,
                ips: graph.ips.slice(),
                metrics: graph.metrics.slice()
            };
            return <BaseGraph key={graph._id}
                              graph={graphCopy}
                              period={that.state.period}
                              onRefresh={that.refreshTime}
                              showShareDialog={that.showShareDialog}
                              showEditDialog={that.showEditDialog}
                   />;
        });
        return (
            <div>
                <Zoom onRefresh={this.refreshTime} period={this.state.period} ref="zoom"/>
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
                <GraphEditor ips = {this.state.node.metricIdentifier ?
                                        [this.state.node.metricIdentifier] : this.state.node.ips}
                             node_id={this.state.node._id}
                             measurements={this.state.measurements}
                             onRefresh={this.refreshGraphs}
                             onUpdate={this.updateGraph}
                             ref="graphEditor"
                />
                <Dialog title="Copy the contents below to share this graph"
                        actions={[{text: 'Close'}]}
                        autoDetectWindowHeight={true} autoScrollBodyContent={true}
                        ref='shareDialog'>
                    <TextField value={this.state.shareContent} style={{width: '90%'}}
                               multiLine={true} />
                </Dialog>
                <div className="btnParent" >
                    <div className="graphBtn" onClick={this.showEditDialog}>
                        <i className="fa fa-plus fa-white"></i>
                    </div>
                </div>
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
