var React = require('react');

var utility = require('../utility.js');

// The component to draw a pie graph
// TODO: copied tons of code from BaseGraph, should refactor

// props:
// graph: graph object as in DB schema.
// onUpdate: callback function(graph).
// showShareDialog: callback function(graph_id). Used to open share dialog.
// ShowEditDialog: callback function(graph_id). Used to open edit dialog.


var FigureGraph = React.createClass({
    getInitialState: function () {
        return {
            value: '',
            graphWidth: $('#' + this.props.graph._id).width()
        }
    },
    plot: function(graph) {
        var that = this;
        var graph = graph || this.props.graph;

        var metricsToFetch = {};
        graph.metrics[0].replace(/\+/g, ' ').replace(/-/g, ' ')
            .replace(/\*/g, ' ').replace(/\//g, ' ')
            .replace(/\(/g, ' ').replace(/\)/g, ' ')
            .split(' ')
            .filter(function(metric) {
            return metric !== '';
        }).forEach(function(metric) {
            metricsToFetch[metric] = 1; // value is dummy, we don't care
        });

        var metricQueries = [];
        var currentTime = new Date();
        for(var m in metricsToFetch) {
            if(!metricsToFetch.hasOwnProperty(m)) continue;
            if(m.indexOf(';') === -1) continue;

            // metric of "Pie" type is of format: ip;measurement,device,measure
            var metricParameters = utility.splitMetric(m.split(';')[1]).split(',');
            var queryParameters = {
                from: currentTime - 1000 * 60 * 15,
                to: currentTime.getTime(),
                ip: m.split(';')[0],
                measurement: metricParameters[0],
                device: metricParameters[1],
                measure: metricParameters[2]
            };
            var req = $.ajax({
                type: 'GET',
                url: '/timeseries/metric?' + $.param(queryParameters),
                dataType: 'json'
            });
            req.metric = m;
            metricQueries.push(req);
        }

        if(metricQueries.length === 0) return;
        var metricData = {};
        $.when.apply(undefined, metricQueries)
         .then(function () {
                // If there's only one graphRequest, arguments is in structure
                // [ data, statusText, jqXHR ];
                // if there're multiple graphRequests, arguments is an array of
                // [ data, statusText, jqXHR ], so some branches are needed here
                var results = arguments;
                if(metricQueries.length === 1) {
                    results = [arguments];
                }
                for(var i = 0; i < results.length; i++) {
                    var d = null;
                    var dataArray = results[i][0];
                    for(var j = dataArray.length-1; j >= 0; j--) {
                        // results[i][0] is the result of metricQueries[i]
                        // data returned is in format [[time, value], [time, value], ...]
                        // get the latest value among them
                        if(dataArray[j][1]) {
                            d = dataArray[j][1];
                            break;
                        }
                    }
                    metricData[metricQueries[i].metric] = d;
                }
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
        var that = this;

        // check and set the state of graphWidth so as to redraw the graphs
        // when graph width changes
        var checkGraphWidth = function () {
            var graph = $('#' + that.props.graph._id);
            var graphWidth = graph.width();
            return function () {
                if(graphWidth !== graph.width()) {
                    graphWidth = graph.width();
                    that.setState({graphWidth: graphWidth});
                }
            };
        }();
        setInterval(checkGraphWidth, 1200);

        // For updating graph title
        $("#" + this.props.graph._id + " .titleInput").off().on('blur', function(){
            if($(this).val()=="") return;
            var graph = {
                title: $(this).val()
            };
            $.ajax({
                type: 'PUT',
                url: 'graph/' + that.props.graph._id,
                data: {graph: graph},
                success: function(){
                    if(that.props.onUpdate) {
                        that.props.onUpdate({
                            title: graph.title,
                            _id: that.props.graph._id
                        });
                    }
                },
                error:function(xhr, status, err){
                    if (xhr.status === 401) {
                        location.assign('/login.html');
                    }
                    console.log("error");
                }
            });
        });
        $(".singleDefault .titleInput").off().attr("disabled",true);

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