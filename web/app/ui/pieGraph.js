var React = require('react');

var utility = require('../utility.js');
var graphMixin = require('../mixins.js').graphMixin;

// The component to draw a pie graph

// props:
// graph: graph object as in DB schema.
// onUpdate: callback function(graph).
// showShareDialog: callback function(graph_id). Used to open share dialog.
// ShowEditDialog: callback function(graph_id). Used to open edit dialog.


var PieGraph = React.createClass({
    mixins: [graphMixin],
    getInitialState: function () {
        return {
            graphWidth: $('#' + this.props.graph._id).width()
        }
    },
    plot: function() {
        var that = this;

        var metricsToFetch = utility.parseMetricsToFetch(this.props.graph.metrics);
        var metricQueries = utility.buildMetricQueries(metricsToFetch);
        if(metricQueries.length === 0) return;
        
        $.when.apply(undefined, metricQueries)
         .then(function () {
             var metricData = utility.extractMetricData(arguments, metricQueries);
             var plotData = that.props.graph.metrics.map(function(metricFormula) {
                 var name, m;
                 if(metricFormula.split('|').length === 2) {
                     name = metricFormula.split('|')[0];
                     m = metricFormula.split('|')[1];
                 } else {
                     name = metricFormula;
                     m = metricFormula;
                 }
                 for(var metric in metricData) {
                     if(!metricData.hasOwnProperty(metric)) continue;
                     m = m.replace(metric, metricData[metric]);
                 }
                 var v;
                 try {
                     v = eval(m);
                 } catch (e) {
                     console.log('Metric evaluation error', e);
                     return null;
                 }
                 return {
                     label: name,
                     data: v
                 }
             });
             $.plot('#graph' + that.props.graph._id,
                 plotData,
                 {
                     series: {
                         pie: {
                             show: true,
                             radius: 1,
                             label: {
                                 show: true,
                                 radius: 0.75
                             }
                         }
                     },
                     legend: {
                         show: false
                     },
                     colors: ["#CACF15","#71C855","#6ED0E0","#B941DA","#EF843C","#4E41BB",
                              "#E24D42","#E600FF","#FF0000","#48FF00","#FFE600"]
                 }
             );
         })
    },
    componentDidMount: function () {
        this.plot();
    },
    componentDidUpdate: function () {
        this.plot();
    },
    showShareDialog: function () {
        this.props.showShareDialog(this.props.graph._id);
    },
    showGraphEditDialog: function() {
        this.props.showEditDialog(this.props.graph._id);
    },
    render: function () {
        var graph = this.props.graph;
        var placeholderText = __("Click Here to Edit Graph Name");
        if(graph.title!=null&&graph.title!="") placeholderText = graph.title;
        return (
            <div id={graph._id} style={{width: '25%'}}>
                <div className="graph pieGraph">
                    <input type="text" name="title" className="titleInput"
                           placeholder={placeholderText}
                    />
                    <div id={'graph' + graph._id}
                         style={{width: '100%', height: '145px',
                            backgroundColor: '#1f1f1f', marginTop: '10px'
                         }}>
                    </div>
                    <div className='shareBtnParent'>
                        <div className="graphBtn" onClick={this.showShareDialog}>
                            <i className='fa fa-share fa-white'></i>
                        </div>
                    </div>
                    <div className="btnParent">
                        <div className="graphBtn" onClick={this.showGraphEditDialog}>
                            <i className="fa fa-pencil fa-white"></i>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
});

module.exports = PieGraph;