var React = require('react');
var DropDownMenu = require('material-ui/lib/drop-down-menu');
var IconButton = require('material-ui/lib/icon-button');
var SvgIcon = require('material-ui/lib/svg-icon');
var List = require('material-ui/lib/lists/list');
var ListItem = require('material-ui/lib/lists/list-item');

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
    getMeasurements: function(defaultIPs) {
        var that = this;
        var ips = defaultIPs || this.props.ips;
        if(ips.length === 0) {
            that.setState({measurements: {}});
            return;
        }
        var ip = ips[0].replace(/\./g, '_');
        $.ajax({
            url: '/influxdb/query?' +
                encodeURIComponent("SHOW SERIES WHERE host='" + ip + "'"),
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
    componentWillReceiveProps: function(nextProps) {
        // Mainly for `single` page measurements props updates
        if(!this.props.needToQueryMeasurements && nextProps.initialMeasurements) {
            this.setState({
                measurements: nextProps.initialMeasurements
            });
        }
        // Mainly for `dashboard` page ip updates
        if(nextProps.needToQueryMeasurements && nextProps.ips) {
            this.getMeasurements(nextProps.ips);
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
        if($(".configList > div").size()==1) return;//nothing selected
        if(selected.device == null) selected.device = '';
        var metric = selected.measurement + ',' + selected.device + ',' + selected.measure;
        if(metrics.indexOf(metric) === -1) {
            metrics.push(metric.replace(",,",","));
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
        return <IconButton tooltip="Delete" onClick={this.handleDelete.bind(null, item)}>
            <SvgIcon hoverColor="#e53935">
                <svg fill="#444444" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
                    <path d="M0 0h24v24H0z" fill="none"/>
                </svg>
            </SvgIcon>
        </IconButton>;
    },
    render: function() {
        var that = this,
            measurementsItems = [ { payload: '', text: 'Select measurements'} ],
            deviceItems = [],
            measureItems = [],
            selectors = [];
        var compare = function(a, b) {
            if(a.payload < b.payload) {
                return -1;
            } else if(a.payload > b.payload) {
                return 1;
            }
            return 0;
        };
        // First(measurements) dropdown
        Object.keys(this.state.measurements).map(function(m) {
            measurementsItems.push({ payload: m, text: m });
        });
        measurementsItems.sort(compare);
        var selected = this.state.selected;
        selectors.push(<DropDownMenu menuItems={measurementsItems}
                            selectedIndex={getIndex(measurementsItems, selected.measurement)}
                            onChange={this.onMeasurementChange}
                            key='measurements'
                       />);
        if(selected.measurement) {
            // Second(measure) dropdown
            this.state.measurements[selected.measurement].measure.map(function(m){
                measureItems.push({ payload: m, text: m });
            });
            measureItems.sort(compare);
            selectors.push(<DropDownMenu menuItems={measureItems}
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
                deviceItems.sort(compare);
                selectors.push(<DropDownMenu menuItems={deviceItems}
                                    selectedIndex={getIndex(deviceItems, selected.device)}
                                    onChange={this.onDeviceChange}
                                    key='device'
                               />);
            }
        }

        var metricItems = this.state.metrics.map(function(metric) {
            return <ListItem primaryText={metric}
                                 rightIconButton={that.deleteButtonMaker(metric)}
                                 key={metric}/>
        });
        return (
            <div>
                <div className='configList'>
                    {selectors}
                    <i className="fa fa-plus fa-bg fa-transform addMetricBtn" onClick={this.handleAddingMetric} title="Add"></i>
                </div>
                <div className='metricList'>
                    <List>
                        {metricItems}
                    </List>
                </div>
            </div>
        )
    }
});

module.exports = GraphSelector;