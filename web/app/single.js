var React = require('react');
var mui = require('material-ui');

var mixins = require('./mixins.js');
var NavigationBar = require('./ui/navigationbar.js');
var Utility = require('./utility.js');
var BaseGraph  = require('./ui/baseGraph.js');
var GraphInfo = require('./ui/graphInfo.js');

var GraphList = React.createClass({
    mixins: [mixins.materialMixin, mixins.configMixin],
    setStateCallback: function () {
        console.log('setState', arguments);
    },
    getInitialState: function () {
        var url = window.location.href,
            node_id = url.split("?")[1].split("=")[1];
        return {
            arr: [],
            defaultArr: [],
            zoomTimeList: Utility.getTimeList(),
            zoomTimeIndex: 5, // last 12h
            timeList: [],
            ips: [],
            nodeGraph: {
                node_id: node_id,
                graphInfo: [],
                graphListIndex: null
            }
        };
    },
    refresh: function () {
        var url = window.location.href,
            node_id = url.split("?")[1].split("=")[1],
            that = this;
        $.when(
            $.ajax({
                url: "/user",
                type: "get"
            }),
            $.ajax({
                url: "node/" + node_id,
                type: "get"
            })
                // the "result"s are in structure [ data, statusText, jqXHR ]
        ).done(function(getUserResult, getNodeResult){
                var currUser = getUserResult[0]._id,
                    ips = getNodeResult[0].ips,
                    _id = getNodeResult[0]._id,
                    graphInfo = getNodeResult[0].graphInfo,
                    graphListIndex;

                //ips  需要一个_id值
                var ipsWithId = [];
                for(var i = 0;i<ips.length;i++){
                    ipsWithId[i] = {text: ips[i],value:_id,default:false};
                }

                if(graphInfo == null || graphInfo.length === 0){
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
                var graphRequests = [];
                graphs.map(function(graph) {
                    graphRequests.push(
                        $.ajax({
                            url:"graph/" + graph,
                            type:"get"
                        })
                    );
                });
                if (graphRequests.length === 0) {
                    that.setState(function() {
                        return {
                            arr: [],
                            ips: ipsWithId,
                            nodeGraph: {
                                node_id: node_id,
                                graphInfo: graphInfo,
                                graphListIndex: graphListIndex
                            }
                        };
                    }, that.setStateCallback);
                } else {
                    $.when.apply(undefined, graphRequests)
                     .then(function() {
                            // If there's only one graphRequest, arguments is in structure
                            // [ data, statusText, jqXHR ];
                            // if there're multiple graphRequests, arguments is an array of
                            // [ data, statusText, jqXHR ], so some branches are needed here
                            var arr = [];
                            if(graphRequests.length === 1) {
                                arr[0] = {
                                    ip: arguments[0].ips,
                                    node_id: arguments[0]._id,
                                    timePeriod: "43200", // last 12h
                                    metricArr: arguments[0].metrics,
                                    title: arguments[0].title,
                                    key: arguments[0]._id
                                };
                            } else {
                                for(var i=0; i<graphRequests.length; i++) {
                                    arr[i] = {
                                        ip: arguments[i][0].ips,
                                        node_id: arguments[i][0]._id,
                                        timePeriod: "43200", // last 12h
                                        metricArr: arguments[i][0].metrics,
                                        title: arguments[i][0].title,
                                        key: arguments[i][0]._id
                                    };
                                }
                            }
                            that.setState(function() {
                                return {
                                    arr: arr,
                                    ips: ipsWithId,
                                    nodeGraph: {
                                        node_id: node_id,
                                        graphInfo: graphInfo,
                                        graphListIndex: graphListIndex
                                    }
                                };
                            });
                        });
                }
                //获取默认的graph
                $.ajax({
                    url: "graphs/default",
                    type: "get",
                    success: function (data) {
                        var defaultArr = [];
                        for(var i = 0;i<data.length;i++){
                            defaultArr[i] = {
                                ip:ips.toString().split(";"),
                                node_id:data[i]._id,
                                timePeriod:"43200",//last 12h
                                metricArr:data[i].metrics,
                                title:data.title,
                                key: data[i]._id
                            };
                        }
                        that.setState(function() {
                            return {defaultArr: defaultArr};
                        });
                    }
                });
            }
        );
    },
    componentDidMount: function() {
        this.refresh();
    },
    refreshGraph: function(dashboards,fromTime,toTime){
        var timePeriod;
        this.refresh();
        if(fromTime!=null && toTime!=null)
            timePeriod = [new Date(fromTime),new Date(toTime)]
        this.setState({timePeriod:timePeriod});
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
            arr = this.state.arr,
            defaultArr = this.state.defaultArr;
        $(".zoomTime .zoomInfo").html(text);
        $(".zoomTime li,.zoomTime .zoomInfo").removeClass("selected");
        obj.addClass("selected");
        $(".zoomTime ul").hide();
        for(var i=0;i<arr.length;i++){
            arr[i].timePeriod = value;
        }
        for(var i=0;i<defaultArr.length;i++){
            defaultArr[i].timePeriod = value;
        }
        this.setState({arr:arr,defaultArr:defaultArr,zoomTimeIndex:obj.index(),timePeriod:null});
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
        var defaultList = _this.state.defaultArr.map(function(subArr) {
            return <BaseGraph selected={subArr} config={_this.state.config} key={subArr.key}
                              timeList={_this.state.timeList} ips={_this.state.ips}
                              timePeriod={_this.state.timePeriod}
                              onRefresh={_this.refreshGraph} nodeGraph={_this.state.nodeGraph}
                              type='single' />
        });
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
                    <div className="singleDefault">{defaultList}</div>
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
