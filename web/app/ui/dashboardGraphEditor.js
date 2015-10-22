var React = require('react');
var mui = require('material-ui');

var GraphSelector = require('./graphSelector.js');
var NodeSelector = require('./nodeSelector.js');
var Utility = require('../utility.js');

// The graph editor for Dashboard page, includes a NodeSelector to pick IPs,
// a GraphSelector to pick metrics and a time dropdown menu to pick time period to draw.

// Props:
// title: string. Title of the edit dialog, NOT title of graph.
// initialIPs: array of string. Could be null.
// initialMetrics: array of string. Could be null.
// initialTime: number. Could be null.
// config: Watchtv config object, could be fetched by GET /config
// graph_id: mongodb object id. Used for DELETE action
// onRefresh: callback function(this.state). Called when all graphs on the dashboard should be
//              fetched again, for creating and deleting graphs.
// onUpdate: callback function(this.state). Called when the this graph should be updated.

var dashboardGraphEditor = React.createClass({
    getInitialState: function () {
        var ips = [], metrics = [], time = 43200; // 12h by default
        if(this.props.initialIPs) ips = this.props.initialIPs;
        if(this.props.initialMetrics) metrics = this.props.initialMetrics;
        if(this.props.initialTime) time = this.props.initialTime;
        return {
            ips: ips,
            metrics: metrics,
            time: time
        };
    },
    saveConfig: function () {
        var that = this;

        if(this.props.graph_id) {
            // graph_id exists, so the edit is inside a graph
            // PUT action should be handled inside a graph
            this.props.onUpdate(this.state);
            this.refs.graphEditDialog.dismiss();
            return;
        }

        $.ajax({
            url: '/user/graphs',
            type: 'POST',
            data: {
                ips: that.state.ips,
                metrics: that.state.metrics,
                time: that.state.time
            },
            success: function() {
                // graph_id does not exist, edit is outside a graph,
                // just let the container to refresh all graphs
                that.props.onRefresh();
            },
            error: function(xhr, status, error) {
                console.log('Error adding user graph', xhr, status, error);
            }
        });
        this.refs.graphEditDialog.dismiss();
    },
    handleTimeChange: function (err, selectedIndex, menuItem) {
        this.setState({time: menuItem.value});
    },
    handleIpChange: function (ips) {
        this.setState({ips: ips});
    },
    handleMetricChange: function (metrics) {
        this.setState({metrics: metrics});
    },
    showGraphEditDialog: function () {
        this.refs.graphEditDialog.show();
    },
    showDelDialog:function(){
        this.refs.delDialog.show();
    },
    deleteGraph: function() {
        var that = this;
        $.ajax({
            url: '/user/graph/' + this.props.graph_id,
            type: 'DELETE',
            success: function() {
                that.props.onRefresh();
            },
            error: function(xhr, status, error) {
                console.log('Error deleting user graph', xhr, status, error);
            }
        });
        this.refs.delDialog.dismiss();
        this.refs.graphEditDialog.dismiss();
    },
    render: function() {
        var graphEditAction = [
            {text: 'Cancel'},
            {text: 'Submit', onClick: this.saveConfig, ref: 'submit' }
        ];

        var timeList = Utility.getTimeList();
        var selectedTimeIndex = 0;
        for(var i=0; i<timeList.length; i++) {
            if(timeList[i].value === this.state.time) {
                selectedTimeIndex = i;
                break;
            }
        }

        var deleteButton;
        if(this.props.graph_id) { // inside a graph
            deleteButton =
                <div>
                    <mui.FlatButton label = "Delete" className="delBtn" onClick={this.showDelDialog} />
                </div>
        } else { // outside a graph
            deleteButton = <div></div>;
        }

        return (
            <div className="btnParent" >
                <div className="graphBtn" onClick={this.showGraphEditDialog}></div>
                <mui.Dialog title={this.props.title} actions={graphEditAction} ref='graphEditDialog'
                            contentClassName='scrollDialog' >
                    {deleteButton}
                    <mui.Dialog title="Delete confirmation" contentClassName="delDialog"
                                actions={[
                                            { text: 'Cancel' },
                                            { text: 'Delete', onClick: this.deleteGraph, ref: 'submit' }
                                        ]}
                                ref="delDialog">
                        Please confirm to delete this graph.
                    </mui.Dialog>
                    <div>
                        <mui.DropDownMenu selectedIndex={selectedTimeIndex}
                                          menuItems={timeList} className="timeLists"
                                          onChange={this.handleTimeChange} />
                        <NodeSelector ref='nodeIPs' onChange={this.handleIpChange}
                                      initialIPs={this.state.ips}
                        />
                        <GraphSelector onChange={this.handleMetricChange} ips={this.state.ips}
                                       config={this.props.config}
                                       initialMetrics={this.state.metrics}
                                       needToQueryMeasurements={true}
                                       ref='graphMetrics'
                        />
                    </div>
                </mui.Dialog>
            </div>
        )
    }
});


module.exports = dashboardGraphEditor;