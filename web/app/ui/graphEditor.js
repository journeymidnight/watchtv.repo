var React = require('react');
var mui = require('material-ui');

var GraphSelector = require('./graphSelector.js');
var NodeSelector = require('./nodeSelector.js');
var Utility = require('../utility.js');

// The graph editor for Single page, includes a dropdown menu to pick IPs,
// and a GraphSelector to pick metrics

// Props:
// title: string. Title of the edit dialog, NOT title of graph
// ips: array of string.
// initialIPs: string. Could be null.
// initialMetrics: array of string. Could be null.
// config: Watchtv config object, could be fetched by GET /config
// graph_id: mongodb object id. Used for DELETE action
// node_id: mongodb object id. Used to build URLs
// onRefresh: callback function(this.state). Called when all graphs on the dashboard should be
//              fetched again, for creating and deleting graphs.
// onUpdate: callback function(this.state). Called when the this graph should be updated.

// measurements: pass through to GraphSelector

var graphEditor = React.createClass({
    getInitialState: function () {
        var selectedIP = null, metrics = [];
        if(this.props.initialIPs) selectedIP = this.props.initialIPs[0];
        if(this.props.initialMetrics) metrics = this.props.initialMetrics;
        return {
            selectedIP: selectedIP,
            metrics: metrics
        };
    },
    handleIpChange: function(err, selectedIndex, menuItem) {
        this.setState({selectedIP: menuItem.payload});
    },
    handleMetricChange: function(metrics) {
        this.setState({metrics: metrics});
    },
    componentWillReceiveProps: function (nextProps) {
        if(nextProps.ips.length > 0) {
            this.setState({selectedIP: nextProps.ips[0]});
        }
    },
    showGraphEditDialog: function () {
        this.refs.graphEditDialog.show();
    },
    showDelDialog:function(){
        this.refs.delDialog.show();
    },
    deleteGraph: function () {
        var that = this;
        $.ajax({
            url: '/node/' + this.props.node_id + '/graph/' + this.props.graph_id,
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
    saveConfig: function () {
        var that = this;

        if(this.props.graph_id) {
            // graph_id exists, so the edit is inside a graph
            // PUT action should be handled inside a graph
            var state = {
                ips: [this.state.selectedIP],
                metrics: this.state.metrics,
                time: 43200 // 12h by default
            };
            this.props.onUpdate(state);
            this.refs.graphEditDialog.dismiss();
            return;
        }

        $.ajax({
            url: '/node/' + this.props.node_id + '/graphs',
            type: 'POST',
            data: {
                ips: [that.state.selectedIP],
                metrics: that.state.metrics,
                time: 43200 // 12h by default
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
    render: function () {
        var that = this;
        var graphEditAction = [
            {text: 'Cancel'},
            {text: 'Submit', onClick: this.saveConfig, ref: 'submit' }
        ];

        var deleteButton;
        if(this.props.graph_id) { // inside a graph
            deleteButton =
                <div>
                    <mui.FlatButton label = "Delete" className="delBtn" onClick={this.showDelDialog} />
                </div>
        } else { // outside a graph
            deleteButton = <div></div>;
        }

        var ipPicker;
        if(this.props.ips.length > 1) {
            var ipItems, selectedIpIndex = 0;
            ipItems = this.props.ips.map(function(ip, index){
                if(that.state.selectedIP === ip) selectedIpIndex = index;
                return { payload: ip, text: ip };
            });
            ipPicker =
                <div className="ipList">
                    <mui.DropDownMenu selectedIndex={selectedIpIndex}
                                      menuItems={ipItems}
                                      onChange={this.handleIpChange} />
                </div>
        } else { // only one IP available for this node, so no need to render the dropdown
            ipPicker = <div></div>;
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
                        {ipPicker}
                        <GraphSelector onChange={this.handleMetricChange}
                                       ips={[this.state.selectedIP]}
                                       config={this.props.config}
                                       initialMetrics={this.state.metrics}
                                       needToQueryMeasurements={false}
                                       initialMeasurements={this.props.measurements}
                                       ref='graphMetrics'
                        />
                    </div>
                </mui.Dialog>
            </div>
        )
    }
});

module.exports = graphEditor;