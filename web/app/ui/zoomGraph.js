var React = require('react');

var Utility = require('../utility.js');

var Zoom = React.createClass({
    getInitialState: function () {
        return {
            zoomTimeIndex: 3, //last 12h
            refreshTime:60000,//1 min
            refreshTimePeriod:Utility.fitTimePeriod(43200),
            currInterval:null//refresh interval
        };
    },
    showDropDown:function(){
        $(".zoomTime ul").hide();
        $(".refreshInfo,.zoomInfo").removeClass("selected");
        var obj = $(Utility.getEvent().target);
        obj.next().toggle();
        obj.next().css('display')=="none"?
                obj.removeClass("selected"):obj.addClass("selected");
    },
    zoomOut: function(){
        var index = this.state.zoomTimeIndex + 1;
        if(index > $(".zoomInfo + ul li").size()-1) return;
        var obj = $(".zoomInfo + ul li").eq(index);
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
        $(".zoomInfo + ul li,.zoomTime .zoomInfo,.zoomTime .refreshInfo").removeClass("selected");
        obj.addClass("selected");
        $(".zoomTime ul").hide();
        this.setState({zoomTimeIndex:obj.index(),refreshTimePeriod:Utility.fitTimePeriod(value)});
        this.props.onRefresh(Utility.fitTimePeriod(value));
        this.autoRefresh();
    },
    changeRefreshRate:function(){
        var obj = $(Utility.getEvent().target);
        $(".zoomTime .refreshInfo").html(obj.html());
        $(".refreshInfo + ul li,.zoomTime .refreshInfo").removeClass("selected");
        obj.addClass("selected");
        $(".refreshInfo + ul").hide();
        this.setState({refreshTime:obj.val()},this.autoRefresh(obj.val()));
    },
    autoRefresh:function(time){
        var that = this, refreshTime = that.state.refreshTime;
        if(time!=null) refreshTime = time;
        if(refreshTime == 0){
            clearInterval(this.state.currInterval);
            return;
        }
        clearInterval(this.state.currInterval);
        var t = setInterval(function(){
            var newPeriod = Utility.resetTimePeriod(that.state.refreshTimePeriod,refreshTime)
            that.setState({refreshTimePeriod:newPeriod});
            that.props.onRefresh(newPeriod);
        }, refreshTime);
        this.setState({currInterval:t});
    },
    componentWillMount:function(){
        $("body").bind("click",function(){
            var event = Utility.getEvent();
            if($(event.target).parents(".zoomTime").size()==0){
                $(".zoomTime ul").hide();
                $(".zoomTime .zoomInfo,.zoomTime .refreshInfo").removeClass("selected");
            }
        });
    },
    componentWillReceiveProps:function(nextProps){
        //stop refresh after graph drag
        if(nextProps.stopRefresh!=null&&nextProps.stopRefresh == true) {
            clearInterval(this.state.currInterval);
            $(".zoomTime .refreshInfo").html("No Refresh");
            $(".refreshInfo + ul li,.zoomTime .refreshInfo").removeClass("selected");
        }
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
                <div>
                    <div className="refreshInfo" onClick={this.showDropDown}>Refresh Rate</div>
                    <ul>
                        <li value="0" onClick={that.changeRefreshRate}>No Refresh</li>
                        <li value="60000" onClick={that.changeRefreshRate}>1 min</li>
                        <li value="300000" onClick={that.changeRefreshRate}>5 min</li>
                        <li value="600000" onClick={that.changeRefreshRate}>10 min</li>
                    </ul>
                </div>
                <div className="zoom" onClick = {this.zoomOut}>Zoom Out</div>
                <div>
                    <div className="zoomInfo" onClick={this.showDropDown}>last 12h</div>
                    <ul>
                        {zoomTimeList}
                    </ul>
                </div>
            </div>
        );
    }
});

module.exports = Zoom;
