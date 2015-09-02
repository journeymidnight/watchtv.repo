var React = require('react');

var mixins = require('./mixins.js');
var NavigationBar = require('./ui/navigationbar.js');
var Utility = require('./utility.js');
var BaseGraph  = require('./ui/baseGraph.js');
var GraphInfo = require('./ui/graphInfo.js');

var GraphList = React.createClass({
    mixins: [mixins.materialMixin, mixins.configMixin],
    getInitialState:function(){
        return this.init();
    },
    init: function(){
        var graphs,arr=[],ips = [];
        var timeList = Utility.getTimeList();
        $.ajax({
            url:"/user",
            type:"get",
            async:false,
            success:function(data){
                graphs = data.graphs;
                for(var i = 0;i<graphs.length;i++){
                    var metricArr = graphs[i].metrics;
                    arr[i] = {
                        ip:graphs[i].ips,
                        node_id:graphs[i]._id,
                        timePeriod:graphs[i].time,
                        metricArr:metricArr,
                        key: graphs[i].ips+graphs[i]._id+metricArr
                    }
                }
            }
        });
        $.ajax({
            url: 'nodes',
            dataType: 'json',
            async:false,
            success: function(data) {
                if(data.total > 0){
                    node_id = data.result[0]._id;
                    for(var i = 0;i<data.result.length;i++){
                        ips[i] = {text: data.result[i].ips.toString(),value:data.result[i]._id,defalt:false};
                    }
                }
            },
            error: function(xhr, status, err){
                console.error(this.props.url, status, err.toString())
            }.bind(this)
        });
        return {
            arr:arr,
            timeList:timeList,
            ips:ips
        };
    },
    refreshGraph: function(dashboards){
        var state = this.init();
        this.setState({arr:state.arr});
    },
    render: function(){
        var _this = this;
        var graphList = _this.state.arr.map(function(subArr,index) {
            return <BaseGraph selected={subArr} config={_this.state.config} index={index} key = {subArr.key} 
                              timeList = {_this.state.timeList} ips = {_this.state.ips}
                              onRefresh={_this.refreshGraph} />
        });
        return (
            <div>
                <div className="graphList">
                    {graphList}
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
