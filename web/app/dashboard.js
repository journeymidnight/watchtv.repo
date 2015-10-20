var React = require('react');

var mixins = require('./mixins.js');
var NavigationBar = require('./ui/navigationbar.js');
var BaseGraph  = require('./ui/baseGraph.js');
var GraphEditor = require('./ui/dashboardGraphEditor.js');

var GraphList = React.createClass({
    mixins: [mixins.materialMixin, mixins.configMixin],
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
                var graphs = data.map(function (graph) {
                    return {
                        ips: graph.ips,
                        metrics: graph.metrics,
                        time: graph.time,
                        title: graph.title,
                        _id: graph._id
                    };
                });
                that.setState({graphs: graphs});
            },
            error: function (xhr, status, error) {
                console.log('Error fetching user graphs', xhr, status, error);
            }
        });
    },
    refreshGraph: function () {
        this.getUserGraphs();
    },
    componentDidMount: function () {
        this.getUserGraphs();
    },
    render: function(){
        var _this = this;
        var graphList = this.state.graphs.map(function(graph) {

            return <BaseGraph config={_this.state.config} key={graph._id}
                              graph={graph}
                              onRefresh={_this.refreshGraph}
                              graphEditor={GraphEditor}
                   />
        });
        return (
            <div>
                <div className="graphList">
                    {graphList}
                </div>
                <GraphEditor title="Add new dashboard"
                             onRefresh={this.refreshGraph}
                             config={this.state.config}
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
