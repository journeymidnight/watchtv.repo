var React = require('react');
var _ = require('underscore');
var mui = require('material-ui');

var mixins = require('../mixins.js');

var influxdb_url = 'http://192.169.0.59:8086';
var q_param = function(q){
    return {
        u: 'root',
        p: 'root',
        db: 'graphite',
        q: q
    }
};
var get_value = function (ret) {
    if (ret.results[0].series == undefined){
        return []
    }
    return _.flatten(ret.results[0].series[0].values);
};


var GraphSelector = React.createClass({
    mixins: [mixins.materialMixin],
    getInitialState: function() {
        return {
            measurements: null
        }
    },
    componentWillMount: function(){

        // measurements: { cpu: { device : ['cpu0' ...],
        //                        measure: ['idle' ...]
        //                      },
        //                 memory: { ... },
        //               }
        var measurements = {};
        $.ajax({
            url: influxdb_url + '/query?' + $.param(
                q_param("SHOW MEASUREMENTS WHERE host='" + this.props.host + "'")),
            dataType: 'json',
            success: function(data){
                var measure_list = get_value(data);
                console.log('measure_list', measure_list);
                measure_list.map(function(m) {
                    var tags = {};
                    $.ajax({
                        url: influxdb_url + '/query?' + $.param(
                            q_param('SHOW TAG KEYS FROM ' + m)),
                        dataType: 'json',
                        success: function (data) {
                            var key_list = get_value(data);
                            key_list.map(function(k){
                                if(k == 'host') return;
                                $.ajax({
                                    url: influxdb_url + '/query?' + $.param(
                                        q_param('SHOW TAG VALUES FROM ' + m + ' WITH KEY="' +
                                        k + '"')
                                    ),
                                    dataType: 'json',
                                    success: function (data) {
                                        tags[k] = get_value(data)
                                    }
                                })
                            });
                        }
                    });
                    measurements[m] = tags;
                });
                this.setState({measurements: measurements});
            }.bind(this),
            error: function(xhr, status, err){
                console.error('Init measurements structure ', status, err.toString())
            }.bind(this)
        });

        if(!this.props.selected.selectedMeasurement &&
            !$.isEmptyObject(this.state.measurements))
        {
            var defaultMeasurement = Object.keys(this.state.measurements)[0];
            this.props.onSelect('selectedMeasurement', defaultMeasurement);
            this.props.onSelect('selectedMeasure',
                this.state.measurements[defaultMeasurement].measure[0]);
        }
    },
    changeHandler: function() {
        var that = this;
        ['selectedMeasurement', 'selectedDevice', 'selectedMeasure'].map(function (name) {
            if(that.refs[name]) {
                that.props.onSelect(name, React.findDOMNode(that.refs[name]).value);
            } else {
                that.props.onSelect(name, null)
            }
        })
    },
    handleGraph: function(){
        this.changeHandler();
        this.props.onGraph();
    },
    render: function(){
        var that = this;
        var measurementOptions = [];
        var selectors = [];
        if(this.state.measurements) {
            Object.keys(this.state.measurements).map(function (m) {
                measurementOptions.push(<option key={that.props.id+m} value={m}>{m}</option>)
            });
            selectors.push(
                <select onChange={this.changeHandler} ref="selectedMeasurement"
                    key={this.props.id+"selectedMeasurement"} >
                    <optgroup label="Measurements">
                        {measurementOptions}
                    </optgroup>
                </select>
            )
        }
        if(this.props.selected.selectedMeasurement){
            var device = this.state.measurements[this.props.selected.selectedMeasurement].device;
            if(device) {
                var deviceOptions = [];
                device.map(function (d) {
                    deviceOptions.push(<option key={that.props.id+d} value={d}>{d}</option>)
                });
                selectors.push(
                    <select onChange={this.changeHandler} ref='selectedDevice'
                        key={this.props.id+"selectedDevice"} >
                        <optgroup label="Devices">
                            {deviceOptions}
                        </optgroup>
                    </select>
                )
            }

            var measureOptions = [];
            this.state.measurements[this.props.selected.selectedMeasurement].measure.map(function(m){
                measureOptions.push(<option key={that.props.id+m} value={m}>{m}</option>)
            });
            selectors.push(
                <select onChange={this.changeHandler} ref='selectedMeasure'
                    key={this.props.id+"selectedMeasure"} >
                    <optgroup label="Measures">
                        {measureOptions}
                    </optgroup>
                </select>
            )
        }
        return (
            <div>
                {selectors}
                <mui.FlatButton label="Graph" onClick={this.handleGraph} />
            </div>
        )
    }
});


var pointPerGraph = 300; // should be configurable

var buildQuery = function(fromTime, toTime, measurement, host, device, measure) {
    // fromTime and toTime are all Date objects

    var groupByTime = Math.floor( (toTime - fromTime)/pointPerGraph/1000 );
    if (groupByTime < 1) { groupByTime = 1}

    var query = 'SELECT MEAN(value) FROM ' + measurement +
        " WHERE host='" + host +  "' AND measure='" + measure + "'" +
        " AND time > '" + fromTime.toISOString() +  "' AND time < '" +
        toTime.toISOString() + "' ";
    if(measure) {
        query += " AND device='" + device + "' ";
    }
    query += ' GROUP BY time(' + groupByTime + 's)';
    return query;
};

var millisecondsPerDay = 24*60*60*1000;
var fitTime = function(time) {
    // "time" assumes to be the time gotten from DatePicker, in Unix time, in milliseconds
    // returns picked "date" combines current "time"
    var now = new Date();
    var timeOfDay = (now.getTime() % millisecondsPerDay);
    var dateOfTime = Math.ceil(time / millisecondsPerDay) * millisecondsPerDay;
    return new Date(dateOfTime + timeOfDay);
};

var fitData = function(data) {
    // convert [time, data, time, data ...]
    // to [ [time, data], [time, data], ...]
    var fitted_data = [];
    for (var i = 0; i < data.length; i+=2){
        var d = [Date.parse(data[i]) , data[i+1]];
        fitted_data.push(d)
    }
    console.log('fit data ', fitted_data);
    return fitted_data;
};

var plotGraph = function(placeholder, data) {
    return $.plot(placeholder,
        [data],
        {
            xaxis: {
                mode: "time",
                timezone: "browser",
                color: "white",
                font: {color: "white"}
            },
            yaxis: {
                color: "white",
                font: {color: "white"}
            },
            series: {
                lines: {
                    show: true,
                    fill: true,
                    fillColor: "rgba(143, 198, 242, 0.7)"
                }
            },
            grid: {
                color: "transparent",
                margin: 10,
                hoverable: true
            },
            colors: ["white"],
            crosshair: {
                mode: "x",
                color: "white"
            },
            selection: {
                mode: "x"
            }
        });
};

var eventBinded = {}; // memorize if jQuery event has been binded

var MetricGraph = React.createClass({
    getInitialState: function(){
        // get `host` attribute for influxdb queries
        var dot = new RegExp('\\.','g');
        var host = this.props.node_ip.split(':')[0].replace(dot, '_');

        return {
            data: [],
            node: null,
            selected: {},
            host: host
        }
    },
    componentWillMount: function(){
        $.ajax({
            url: 'node/' + this.props.node_id,
            dataType: 'json',
            success: function(data){
                this.setState({node: data});
            }.bind(this),
            error: function(xhr, status, err){
                console.error("Fetching node info", status, err.toString())
            }
        })
    },
    handleSelect: function(name, value){
        var selected = this.state.selected;
        selected[name] = value;
        this.setState({selected: selected})
    },
    queryInfluxDB: function(queryString) {
        $.ajax({
            url: influxdb_url + '/query?' + $.param(q_param(queryString)),
            dataType: 'json',
            success: function (data) {
                this.setState({data: get_value(data)});
            }.bind(this)
        })
    },
    handleGraph: function(){
        var query = buildQuery(
            fitTime(this.refs.fromDatePicker.getDate().getTime()),
            fitTime(this.refs.toDatePicker.getDate().getTime()),
            this.state.selected.selectedMeasurement,
            this.state.host,
            this.state.selected.selectedDevice,
            this.state.selected.selectedMeasure
        );
        console.log(query);
        this.queryInfluxDB(query);
    },
    render: function(){
        if(!this.props.render || !this.props.node_id) {
            return null
        }
        return (
            <div>
                <mui.DatePicker
                    hintText="Date from"
                    mode="landscape"
                    ref="fromDatePicker"
                    autoOk={true}
                />
                <mui.DatePicker
                    hintText="to"
                    mode="landscape"
                    ref="toDatePicker"
                    autoOk={true}
                />
                <GraphSelector onSelect={this.handleSelect} selected={this.state.selected}
                    onGraph={this.handleGraph} host={this.state.host} id={this.props.node_id} />
                <div id={'graph'+this.props.node_id} style={{width: '650px', height: '300px',
                    backgroundColor: "#6EB5F0"}}></div>
            </div>
        )
    },
    componentDidUpdate: function(prevProps, prevState) {
        if (this.props.node_id && this.props.render) {
            var fitted_data = fitData(this.state.data);
            console.log('fitted: ', fitted_data);
            var plot = plotGraph('#graph' + this.props.node_id,
                                fitted_data);
            var that = this;
            if(!eventBinded[that.props.node_id]) {
                eventBinded[that.props.node_id] = true;
                console.log('eventBinded: ', eventBinded);
                $('#graph' + this.props.node_id)
                    .bind("plothover", function (event, pos, item) {
                        //console.log(pos, item)
                    })
                    .bind("plotselected", function (event, ranges) {
                        var newFromTime = new Date(ranges.xaxis.from),
                            newToTime = new Date(ranges.xaxis.to);
                        that.queryInfluxDB(
                            buildQuery(
                                newFromTime,
                                newToTime,
                                that.state.selected.selectedMeasurement,
                                that.state.host,
                                that.state.selected.selectedDevice,
                                that.state.selected.selectedMeasure
                            ),
                            function (data) {
                                plotGraph('#graph' + that.props.node_id,
                                    fitData(data))
                            }
                        );
                    });
            }
        }
    }
});


module.exports = MetricGraph;