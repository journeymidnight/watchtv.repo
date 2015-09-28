var React = require('react');
var mui = require('material-ui');

var mixins = require('./mixins.js');
var NavigationBar = require('./ui/navigationbar.js');
var Utility = require('./utility.js');
var BaseGraph  = require('./ui/baseGraph.js');
var GraphInfo = require('./ui/graphInfo.js');

var GraphList = React.createClass({
    mixins: [mixins.materialMixin, mixins.configMixin],
    getInitialState: function () {
        return this.init();
    },
    init: function () {
        var graphs = [], arr = [], ips, _id, graphListIndex, graphInfo = [],
            url = window.location.href,
            node_id = url.split("?")[1].split("=")[1],
            zoomTimeList = Utility.getTimeList(),
            currUser;
        $.ajax({
            url: "/user",
            type: "get",
            async: false,
            success: function (data) {
                currUser = data._id;
            }
        });
        $.ajax({
            url: "node/" + node_id,
            type: "get",
            async: false,
            success: function (data) {
                ips = data.ips;
                _id = data._id;
                graphInfo = data.graphInfo;
                if(graphInfo == null || graphInfo.length == 0){
                    graphInfo = [{
                        user:currUser,
                        graphs:[]
                    }];
                    graphListIndex = 0;
                }
                for(var i = 0;i<graphInfo.length;i++){
                    var userId = graphInfo[i].user;
                    if(currUser == userId){
                        graphs = graphInfo[i].graphs;
                        graphListIndex = i;
                        break;
                    }
                }
                if(graphListIndex == null) {
                    graphListIndex = graphInfo.length;
                    graphInfo[graphListIndex] = {
                        user: currUser,
                        graphs: []
                    };
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
                                timePeriod:"43200",//last 12h
                                metricArr:data.metrics,
                                key: data._id
                            }
                        }
                    });
                }
            }
        });
        //ips  需要一个_id值
        for(var i = 0;i<ips.length;i++){
            ips[i] = {text: ips[i],value:_id,default:false};
        }
        return {
            arr:arr,
            zoomTimeList:zoomTimeList,
            zoomTimeIndex:5,//last 12h
            timeList:[],
            ips:ips,
            nodeGraph:{
                node_id:node_id,
                graphInfo:graphInfo,
                graphListIndex:graphListIndex
            }
        };
    },
    refreshGraph: function(dashboards,fromTime,toTime){
        var state = this.init(),timePeriod;
        if(fromTime!=null && toTime!=null)
            timePeriod = [new Date(fromTime),new Date(toTime)]
        this.setState({arr:state.arr,timePeriod:timePeriod});
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
        this.setState({arr:arr,zoomTimeIndex:obj.index(),timePeriod:null});
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
        var _this = this;
        var graphList = _this.state.arr.map(function(subArr) {
            return <BaseGraph selected={subArr} config={_this.state.config} key={subArr.key}
                              timeList={_this.state.timeList} ips={_this.state.ips}
                              timePeriod={_this.state.timePeriod}
                              onRefresh={_this.refreshGraph} nodeGraph={_this.state.nodeGraph}
                              type='single' />
        });
        var zoomTimeList = _this.state.zoomTimeList.map(function(subArr,index){
            if(index == 5)//last 12h
                return <li className="selected" value={subArr.value} key={index} onClick={_this.changeTimeList}>{subArr.text}</li>;
            else
                return <li value={subArr.value} key={index} onClick={_this.changeTimeList}>{subArr.text}</li>;
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
                    {graphList}
                </div>
                <GraphInfo type="node" title="add new dashboard" dialogId="dialogAdd"
                           timeList = {this.state.timeList} ips = {this.state.ips}
                           onRefresh={this.refreshGraph} nodeGraph={this.state.nodeGraph}/>
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
