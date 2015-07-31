var React = require('react');
var mui = require('material-ui');
var bootstrap = require('react-bootstrap');
var markdown = require('markdown').markdown;

var mixins = require('./mixins.js');
var DeleteButton = require('./ui/deletebutton.js');
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
                    var metric = dashboards[i].metric.split(',');
                    var a,b,c;
                    if(metric.length == 2){
                        a = metric[0];
                        b="";
                        c = metric[1];
                    }else if(metric.length == 3){
                        a = metric[0];
                        b = metric[1];
                        c = metric[2];
                    }
                    arr[i] = {
                        ip:dashboards[i].ip,
                        node_id:dashboards[i]._id,
                        timePeriod:dashboards[i].time,
                        selectedMeasurement: a,
                        selectedDevice: b,
                        selectedMeasure: c,
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
            return <BaseGraph selected={subArr} config={_this.state.config} index={index} onRefresh={_this.refreshGraph}/>
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
        var dot = new RegExp('\\.','g');
        var host = this.props.selected.ip.split(':')[0].replace(dot, '_');
        return {
            data: [],
            host: host,
            timePeriod:Utility.fitTimePeriod(null,this.props.selected.timePeriod),
            selectedMeasurement: this.props.selected.selectedMeasurement,
            selectedDevice: this.props.selected.selectedDevice,
            selectedMeasure: this.props.selected.selectedMeasure,
            node_id: this.props.selected.node_id,
            uniq_id: this.props.selected.node_id + host,
            config: this.props.config
        }
    },
    queryInfluxDB: function(queryString) {
        $.ajax({
            url: this.state.config.influxdbURL + '/query?' +
                $.param(Utility.q_param(this.state.config, queryString)),
            dataType: 'json',
            success: function (data) {
                this.setState({data: Utility.get_value(data)});
            }.bind(this)
        })
    },
    handleGraph: function(){
        var query = Utility.buildQuery(
            null,
            null,
            this.state.timePeriod,
            this.state.selectedMeasurement,
            this.state.host,
            this.state.selectedDevice,
            this.state.selectedMeasure
        );
        if(query == null) return;
        this.queryInfluxDB(query);
    },
    componentWillMount: function(){
        this.handleGraph();
    },
    refreshGraph: function(dashboards,type){
        if(type != "delete"){
            var dot = new RegExp('\\.','g');
            var host = dashboards.ip.split(':')[0].replace(dot, '_');
            var metric = dashboards.metric.split(",");
            var measurement,device,measure;
            if(metric.length==1){
                measurement = metric[0];
                device = '';
                measure = '';
            }else if(metric.length==2){
                measurement = metric[0];
                device = '';
                measure = metric[1];
            }else if(metric.length==3){
                measurement = metric[0];
                device = metric[1];
                measure = metric[2];
            }
            this.setState({
                host:host,
                time:dashboards.time,
                timePeriod:Utility.fitTimePeriod(null,dashboards.time),
                selectedMeasurement:measurement,
                selectedDevice:device,
                selectedMeasure:measure,
                uniq_id:this.state.node_id+host
            });
            this.handleGraph();
        }else{
            this.props.onRefresh();
        }
    },
    componentDidUpdate: function() {
        var fitted_data = Utility.fitData(this.state.data);

        // unit is the last part of measure name, e.g.
        // tx_Bps, Committed_AS_byte, etc.
        var formatter, unitSuffix;
        if(this.state.selectedMeasure) {
            var u = this.state.selectedMeasure.split('_').slice(-1)[0];
        }
        if(unit[u]) {
            formatter = unit[u];
            unitSuffix = u;
        } else {
            formatter = Utility.numberFormatter;
            unitSuffix = null;
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
                if (item) {
                    var x = new Date(item.datapoint[0]),
                        y = Utility.numberFormatter(item.datapoint[1],
                                            null,
                                            unitSuffix);
                    $('#tooltip'+that.state.uniq_id)
                        .html(y + '<br>' + x )
                        .fadeIn(200);
                } else {
                    $('#tooltip'+that.state.uniq_id).hide();
                }
            })
            .bind("plotselected", function (event, ranges) {
                var newFromTime = new Date(ranges.xaxis.from),
                    newToTime = new Date(ranges.xaxis.to);
                that.queryInfluxDB(
                    Utility.buildQuery(
                        newFromTime,
                        newToTime,
                        null,
                        that.state.selectedMeasurement,
                        that.state.host,
                        that.state.selectedDevice,
                        that.state.selectedMeasure
                    ),
                    function (data) {
                        Utility.plotGraph('#graph' + that.state.uniq_id,
                                  Utility.fitData(data),
                                  formatter
                        )
                    }
                );
            });
    },
    render: function(){
        return (
            <div>
                <div className="graphTitle">
                    {this.state.host+' -- '+this.state.selectedMeasurement+' -- '+this.state.selectedDevice+' -- '+this.state.selectedMeasure}
                </div>
                <div id={'graph'+this.state.uniq_id} style={{width: '100%', height: '250px',backgroundColor: "#6EB5F0"}}></div>
                <div id={'tooltip'+this.state.uniq_id} style={{
                    position: 'absolute',
                    display: "none",
                    border: '1px solid rgb(223,255,253)',
                    padding: "2px",
                    backgroundColor: "rgb(238,254,255)",
                    opacity: 0.80
                }}></div>
                <GraphInfo type="node" title="Edit"  selected={this.props.selected} index={this.props.index} onRefresh={this.refreshGraph}/>
            </div>
        )
    }
});

var GraphInfo = React.createClass({
    mixins: [mixins.materialMixin, mixins.configMixin],
    getInitialState: function(){
        var ip,node_id,ips = [],time="21600",selectedMeasurement,selectedDevice,selectedMeasure,selectedIp=0,selectedTime=0;
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
                        ips[i] = {payload: i+1,text: data.result[i].ips.toString(),value:data.result[i]._id};
                    }
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
            for(var i = 0;i<ips.length;i++){
                if(ip ==ips[i].text) selectedIp = i;
            }
            for(var i = 0;i<timeList.length;i++){
                if(this.props.selected.timePeriod == timeList[i].value)
                    selectedTime = i;
            }
        }
        var dot = new RegExp('\\.','g');
        if(ip!=null)
            var host = ip.split(':')[0].replace(dot, '_');
        return {
            ips:ips,
            ip: ip,
            node_id: node_id,
            host:host,
            selected:{},
            selectedMeasurement:selectedMeasurement,
            selectedDevice:selectedDevice,
            selectedMeasure:selectedMeasure,
            uniq_id: node_id + host,
            time:time,
            timeList: timeList,
            selectedIp: selectedIp,
            selectedTime: selectedTime,
            index:this.props.index
        }
    },
    addGraph:function(){
        this.refs.addGraphDialog.show();
        $(event.target).parent().find('#graphBtn').trigger('click');
    },
    showDelDialog:function(){
        this.refs.delDialog.show();
    },
    changeIp:function(e, selectedIndex, menuItem){
        var ip = this.refs.ipList.props.menuItems[selectedIndex].text;
        var node_id = this.refs.ipList.props.menuItems[selectedIndex].value;
        var dot = new RegExp('\\.','g');
        var host = ip.split(':')[0].replace(dot, '_');
        this.setState({
            ip:ip,
            node_id:node_id,
            host: host,
            uniq_id: node_id + host,
            selected:{},
            selectedIp:selectedIndex
        });
    },
    changeTime:function(e, selectedIndex, menuItem){
        this.setState({time:this.refs.timePeriod.props.menuItems[selectedIndex].value,selectedTime:selectedIndex});
    },
    handleSelect: function(name, value){
        var selected = this.state.selected;
        selected[name] = value;
        this.setState({selected: selected});
    },
    handleGraph:function(){
        return;
    },
    saveConfig: function(){
        var metric = this.getMetric(),
            _this = this;
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
    getMetric:function(){
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
            {text: 'Submit', onTouchTap: this.saveConfig, ref: 'submit' }
        ];
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
                    <mui.DropDownMenu menuItems={this.state.ips}
                        onChange = {this.changeIp}
                        className="dropDownMenu" selectedIndex={this.state.selectedIp}
                        ref="ipList" />
                    <mui.DropDownMenu selectedIndex={this.state.selectedTime} menuItems={this.state.timeList}
                        onChange = {this.changeTime}
                        className="dropDownMenu"
                        ref="timePeriod" />
                    <GraphSelector onSelect={this.handleSelect} select={this.props.selected} selected={this.state.selected} onGraph={this.handleGraph}
                        host={this.state.host} id={this.state.uniq_id} key={this.state.uniq_id} config={this.state.config}
                    />
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