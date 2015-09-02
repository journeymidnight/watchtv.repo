var React = require('react');
var mui = require('material-ui');

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
        var graphs=[],arr=[],ips,_id,graphListIndex=0,graphInfo=[];
        var url = window.location.href,
            node_id = url.split("?")[1].split("=")[1];
        var zoomTimeList = Utility.getTimeList();
        var currUser;
        $.ajax({
            url:"/user",
            type:"get",
            async:false,
            success:function(data){
                currUser = data._id;
            }
        });
        $.ajax({
            url:"node/"+node_id,
            type:"get",
            async:false,
            success:function(data){
                ips = data.ips;
                _id = data._id;
                graphInfo = data.graphInfo;
                for(var i = 0;i<graphInfo.length;i++){
                    var userId = graphInfo[i].user;
                    if(currUser == userId){
                        graphs = graphInfo[i].graphs;
                        graphListIndex = i;
                        break;
                    }
                }
                if(graphInfo == null || graphInfo.length == 0){
                    graphInfo = [{
                        user:currUser,
                        graphs:[]
                    }];
                    graphListIndex = 0;
                }
                for(var i = 0;i<graphs.length;i++){
                    $.ajax({
                        url:"graph/"+graphs[i],
                        type:"get",
                        async:false,
                        success:function(data){
                            arr[i] = {
                                ip:data.ips,
                                node_id:data._id,
                                timePeriod:"300",
                                metricArr:data.metrics,
                                key: data.ips+data._id+data.metrics
                            }
                        }
                    });
                }
            }
        });
        //ips  需要一个_id值
        for(var i = 0;i<ips.length;i++){
            ips[i] = {text: ips[i],value:_id,defalt:false};
        }
        return {
            arr:arr,
            zoomTimeList:zoomTimeList,
            zoomTimeIndex:0,
            timeList:[],
            ips:ips,
            nodeGraph:{
                node_id:node_id,
                graphInfo:graphInfo,
                graphListIndex:graphListIndex
            }
        };
    },
    refreshGraph: function(dashboards){
        var state = this.init();
        this.setState({arr:state.arr});
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
            arr = this.state.arr;
        $(".zoomTime .zoomInfo").html(text);
        $(".zoomTime li,.zoomTime .zoomInfo").removeClass("selected");
        obj.addClass("selected");
        $(".zoomTime ul").hide();
        for(var i=0;i<arr.length;i++){
            arr[i].timePeriod = value;
        }
        this.setState({arr:arr,zoomTimeIndex:obj.index()});
    },
    render: function(){
        var _this = this;
        var graphList = _this.state.arr.map(function(subArr,index) {
            return <BaseGraph selected={subArr} config={_this.state.config} index={index} key = {subArr.key}
                              timeList = {_this.state.timeList} ips = {_this.state.ips}
                              onRefresh={_this.refreshGraph} nodeGraph={_this.state.nodeGraph}/>
        });
        var zoomTimeList = _this.state.zoomTimeList.map(function(subArr,index){
            return <li value={subArr.value} key={index} onClick={_this.changeTimeList}>{subArr.text}</li>;
        });
        return (
            <div>
                <div className="zoomTime">
                    <div className="zoom" onClick = {this.zoomOut}>Zoom Out</div>
                    <div>
                        <div className="zoomInfo" onClick={this.showZoomTime}>{_this.state.zoomTimeList[0].text}</div>
                        <ul>
                            {zoomTimeList}
                        </ul>
                    </div>
                </div>
                <div className="graphList">
                    {graphList}
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
