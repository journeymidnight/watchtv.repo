var React = require('react');
var mui = require('material-ui');

var mixins = require('./mixins.js');
var NavigationBar = require('./ui/navigationbar.js');
var GraphSelector = require('./ui/graphSelector.js');
var unit = require('./unit.js');
var Utility = require('./utility.js');

var GraphList = React.createClass({
    mixins: [mixins.materialMixin, mixins.configMixin],
    getInitialState:function(){
        return this.init();
    },
    init: function(){
        var user,user_id,dashboards,arr=[];
        $.ajax({
            url:"/user",
            type:"get",
            async:false,
            success:function(data){
                user = data.name;
                user_id = data._id;
                dashboards = data.dashboards;
                for(var i = 0;i<dashboards.length;i++){
                    var metricArr = dashboards[i].metric.split(';');
                    if(metricArr[metricArr.length-1] == ""){
                        metricArr = metricArr.slice(0,metricArr.length-1);
                    }
                    var splitMetric = Utility.splitMetric(metricArr[0]).split(",");
                    arr[i] = {
                        ip:dashboards[i].ip,
                        node_id:dashboards[i]._id,
                        timePeriod:dashboards[i].time,
                        metricArr:metricArr,
                        selectedMeasurement: splitMetric[0],
                        selectedDevice: splitMetric[1],
                        selectedMeasure: splitMetric[2],
                        key: dashboards[i].ip+dashboards[i]._id+splitMetric[0]+splitMetric[1]+splitMetric[2]+i
                    }
                }
            }
        });
        return {
            user:user,
            user_id:user_id,
            arr:arr
        };
    },
    refreshGraph: function(dashboards){
        var state = this.init();
        this.setState({
            user:state.user,
            user_id:state.user_id,
            arr:state.arr
        });
    },
    render: function(){
        var _this = this;
        var graphList = _this.state.arr.map(function(subArr,index) {
            return <BaseGraph selected={subArr} config={_this.state.config} index={index} key = {subArr.key}
                    onRefresh={_this.refreshGraph} />
        });
        return (
            <div>
                <div className="graphList">
                    {graphList}
                </div>
                <GraphInfo type="node" title="add new dashboard" onRefresh={this.refreshGraph}/>
            </div>
        );
    }
});

var BaseGraph = React.createClass({
    getInitialState: function(){
        var host = Utility.catHost(this.props.selected.ip);
        return {
            data: [],
            host: host,
            timePeriod:Utility.fitTimePeriod(null,this.props.selected.timePeriod),
            metricArr: this.props.selected.metricArr,
            selectedMeasurement: this.props.selected.selectedMeasurement,
            selectedDevice: this.props.selected.selectedDevice,
            selectedMeasure: this.props.selected.selectedMeasure,
            node_id: this.props.selected.node_id,
            uniq_id: this.props.selected.node_id + host.split(",")[0],
            config: this.props.config
        }
    },
    queryInfluxDB: function(queryString,ip,metric,type) {
        $.ajax({
            url: this.state.config.influxdbURL + '/query?' +
                $.param(Utility.q_param(this.state.config, queryString)),
            dataType: 'json',
            success: function (data) {
                var currdata = this.state.data;
                currdata[currdata.length] = {
                    data:Utility.get_value(data),
                    ip:ip,
                    metric:metric,
                    type:type
                }
                this.setState({data: currdata});
            }.bind(this)
        })
    },
    executeQuery: function(fromTime, toTime, timePeriod, measurement, host, device, measure,type,metric){
        var query = Utility.buildQuery(fromTime, toTime, timePeriod, measurement, host, device, measure);
        if(query == null) return;
        this.queryInfluxDB(query,host,metric,type);
    },
    handleGraph: function(fromTime, toTime){
        var timePeriod = this.state.timePeriod;
        if(fromTime!=null&&toTime!=null) timePeriod = null;
        var host = this.state.host.split(',');
        var metricArr = this.state.metricArr;
        for(var i = 0;i<host.length;i++){
            for(var j = 0;j<metricArr.length;j++){
                var arr = Utility.splitMetric(metricArr[j]).split(",");
                this.executeQuery(
                    fromTime,
                    toTime,
                    timePeriod,
                    arr[0],
                    host[i],
                    arr[1],
                    arr[2],
                    j+1,
                    arr
                );
            }
        }
    },
    componentWillMount: function(){
        this.handleGraph();
    },
    refreshGraph: function(dashboards,type){
        if(type != "delete"){
            var host = Utility.catHost(dashboards.ip);
            var metricArr =  dashboards.metric.split(";");
            if(metricArr[metricArr.length-1] == ""){
                metricArr = metricArr.slice(0,metricArr.length-1);
            }
            var splitMetric = Utility.splitMetric(metricArr[0]).split(",");
            this.setState({
                data:[],
                host:host,
                time:dashboards.time,
                timePeriod:Utility.fitTimePeriod(null,dashboards.time),
                metricArr:metricArr,
                selectedMeasurement:splitMetric[0],
                selectedDevice:splitMetric[1],
                selectedMeasure:splitMetric[2],
                uniq_id:this.state.node_id+host.split(',')[0]
            });
            this.handleGraph();
        }else{
            this.props.onRefresh();
        }
    },
    getFittedData: function(){
        var fitted_data=[];
        for(var i = 0;i<this.state.data.length;i++){
            fitted_data[i] = {
                data:Utility.fitData(this.state.data[i].data),
                ip:this.state.data[i].ip,
                metric:this.state.data[i].metric,
                type:this.state.data[i].type
            }
        }
        return fitted_data;
    },
    componentDidUpdate: function() {
        var fitted_data=this.getFittedData();
        // unit is the last part of measure name, e.g.
        // tx_Bps, Committed_AS_byte, etc.
        var formatter=[], unitSuffix=[];
        var metricArr = this.state.metricArr;
        for(var i = 0;i<metricArr.length;i++){
            var split = Utility.splitMetric(metricArr[i]).split(","),
                measure = split[split.length-1]
            if(measure) {
                var u = measure.split('_').slice(-1)[0];
            }
            if(unit[u]) {
                formatter[formatter.length] = unit[u];
                unitSuffix[unitSuffix.length] = u;
            } else {
                formatter[formatter.length] = Utility.numberFormatter;
                unitSuffix[unitSuffix.length] = "";
            }
        }
        Utility.plotGraph('#graph' + this.state.uniq_id,
                  fitted_data,
                  formatter
        );
        var that = this;
        $('#graph' + that.state.uniq_id)
            .unbind()
            .bind("plothover", function (event, pos, item) {
                //console.log('item: ', item);
                //console.log('pos: ', pos);
                $(".tool").hide();
                if (item) {
                    var x = new Date(item.datapoint[0]).toLocaleString(),
                        y = Utility.numberFormatter(item.datapoint[1],
                                            null,
                                            unitSuffix[fitted_data[item.seriesIndex].type-1]);
                        metric = fitted_data[item.seriesIndex].metric;
                    var left = item.pageX + 10,
                        top = item.pageY + 15;
                        obj = $('#tooltip'+that.state.uniq_id);
                    obj.html(metric + '<br>' + y + '<br>' + x );
                    if((left + obj.width()) > ($("body").width()-30))
                        left -= obj.width();
                    obj.css({left:left,top:top}).fadeIn(200);
                } else {
                    $('#tooltip'+that.state.uniq_id).hide();
                }
            })
            .bind("plotselected", function (event, ranges) {
                var newFromTime = new Date(ranges.xaxis.from),
                    newToTime = new Date(ranges.xaxis.to);
                var host = that.state.host.split(',');
                that.setState({data:[]});
                that.handleGraph(
                    newFromTime,
                    newToTime,
                    function (data) {
                        Utility.plotGraph('#graph' + that.state.uniq_id,
                                  that.getFittedData(),
                                  formatter
                        )
                    }
                )
                
            });
    },
    render: function(){
        var graphTitle = this.state.metricArr;
        return (
            <div>
                <div className="graph">
                    <div className="graphTitle" 
                        title={graphTitle}>
                        {graphTitle}
                    </div>
                    <div id={'graph'+this.state.uniq_id} style={{width: '100%', height: '145px',backgroundColor: "#1f1f1f"}}></div>
                    <div id={'tooltip'+this.state.uniq_id} 
                        className = "tool"
                        style={{
                            position: 'fixed',
                            display: "none",
                            padding: "5px",
                            backgroundColor: "#3f3f3f",
                            borderRadius: "4px",
                            zIndex:"1"
                        }}>
                    </div>
                    <GraphInfo type="node" title="Edit"  selected={this.props.selected} index={this.props.index} onRefresh={this.refreshGraph}/>
                </div>
            </div>
        )
    }
});

var GraphInfo = React.createClass({
    mixins: [mixins.materialMixin, mixins.configMixin],
    getInitialState: function(){
        var ip,node_id,host,ips = [],time="21600",metricArr=[],selectedMeasurement,selectedDevice,selectedMeasure,selectedIp=0,selectedTime=0;
        var timeList = [
           { payload: '1', text: 'Last 6h' ,value: '21600'},
           { payload: '2', text: 'Last 12h' ,value: '43200'},
           { payload: '3', text: 'Last 1d' ,value: '86400'},
           { payload: '4', text: 'Last 2d' ,value: '172800'},
           { payload: '5', text: 'Last 3d' ,value: '259200'},
           { payload: '6', text: 'Last 4d' ,value: '345600'},
           { payload: '7', text: 'Last 5d' ,value: '432000'},
           { payload: '8', text: 'Last 6d' ,value: '518400'},
           { payload: '9', text: 'Last 7d' ,value: '604800'},
           { payload: '10', text: 'Last 30d' ,value: '2592000'},
        ];
        $.ajax({
            url: this.props.type + 's',
            dataType: 'json',
            async:false,
            success: function(data) {
                if(data.total > 0){
                    ip = data.result[0].ips.toString();
                    node_id = data.result[0]._id;
                    for(var i = 0;i<data.result.length;i++){
                        ips[i] = {text: data.result[i].ips.toString(),value:data.result[i]._id,defalt:false};
                    }
                    ips[ips.length] = {text: "10.150.130.87:5000",value:data.result[0]._id,defalt:false};//for test
                    ips[ips.length] = {text: "10.150.130.102:5000",value:data.result[0]._id,defalt:false};//for test
                    ips[ips.length] = {text: "10.150.130.103:5000",value:data.result[0]._id,defalt:false};//for test
                    ips[ips.length] = {text: "10.150.130.85:5000",value:data.result[0]._id,defalt:false};//for test
                }
            },
            error: function(xhr, status, err){
                console.error(this.props.url, status, err.toString())
            }.bind(this)
        });
        if(this.props.selected!=null){
            ip = this.props.selected.ip;
            node_id = this.props.selected.node_id;
            time = this.props.selected.timePeriod;
            selectedMeasurement = this.props.selected.selectedMeasurement;
            selectedDevice = this.props.selected.selectedDevice;
            selectedMeasure = this.props.selected.selectedMeasure;
            metricArr = this.props.selected.metricArr;
            for(var i = 0;i<ips.length;i++){
                var ipArr = ip.split(',');
                for(var j = 0;j<ipArr.length;j++){
                    if(ipArr[j] ==ips[i].text)
                        ips[i].defalt = true;
                }
            }
            for(var i = 0;i<timeList.length;i++){
                if(this.props.selected.timePeriod == timeList[i].value)
                    selectedTime = i;
            }
        }
        if(ip!=null)
            host = Utility.catHost(ip);
        return {
            ips:ips,
            ip: ip,
            node_id: node_id,
            host:host,
            selected:{},
            metricArr:metricArr,
            selectedMeasurement:selectedMeasurement,
            selectedDevice:selectedDevice,
            selectedMeasure:selectedMeasure,
            uniq_id: node_id +  host.split(',')[0],
            time:time,
            timeList: timeList,
            selectedTime: selectedTime,
            index:this.props.index
        }
    },
    addGraph:function(){
        this.refs.addGraphDialog.show();
        var event = Utility.getEvent();
        $(event.target).parent().find('#graphBtn').trigger('click');
    },
    showDelDialog:function(){
        this.refs.delDialog.show();
    },
    changeIp:function(e, checked){
        var checkArr = $(e.target).parents('.ipList').find('input');
        var ip = "";
        for(var i = 0;i<checkArr.length;i++){
            if(checkArr[i].checked){
                if(ip != "")
                    ip += ",";
                ip += checkArr[i].name;
            }
        }
        var node_id = checkArr[0].value;
        var host = Utility.catHost(ip);
        this.setState({
            ip:ip,
            node_id:node_id,
            host: host,
            uniq_id: node_id + host.split(',')[0],
            selected:{},
        });
    },
    changeTime:function(e, selectedIndex, menuItem){
        this.setState({time:menuItem.value,selectedTime:selectedIndex});
    },
    handleSelect: function(name, value){
        var selected = this.state.selected;
        selected[name] = value;
        this.setState({selected: selected});
    },
    handleGraph:function(){
        return;
    },
    addMetric: function(){
        var event = Utility.getEvent(),
            metric = this.getMetric(event),
            obj = $(event.target).parents('.scrollDialog').find(".configInfo");
        obj.append("<span title='"+metric+"' class='metricInfo'> "+metric+"<button onclick='javascript:$(this).parent().remove();'></button></span>");
        obj.find("span").unbind().bind({
            mouseenter:function(){ $(this).find("button").show();},
            mouseleave: function(){$(this).find("button").hide();}
        });
    },
    deleteMetric:function(){
        var event = Utility.getEvent(),
            obj = $(event.target);
        obj.parent().remove();
    },
    saveConfig: function(){
        var event = Utility.getEvent();
        var metric = this.getTotalMetric(event),
            _this = this;
        if(metric == 0){
            alert("还没有添加Metric哦~");
            return;
        }
        var user,user_id,dashboards;
        $.ajax({
            url:"/user",
            type:"get",
            async:false,
            success:function(data){
                user = data.name;
                user_id = data._id;
                dashboards = data.dashboards;
                if(_this.state.index == null){
                    dashboards[dashboards.length] = {
                        node: _this.state.node_id,
                        ip: _this.state.ip,
                        metric: metric,
                        time: _this.state.time
                    }
                }else{
                    dashboards[_this.state.index] = {
                        node: _this.state.node_id,
                        ip: _this.state.ip,
                        metric: metric,
                        time: _this.state.time
                    }

                }
            }
        });
        $.ajax({
            type: 'PUT',
            url: 'user/'+user_id,
            data: {dashboards: dashboards},
            success: function(){
                _this.refs.addGraphDialog.dismiss();
                _this.props.onRefresh(dashboards[_this.state.index]);
            }
        });
    },
    getMetric:function(event){
        var selected = this.state.selected,
            measurement = selected.selectedMeasurement,
            device = selected.selectedDevice,
            measure = selected.selectedMeasure,
            list = $(event.target).parents('.scrollDialog').find('select');
        if(list.length==1){
            measurement = list.eq(0).val();
            device = '';
            measure = '';
        }else if(list.length==2){
            measurement = list.eq(0).val();
            device = '';
            measure = ','+list.eq(1).val();
        }else if(list.length==3){
            measurement = list.eq(0).val();
            device = ','+list.eq(1).val();
            measure = ','+list.eq(2).val();
        }
        return measurement+device+measure;
    },
    getTotalMetric:function(){
        var obj = $(event.target).parents('.scrollDialog').find(".configInfo .metricInfo"),
            result="";
        for(var i = 0;i<obj.size();i++){
            var text = obj.eq(i).prop("title") + ";";
            result += text;
        }
        return result;
    },
    componentDidMount:function(){
        $(".configInfo span").unbind().bind({
            mouseenter:function(){$(this).find("button").show();},
            mouseleave: function(){$(this).find("button").hide();}
        });
    },
    deleteConfig: function(){
        var _this = this;
        var user_id,dashboards;
        $.ajax({
            url:"/user",
            type:"get",
            async:false,
            success:function(data){
                user_id = data._id;
                dashboards = data.dashboards;
                var i = _this.state.index;  
                if(i != null){
                    dashboards = dashboards.slice(0,i).concat(dashboards.slice(i+1));
                }
            }
        });
        $.ajax({
            type: 'PUT',
            url: 'user/'+user_id,
            data: {dashboards: dashboards},
            async:false
        });
        this.refs.addGraphDialog.dismiss();
        this.refs.delDialog.dismiss();
        this.props.onRefresh(null,"delete");
    },
    render: function(){
        var addGraphAction = [
            {text: 'Cancel'},
            {text: 'Submit', onClick: this.saveConfig, ref: 'submit' }
        ];
        var _this = this;
        var ipList = _this.state.ips.map(function(subArr,index) {
            return <mui.Checkbox
                        name={subArr.text}
                        value={subArr.value}
                        label={subArr.text}
                        defaultChecked={subArr.defalt}
                        onCheck={_this.changeIp}
                        key={index}/>
        });
        var metricArr = _this.state.metricArr.map(function(subArr,index) {
            if(subArr.length>0)
                return (
                        <span title={subArr} key={index} className="metricInfo">
                            {subArr}
                            <button onClick={_this.deleteMetric}></button>
                        </span>
                        );
            else return;
        });
        return (
            <div>
                <div className="graphBtn" onClick={this.addGraph}></div>
                <mui.Dialog title={this.props.title} actions={addGraphAction} contentClassName="scrollDialog graph" ref="addGraphDialog">
                    <mui.FlatButton label = "Delete" className="delBtn" onClick={this.showDelDialog}/>
                    <mui.Dialog
                        title="delete"
                        actions={[
                            { text: 'Cancel' },
                            { text: 'Submit', onTouchTap: this.deleteConfig, ref: 'submit' }
                        ]}
                        actionFocus="submit"
                        ref="delDialog">
                        Confirm to delete ! 
                    </mui.Dialog>
                    <div style={{minHeight:'170px'}}>
                        <div className="dropDownMenu ipList">
                            {ipList}
                        </div>
                        <div className="dropDownMenu configList">
                            <GraphSelector onSelect={this.handleSelect} select={this.props.selected} selected={this.state.selected} onGraph={this.handleGraph}
                                host={this.state.host.split(",")[0]} id={this.state.uniq_id} key={this.state.uniq_id} config={this.state.config}
                            />
                            <div className="addMetricBtn" onClick={this.addMetric}></div>
                        </div>
                        <mui.DropDownMenu selectedIndex={this.state.selectedTime} menuItems={this.state.timeList}
                            onChange = {this.changeTime}
                            className="dropDownMenu timeList"/>
                        <div className="configInfo">{metricArr}</div>
                    </div>
                </mui.Dialog>
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
