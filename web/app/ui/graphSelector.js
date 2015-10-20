var React = require('react');
var mui = require('material-ui');

var mixins = require('../mixins.js');
var Utility = require('../utility.js');

// Includes a couple of dropdown menus to select measurements

// data structures:
// measurements: { cpu: { device : ['cpu0' ...],
//                        measure: ['idle' ...]
//                      },
//                 memory: { ... },
//               }
// selected: { 'measurement': 'cpu',
//             'device': 'cpu0',
//             'measure': 'idle'
//           }
// metrics: ['cpu,cpu0,idle', ...]

// props:
// needToQueryMeasurements: bool. Should this component to fetch measurements itself or
//                          reply on props `initialMeasurements`
// initialMeasurements: `measurements` object. Could be null.
// initialMetrics: `metrics` object. Could be null.
// ips: array of string. If there're multiple IPs, fetch the first one's measurements for ease of
//      implementation.
// config: Watchtv config object, could be fetched by GET /config
// onChange: callback function(metrics). Return current selected measurements.

// Use `getSelected()` to get current selected measurements,
// use `getMetrics()` to get current metrics

var getIndex = function(menuItems, selectedString) {
    if(!selectedString) return 0;

    for(var i=0; i<menuItems.length; i++) {
        if(menuItems[i].payload === selectedString) {
            return i;
        }
    }
    return 0;
};

var GraphSelector = React.createClass({
    mixins: [mixins.materialMixin],
    getInitialState: function() {
        var measurements = {}, metrics = [];
        if(this.props.initialMeasurements) measurements = this.props.initialMeasurements;
        if(this.props.initialMetrics) metrics = this.props.initialMetrics;
        return {
            measurements: measurements,
            selected: {}, // currently selected in those dropdown menus
            metrics: metrics // currently listed in metrics list
        };
    },
    getMeasurements: function() {
        var that = this;
        var ip = this.props.ips[0].replace(/\./g, '_');
        $.ajax({
            url: that.props.config.influxdbURL + '/query?' + $.param(
                Utility.q_param(that.props.config,
                    "SHOW SERIES WHERE host='" + ip + "'")),
            dataType: 'json',
            success: function (data) {
                var measurements = Utility.get_measurements(data);
                if(!$.isEmptyObject(measurements)) {
                    that.setState({measurements: measurements});
                }
            },
            error: function (xhr, status, err) {
                console.error('Init measurements structure ', status, err.toString());
            }
        });
    },
    componentDidMount: function(){
        if(this.props.needToQueryMeasurements && this.props.ips && this.props.ips.length > 0) {
            this.getMeasurements();
        }
    },
    componentDidUpdate: function() {
        if(this.props.needToQueryMeasurements && this.props.ips && this.props.ips.length > 0) {
            this.getMeasurements();
        }
    },
    componentWillReceiveProps: function(nextProps) {
        // Mainly for `single` page measurements props updates
        if(!this.props.needToQueryMeasurements && nextProps.initialMeasurements) {
            this.setState({
                measurements: nextProps.initialMeasurements
            });
        }
    },
    onMeasurementChange: function(err, selectedIndex, menuItem) {
        var selected = {};
        selected.measurement = menuItem.payload;
        if(selected.measurement === '') {
            selected.device = null;
            selected.measure = null;
        } else {
            var measurement = this.state.measurements[selected.measurement];
            if (measurement.device) {
                selected.device = measurement.device[0];
            } else {
                selected.device = null;
            }
            selected.measure = measurement.measure[0];
        }

        this.setState({selected: selected});
    },
    onMeasureChange: function (err, selectedIndex, menuItem) {
        var selected = this.state.selected;
        selected.measure = menuItem.payload;

        this.setState({selected: selected});
    },
    onDeviceChange: function (err, selectedIndex, menuItem) {
        var selected = this.state.selected;
        selected.device = menuItem.payload;

        this.setState({selected: selected});
    },
    getSelected: function() {
        return this.state.selected;
    },
    getMetrics: function () {
        return this.state.metrics;
    },
    handleAddingMetric: function () {
        var selected = this.state.selected,
            metrics = this.state.metrics;
        if(selected.device == null) selected.device = '';
        var metric = selected.measurement + ',' + selected.device + ',' + selected.measure;
        if(metrics.indexOf(metric) === -1) {
            metrics.push(metric);
        }
        this.setState({metrics: metrics});
        if(this.props.onChange) this.props.onChange(metrics);
    },
    handleDelete: function (item) {
        var metrics = this.state.metrics.filter(function(metric) {
            return item != metric;
        });
        this.setState({metrics: metrics});
        if(this.props.onChange) this.props.onChange(metrics);
    },
    deleteButtonMaker: function(item) {
        return <mui.IconButton tooltip="Delete" onClick={this.handleDelete.bind(null, item)}>
            <mui.SvgIcon hoverColor="#e53935">
                <svg fill="#444444" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
                    <path d="M0 0h24v24H0z" fill="none"/>
                </svg>
            </mui.SvgIcon>
        </mui.IconButton>;
    },
    render: function() {
        var that = this,
            measurementsItems = [ { payload: '', text: 'Select measurements'} ],
            deviceItems = [],
            measureItems = [],
            selectors = [];
        // First(measurements) dropdown
        Object.keys(this.state.measurements).map(function(m) {
            measurementsItems.push({ payload: m, text: m });
        });
        var selected = this.state.selected;
        selectors.push(<mui.DropDownMenu menuItems={measurementsItems}
                            selectedIndex={getIndex(measurementsItems, selected.measurement)}
                            onChange={this.onMeasurementChange}
                            key='measurements'
                       />);
        if(selected.measurement) {
            // Second(measure) dropdown
            this.state.measurements[selected.measurement].measure.map(function(m){
                measureItems.push({ payload: m, text: m });
            });
            selectors.push(<mui.DropDownMenu menuItems={measureItems}
                                selectedIndex={getIndex(measureItems, selected.measure)}
                                onChange={this.onMeasureChange}
                                key='measure'
                           />);
            // Third(device) dropdown
            var device = this.state.measurements[selected.measurement].device;
            if(device) {
                device.map(function(d) {
                    deviceItems.push({ payload: d, text: d });
                });
                selectors.push(<mui.DropDownMenu menuItems={deviceItems}
                                    selectedIndex={getIndex(deviceItems, selected.device)}
                                    onChange={this.onDeviceChange}
                                    key='device'
                               />);
            }
        }

        var metricItems = this.state.metrics.map(function(metric) {
            return <mui.ListItem primaryText={metric}
                                 rightIconButton={that.deleteButtonMaker(metric)}
                                 key={metric}/>
        });
        return (
            <div>
                <div>
                    {selectors}
                    <mui.IconButton tooltip="Add" onClick={this.handleAddingMetric}>
                        <mui.SvgIcon>
                            <svg fill="#444444" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
                                <path d="M0 0h24v24H0z" fill="none"/>
                            </svg>
                        </mui.SvgIcon>
                    </mui.IconButton>
                </div>
                <div>
                    <mui.List>
                        {metricItems}
                    </mui.List>
                </div>
            </div>
        )
    }
});

module.exports = GraphSelector;