var React = require('react');
var _ = require('underscore');
var mui = require('material-ui');

var mixins = require('../mixins.js');
var unit = require('../unit.js');
var Utility = require('../utility.js');

var GraphSelector = React.createClass({
    mixins: [mixins.materialMixin],
    getInitialState: function() {
        return {
            measurements: null,
            select:this.props.selected
        }
    },
    componentWillMount: function(){
        // measurements: { cpu: { device : ['cpu0' ...],
        //                        measure: ['idle' ...]
        //                      },
        //                 memory: { ... },
        //               }
        var measurements = {};
        var that = this;
        $.ajax({
            url: this.props.config.influxdbURL + '/query?' + $.param(
                Utility.q_param(this.props.config, 
                    "SHOW MEASUREMENTS WHERE host='" + this.props.host + "'")),
            dataType: 'json',
            async:false,
            success: function(data){
                var measure_list = Utility.get_value(data);
                measure_list.map(function(m) {
                    var tags = {};
                    $.ajax({
                        url: that.props.config.influxdbURL + '/query?' + $.param(
                            Utility.q_param(that.props.config, 'SHOW TAG KEYS FROM ' + m)),
                        dataType: 'json',
                        async:false,
                        success: function (data) {
                            var key_list = Utility.get_value(data);
                            key_list.map(function(k){
                                if(k == 'host') return;
                                $.ajax({
                                    url: that.props.config.influxdbURL + '/query?' + $.param(
                                        Utility.q_param(that.props.config,
                                            'SHOW TAG VALUES FROM ' + m + ' WITH KEY="' + k + '"')
                                    ),
                                    dataType: 'json',
                                    async:false,
                                    success: function (data) {
                                        tags[k] = Utility.get_value(data)
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
        var that = this,
           event = Utility.getEvent();
        ['selectedMeasurement', 'selectedDevice', 'selectedMeasure'].map(function (name) {
            if(that.refs[name]) {
                that.props.onSelect(name, React.findDOMNode(that.refs[name]).value);
            } else {
                that.props.onSelect(name, null)
            }
        })
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
                <select onChange={this.changeHandler} ref="selectedMeasurement" id="selectParent" 
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
            </div>
        )
    }
});

module.exports = GraphSelector;