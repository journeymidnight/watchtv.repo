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
            uniq_id: this.props.selected.node_id + host,
            config: this.props.selected.config
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
                <GraphInfo type="node" title="Edit"  selected={this.props.selected}/>
            </div>
        )
    }
});

var GraphList = React.createClass({
    mixins: [mixins.materialMixin, mixins.configMixin],
    render: function(){
        var _this = this;
        var selected1 = {
            ip:"10.150.130.101:5000",
            node_id:"test1234566765",
            timePeriod:"86400",
            selectedMeasurement: "ceph",
            selectedDevice: "",
            selectedMeasure: "op_per_sec",
            config:_this.state.config
        }
        var selected2 = {
            ip:"10.150.130.102:5000",
            node_id:"test12345667652",
            timePeriod:"2592000",
            selectedMeasurement: "cpu",
            selectedDevice: "cpu0",
            selectedMeasure: "idle_percent",
            config:_this.state.config
        }
        var selected3 = {
            ip:"10.150.130.102:5000",
            node_id:"test123456167651",
            timePeriod:"172800",
            selectedMeasurement: "iostat",
            selectedDevice: "dm-1",
            selectedMeasure: "await_ms",
            config:_this.state.config
        }
        var selected4 = {
            ip:"10.150.130.85:5000",
            node_id:"test123456676253",
            timePeriod:"86400",
            selectedMeasurement: "network",
            selectedDevice: "em1",
            selectedMeasure: "rx_Bps",
            config:_this.state.config
        }
        return (
            <div className="graphList">
                <BaseGraph selected={selected1} />
                <BaseGraph selected={selected2} />
                <BaseGraph selected={selected3} />
                <BaseGraph selected={selected4} />
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
                ip = data.result[0].ips.toString();
                node_id = data.result[0]._id;
                for(var i = 0;i<data.result.length;i++){
                    ips[i] = {payload: i+1,text: data.result[i].ips.toString(),value:data.result[i]._id};
                }
            },
            error: function(xhr, status, err){
                console.error(this.props.url, status, err.toString())
            }.bind(this)
        });
        if(this.props.selected!=null){
            ip = this.props.selected.ip;
            node_id = this.props.selected.node_id;
            time = Utility.fitTimePeriod(null,this.props.selected.timePeriod);
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
            selectedTime: selectedTime
        }
    },
    addGraph:function(){
        this.refs.addGraphDialog.show();
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
        var selected = this.state.selected;
        var metric = selected.selectedMeasurement;
        if(selected.selectedDevice!=null)
            metric+=(','+selected.selectedDevice);
        metric += (','+selected.selectedMeasure);
        $.ajax({
            type: 'PUT',
            url: 'user/<id>',
            data: {
                dashboards: [
                    { 
                        node: this.state.node_id,
                        ip: this.state.ip,
                        metric: metric,
                        time: this.state.time
                    }
                ]
            }
        })
        //this.refs.addGraphDialog.hide();
    },
    deleteConfig: function(){
        //TODO
    },
    render: function(){
        var addGraphAction = [
            {text: 'Cancel'},
            {text: 'Submit', onTouchTap: this.saveConfig, ref: 'submit' }
        ];
        return (
            <div>
                <div className="graphBtn" onClick={this.addGraph}></div>
                <mui.Dialog title={this.props.title} actions={addGraphAction} contentClassName="scrollDialog" ref="addGraphDialog">
                    <mui.FlatButton label = "Delete" className="delBtn" onClick={this.deleteConfig}/>
                    <mui.DropDownMenu menuItems={this.state.ips}
                    onChange = {this.changeIp}
                    className="dropDownMenu" selectedIndex={this.state.selectedIp}
                    ref="ipList" />
                    <mui.DropDownMenu selectedIndex={this.state.selectedTime} menuItems={this.state.timeList}
                    onChange = {this.changeTime}
                    className="dropDownMenu"
                    ref="timePeriod" />
                    <GraphSelector onSelect={this.handleSelect} selected={this.state.selected} onGraph={this.handleGraph}
                        host={this.state.host} id={this.state.uniq_id} key={this.state.uniq_id} config={this.state.config}
                    />
                </mui.Dialog>
            </div>
        );
    }
});

React.render(
    <div>
        <GraphList />
        <GraphInfo type="node" title="add new dashboard"/>
    </div>,
    document.getElementById('content')
);