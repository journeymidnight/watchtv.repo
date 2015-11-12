var React = require('react');

var mixins = require('./mixins.js');
var NavigationBar = require('./ui/navigationBar.js');
var BaseGraph  = require('./ui/baseGraph.js');
var Zoom  = require('./ui/zoomGraph.js');
var GraphEditor = require('./ui/dashboardGraphEditor.js');

var GraphList = React.createClass({
    mixins: [mixins.materialMixin],
    getInitialState: function () {
        return {
            graphs: []
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
    refreshTime: function(timePeriod){
        this.setState({timePeriod:timePeriod,stopRefresh:false});
    },
    render: function(){
        var _this = this;
        var graphList = this.state.graphs.map(function(graph) {
            return <BaseGraph key={graph._id}
                              graph={graph}
                              onRefresh={_this.refreshGraph}
                              graphEditor={GraphEditor}
                              timePeriod={_this.state.timePeriod}
                   />
        });
        return (
            <div>
                <Zoom onRefresh={this.refreshTime} stopRefresh={this.state.stopRefresh}/>
                <div className="graphList">
                    {graphList}
                </div>
                <GraphEditor title="Add new dashboard"
                             onRefresh={this.refreshGraph}
                             timePeriod={this.state.timePeriod}
                />
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
