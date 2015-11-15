var React = require('react');
var Dialog = require('material-ui/lib/dialog');
var TextField = require('material-ui/lib/text-field');

var mixins = require('./mixins.js');
var NavigationBar = require('./ui/navigationBar.js');
var BaseGraph  = require('./ui/baseGraph.js');
var Zoom  = require('./ui/zoomGraph.js');
var GraphEditor = require('./ui/dashboardGraphEditor.js');
var utility = require('./utility.js');

var GraphList = React.createClass({
    mixins: [mixins.materialMixin],
    getInitialState: function () {
        return {
            graphs: [],
            shareContent: '',
            period: utility.periodFromTimeLength(43200)  // last 12h by default
        };
    },
    getUserGraphs: function () {
        var that = this;
        $.ajax({
            url: '/user/graphs',
            type: 'GET',
            success: function (data) {
                that.setState({graphs: data});
            },
            error: function (xhr, status, error) {
                if (xhr.status === 401) {
                    location.assign('/login.html');
                }
                console.log('Error fetching user graphs', xhr, status, error);
            }
        });
    },
    componentDidMount: function () {
        this.getUserGraphs();
    },
    refreshGraph: function (fromTime, toTime, timePeriod,stopRefresh) {
        if(stopRefresh!=null){
            this.setState({stopRefresh:true});
        }
        if(fromTime != null && toTime != null) {
            // scale graphs
            var timePeriod;
            timePeriod = [new Date(fromTime), new Date(toTime)];
            this.setState({timePeriod:timePeriod});
            return;
        }else if(timePeriod!=null){//new graph
            this.setState({timePeriod:timePeriod},this.getUserGraphs());
        }else{
            this.getUserGraphs();//delete
        }
    },
    refreshGraphs: function() {
        this.getUserGraphs();
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
    refreshTime: function(timePeriod, stopRefresh){
        if(stopRefresh) this.refs.zoom.stopRefresh();
        this.setState({period: timePeriod});
    },
    importGraph: function() {
        var that = this, graphs;
        var graphJson = this.refs.graphInput.getValue().trim();
        try {
            graphs = JSON.parse(graphJson);
        } catch (e) {
            this.refs.parseErrorDialog.show();
            return;
        }
        $.ajax({
            url: '/user/graphs/imports',
            type: 'POST',
            data: {
                graphs: graphs
            },
            success: function() {
                that.getUserGraphs();
            },
            error: function(xhr, status, error) {
                if (xhr.status === 401) {
                    location.assign('/login.html');
                }
                console.log('Error adding user graph', xhr, status, error);
            }
        });
        this.refs.graphImportDialog.dismiss();
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
    showGraphImportDialog: function() {
        this.refs.graphImportDialog.show();
    },
    render: function(){
        var _this = this;
        var graphList = this.state.graphs.map(function(graph) {
            // make a copy since we need to compare ips and metrics in baseGraph.
            // otherwise, in baseGraph `this.props` is always the same with `nextProps`,
            // since they are pointing to the same object
            var graphCopy = {
                _id: graph._id,
                title: graph.title,
                ips: graph.ips.slice(),
                metrics: graph.metrics.slice()
            };
            return <BaseGraph key={graph._id}
                              graph={graphCopy}
                              period={_this.state.period}
                              onRefresh={_this.refreshTime}
                              showShareDialog={_this.showShareDialog}
                              showEditDialog={_this.showEditDialog}
                   />
        });
        return (
            <div>
                <Zoom onRefresh={this.refreshTime} period={this.state.period} ref="zoom"/>
                <div className="graphList">
                    {graphList}
                </div>
                <GraphEditor onRefresh={this.refreshGraphs}
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
                <div className="importBtnParent">
                    <div className="importGraphBtn" onClick={this.showGraphImportDialog}>
                        <i className='fa fa-arrow-down fa-white'></i>
                    </div>
                    <Dialog title="Import graph"
                            actions={[
                                {text: 'Cancel'},
                                {text: 'Import', onClick: this.importGraph}
                            ]}
                            ref='graphImportDialog'>
                        <TextField hintText='Paste the JSON string here' ref='graphInput'
                                   style={{width: '90%'}} multiLine={true}
                        />
                    </Dialog>
                    <Dialog title="Cannot parse the content"
                            actions={[{ text: 'OK' }]}
                            ref="parseErrorDialog">
                        Please double check your input
                    </Dialog>
                </div>
            </div>
        );
    }
});

React.render(
    <div>
        <NavigationBar title="Dashboard" />
        <GraphList />
    </div>,
    document.getElementById('content')
);
