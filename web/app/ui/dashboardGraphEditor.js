var React = require('react');
var mui = require('material-ui');

var mixins = require('../mixins.js');
var GraphSelector = require('./graphSelector.js');
var NodeSelector = require('./nodeSelector.js');
var Utility = require('../utility.js');

var dashboardGraphEditor = React.createClass({
    getInitialState: function () {
        return {
            ips: [],
            metrics: [],
            selected: {}
        };
    },
    saveConfig: function () {
        // Save current config to server
    },
    handleSelect: function (name, value) {
        var selected = this.state.selected;
        selected[name] = value;
        this.setState({selected: selected});
    },
    getMetric:function(event){
        var measurement='',device='',measure='',
            list = $(event.target).parents('.scrollDialog').find('select');
        if(list.length === 1) {
            measurement = list.eq(0).val();
        }else if(list.length === 2) {
            measurement = list.eq(0).val();
            measure = ',' + list.eq(1).val();
        }else if(list.length === 3) {
            measurement = list.eq(0).val();
            device = ',' + list.eq(1).val();
            measure = ',' + list.eq(2).val();
        }
        return measurement + device + measure;
    },
    addMetric: function(){
        var event = Utility.getEvent(),
            metric = this.getMetric(event),
            metrics = this.state.metrics;
        console.log(metric);
        if(metrics.indexOf(metric) === -1) {
            metrics.push(metric);
        }
        this.setState({metrics: metrics});
    },
    render: function() {
        var that = this;
        var addGraphAction = [
            {text: 'Cancel'},
            {text: 'Submit', onClick: this.saveConfig, ref: 'submit' }
        ];
        var metricArray = this.state.metrics.map(function(metric, index) {
            if(metric.length>0)
                return (
                    <span title={metric} key={index} className="metricInfo">
                            {metric}
                        <button onClick={that.deleteMetric}></button>
                    </span>
                );
        });
       return (
           <mui.Dialog title='Add new graph' actions={addGraphAction} ref='addGraphDialog'
                       contentClassName='scrollDialog' >
               <div>
                   <div>
                       <NodeSelector ref='nodeIPs' />
                   </div>
                   <div className='configList'>
                       <GraphSelector onSelect={this.handleSelect} selected={this.state.selected}
                                      host={this.state.host.split(",")[0]} id={this.state.uniq_id}
                                      key={this.state.uniq_id} config={this.state.config}
                                      needToQueryMeasurements={this.props.needToQueryMeasurements}
                                      measurements={this.props.measurements}
                       />
                       <div className="addMetricBtn" onClick={this.addMetric}></div>
                   </div>
                   <mui.DropDownMenu selectedIndex={this.state.selectedTime}
                                     menuItems={this.state.timeList}
                                     onChange = {this.changeTime} />
                   <div className="configInfo">{metricArray}</div>
               </div>
           </mui.Dialog>
       )
    }
});


module.exports = dashboardGraphEditor;