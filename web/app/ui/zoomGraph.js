var React = require('react');

var Utility = require('../utility.js');

var Zoom = React.createClass({
    getInitialState: function () {
        return {
            zoomTimeIndex: 3, // last 12h
            refreshTime:0
        };
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
            value = obj.val();
        $(".zoomTime .zoomInfo").html(text);
        $(".zoomTime .zoomInfo").attr('data-info',Utility.fitTimePeriod(text));//存放时间段
        $(".zoomTime li,.zoomTime .zoomInfo").removeClass("selected");
        obj.addClass("selected");
        $(".zoomTime ul").hide();
        this.setState({zoomTimeIndex:obj.index() });
        this.props.onRefresh(Utility.fitTimePeriod(value));
    },
    autoRefresh:function(){
        var that = this,
            refreshPeriod = that.state.refreshPeriod;
        this.props.onRefresh(Utility.fitTimePeriod(this.state.time));//this.state.time 应该从页面data-time里面取出，因为可能会有页面拖拽的情况
        //clearInterval(t);
        // var t = setInterval(function(){
        //     var oo = Utility.resetTimePeriod(that.state.time,600000);
        //     that.handleGraph(oo);
        // }, refreshTime);//10s
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
        var timeList = Utility.getTimeList();
        var zoomTimeList = timeList.map(function(subArr,index){
            if(index == 3)//last 12h
                return <li className="selected" value={subArr.value} key={index} onClick={that.changeTimeList}>{subArr.text}</li>;
            else
                return <li value={subArr.value} key={index} onClick={that.changeTimeList}>{subArr.text}</li>;
        });
        return (
            <div className="zoomTime">
                <div className="zoom" onClick = {this.zoomOut}>Zoom Out</div>
                <div>
                    <div className="zoomInfo" onClick={this.showZoomTime}>last 12h</div>
                    <ul>
                        {zoomTimeList}
                    </ul>
                </div>
            </div>
        );
    }
});

module.exports = Zoom;
