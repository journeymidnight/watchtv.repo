var React = require('react');
var _ = require('underscore');
var mui = require('material-ui');

var mixins = require('../mixins.js');
var unit = require('../unit.js');
var GraphSelector = require('./graphSelector.js');

var q_param = function(config, q) {
    return {
        u: config.influxdbUser,
        p: config.influxdbPassword,
        db: config.influxdbDatabase,
        q: q
    }
};
var get_value = function (ret) {
    if (ret.results[0].series == undefined){
        return []
    }
    return _.flatten(ret.results[0].series[0].values);
};
var pointPerGraph = 300; // should be configurable

var buildQuery = function(fromTime, toTime, timePeriod, measurement, host, device, measure) {
    // fromTime and toTime are all Date objects
    if(timePeriod != null){
        fromTime = timePeriod[0];
        toTime = timePeriod[1];
    }else if(timePeriod == null && fromTime == null && toTime == null){
        return null;
    }
    var groupByTime = Math.floor( (toTime - fromTime)/pointPerGraph/1000 );
    if (groupByTime < 1) { groupByTime = 1}

    var query = 'SELECT MEAN(value) FROM ' + measurement +
        " WHERE host='" + host +  "' AND measure='" + measure + "'" +
        " AND time > '" + fromTime.toISOString() +  "' AND time < '" +
        toTime.toISOString() + "' ";
    if(device) {
        query += " AND device='" + device + "' ";
    }
    query += ' GROUP BY time(' + groupByTime + 's)';
    return query;
};

var millisecondsPerDay = 24*60*60*1000;
var fitTimePeriod = function(timePeriod) {
    var state = timePeriod.state.selectedIndex;
    var time = parseInt(timePeriod.props.menuItems[state].value);
    var now = new Date();
    if(time == 0) return null;
    else return [new Date(now.getTime()-time*1000),now];
};

var fitData = function(data) {
    // convert [time, data, time, data ...]
    // to [ [time, data], [time, data], ...]
    var fitted_data = [];
    for (var i = 0; i < data.length; i+=2){
        var d = [Date.parse(data[i]) , data[i+1]];
        fitted_data.push(d)
    }
    // do linear fitting to eliminate null values
    var last_i = null;
    for (i = 0; i < fitted_data.length; i += 1) {
        if(fitted_data[i][1]) {
           if (last_i) {
               for(var j = last_i + 1; j < i; j += 1) {
                   var y1 = fitted_data[last_i][1];
                   var y2 = fitted_data[i][1];
                   fitted_data[j][1] = y1 + (y2 - y1) * (j - last_i) / (i - last_i);
               }
           }
           last_i = i;
        }
    }
    return fitted_data;
};

var numberFormatter = function(val, axis, unit) {
    // Copied from
    // http://stackoverflow.com/questions/6784894/add-commas-or-spaces-to-group-every-three-digits
    var str = val.toString().split('.');
    if (str[0].length >= 5) {
        str[0] = str[0].replace(/(\d)(?=(\d{3})+$)/g, '$1,');
    }
    if (unit) {
        return str.join('.') + ' ' + unit;
    } else {
        return str.join('.');
    }
};

var plotGraph = function(placeholder, data, yAxisFormatter) {
    console.log('placeholder name', placeholder);
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
                font: {color: "white"},
                tickFormatter: yAxisFormatter
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


var Graph = React.createClass({
    getInitialState: function(){
        // get `host` attribute for influxdb queries
        var dot = new RegExp('\\.','g');
        var host = this.props.ip.split(':')[0].replace(dot, '_');

        var nodeData = null;
        $.ajax({
            url: 'node/' + this.props.node_id,
            dataType: 'json',
            success: function(data){
                nodeData = data;
                this.setState({node: data});
            }.bind(this),
            error: function(xhr, status, err){
                console.error("Fetching node info", status, err.toString())
            }
        });

        return {
            data: [],
            node: nodeData,
            selected: {},
            host: host,
            uniq_id: this.props.node_id + host
        }
    },
    handleSelect: function(name, value){
        var selected = this.state.selected;
        selected[name] = value;
        this.setState({selected: selected})
    },
    queryInfluxDB: function(queryString) {
        $.ajax({
            url: this.props.config.influxdbURL + '/query?' +
                $.param(q_param(this.props.config, queryString)),
            dataType: 'json',
            success: function (data) {
                this.setState({data: get_value(data)});
            }.bind(this)
        })
    },
    handleGraph: function(){
        var query = buildQuery(
            null,
            null,
            fitTimePeriod(this.refs.timePeriod),
            this.state.selected.selectedMeasurement,
            this.state.host,
            this.state.selected.selectedDevice,
            this.state.selected.selectedMeasure
        );
        if(query == null) return;
        console.log(query);
        this.queryInfluxDB(query);
    },
    
    render: function(){
        if(!this.props.render || !this.props.node_id) {
            return null
        }
        return (
            <div>
                <mui.DropDownMenu menuItems={
                    [
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
                    ]
                }
                className="dropDownMenu"
                ref="timePeriod" />

                <GraphSelector onSelect={this.handleSelect} selected={this.state.selected}
                    onGraph={this.handleGraph} host={this.state.host} id={this.state.uniq_id}
                    key={this.state.uniq_id} config={this.props.config}
                />
                <div id={'graph'+this.state.uniq_id} style={{width: '100%', height: '300px',
                    backgroundColor: "#6EB5F0"}}></div>
                <div id={'tooltip'+this.state.uniq_id} style={
                    {
                        position: 'absolute',
                        display: "none",
                        border: '1px solid rgb(223,255,253)',
                        padding: "2px",
                        backgroundColor: "rgb(238,254,255)",
                        opacity: 0.80
                    }
                    }> </div>
            </div>
        )
    },
    componentDidUpdate: function(prevProps, prevState) {
        if (this.props.node_id && this.props.render) {
            var fitted_data = fitData(this.state.data);
            console.log('fitted: ', fitted_data);

            // unit is the last part of measure name, e.g.
            // tx_Bps, Committed_AS_byte, etc.
            var formatter, unitSuffix;
            if(this.state.selected.selectedMeasure) {
                var u = this.state.selected.selectedMeasure.split('_').slice(-1)[0];
            }
            if(unit[u]) {
                formatter = unit[u];
                unitSuffix = u;
            } else {
                formatter = numberFormatter;
                unitSuffix = null;
            }
            plotGraph('#graph' + this.state.uniq_id,
                      fitted_data,
                      formatter
            );
            var that = this;
            $('.dropDownMenu div[tabindex] div').unbind().bind('click',function(){
                $('#graphBtn').trigger('click');
            });
            $('#graph' + that.state.uniq_id)
                .unbind()
                .bind("plothover", function (event, pos, item) {
                    //console.log('item: ', item);
                    //console.log('pos: ', pos);
                    if (item) {
                        var x = new Date(item.datapoint[0]),
                            y = numberFormatter(item.datapoint[1],
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
                        buildQuery(
                            newFromTime,
                            newToTime,
                            null,
                            that.state.selected.selectedMeasurement,
                            that.state.host,
                            that.state.selected.selectedDevice,
                            that.state.selected.selectedMeasure
                        ),
                        function (data) {
                            plotGraph('#graph' + that.state.uniq_id,
                                      fitData(data),
                                      formatter
                            )
                        }
                    );
                });
        }
    }
});

var MetricGraph = React.createClass({
    render: function() {
        var that = this;
        if(this.props.node_ips.length > 1) {
            var graphs = [];
            this.props.node_ips.map(function(ip){
                graphs.push(
                    <mui.Tab label={ip} key={that.props.node_id + ip}>
                        <div>
                            <Graph ip={ip} node_id={that.props.node_id}
                                render={that.props.render} config={that.props.config}
                                key={that.props.node_id + ip}
                            />
                        </div>
                    </mui.Tab>
                )
            });
            return (
                <mui.Tabs>
                    {graphs}
                </mui.Tabs>
            )
        } else { // node_ips.len == 1
            return (
                <Graph ip={this.props.node_ips[0]} node_id={this.props.node_id}
                    render={this.props.render} config={this.props.config} />
            )
        }
    }
});

module.exports = MetricGraph;