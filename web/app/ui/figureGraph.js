var React = require('react');

var utility = require('../utility.js');
var graphMixin = require('../mixins.js').graphMixin;

// The component to draw a graph that shows a single big number

// props:
// graph: graph object as in DB schema.
// onUpdate: callback function(graph).
// showShareDialog: callback function(graph_id). Used to open share dialog.
// ShowEditDialog: callback function(graph_id). Used to open edit dialog.


var FigureGraph = React.createClass({
    mixins: [graphMixin],
    getInitialState: function () {
        return {
            value: '',
            graphWidth: $('#' + this.props.graph._id).width()
        }
    },
    plot: function(graph) {
        var that = this;
        graph = graph || this.props.graph;

        var metricsToFetch = utility.parseMetricsToFetch([graph.metrics[0]]);
        var metricQueries = utility.buildMetricQueries(metricsToFetch);
        if(metricQueries.length === 0) return;
        
        $.when.apply(undefined, metricQueries)
         .then(function () {
             var metricData = utility.extractMetricData(arguments, metricQueries);
             var formula = graph.metrics[0].slice();
             for(var metric in metricData) {
                 if(!metricData.hasOwnProperty(metric)) continue;
                 formula = formula.replace(metric, metricData[metric]);
             }
             try {
                 var v = eval(formula);
             } catch (e) {
                 console.log('Metric evaluation error', e);
                 that.setState({value: 'Error'});
                 return null;
             }
             that.setState({value: v});
         })
    },
    componentDidMount: function () {
        this.plot();
    },
    componentWillReceiveProps: function (nextProps) {
        this.plot(nextProps.graph);
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
                <div className="graph figureGraph">
                    <input type="text" name="title" className="titleInput"
                           placeholder={placeholderText}
                    />
                    <div id={'graph' + graph._id}
                         style={{width: '100%', height: '145px',
                            backgroundColor: '#1f1f1f', marginTop: '10px'
                         }}>
                        <p style={{fontFamily: "PT Mono,monospace",
                            fontSize: '48px',
                            lineHeight: '150px',
                            textAlign: 'center'
                        }}>
                            {this.state.value}
                        </p>
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

module.exports = FigureGraph;