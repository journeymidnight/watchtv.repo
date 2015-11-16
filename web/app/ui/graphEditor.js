var React = require('react');
var FlatButton = require('material-ui/lib/flat-button');
var Dialog = require('material-ui/lib/dialog');
var DropDownMenu = require('material-ui/lib/drop-down-menu');
var Snackbar = require('material-ui/lib/snackbar');

var GraphSelector = require('./graphSelector.js');

// The graph editor for Single page, includes a dropdown menu to pick IPs,
// and a GraphSelector to pick metrics

// Props:
// ips: array of string.
// node_id: mongodb object id. Used to build URLs
// onRefresh: callback function(). Called when all graphs on the dashboard should be
//              fetched again, for creating and deleting graphs.
// onUpdate: callback function(graph). Called when the this graph should be updated.
// measurements: pass through to GraphSelector

// Methods:
// show(graph): if graph is null, this would be an "add" type dialog

var graphEditor = React.createClass({
    getInitialState: function () {
        var metrics = [];
        if(this.props.initialMetrics) metrics = this.props.initialMetrics;
        return {
            graph_id: null,
            selectedIP: null,
            metrics: metrics,
            type: 'edit' // type could be 'add' or 'edit'
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
    show: function (graph) {
        if(graph) {
            this.setState({
                graph_id: graph._id,
                selectedIP: graph.ips[0],
                metrics: graph.metrics,
                type: 'edit'
            });
        } else {
            this.setState({
                graph_id: null,
                metrics: [],
                type: 'add'
            });
        }
        this.refs.graphEditDialog.show();
    },
    showDelDialog:function(){
        this.refs.delDialog.show();
    },
    deleteGraph: function () {
        var that = this;
        $.ajax({
            url: '/node/' + this.props.node_id + '/graph/' + this.state.graph_id,
            type: 'DELETE',
            success: function() {
                that.props.onRefresh();
            },
            error: function(xhr, status, error) {
                if (xhr.status === 401) {
                    location.assign('/login.html');
                }
                console.log('Error deleting user graph', xhr, status, error);
            }
        });
        this.refs.delDialog.dismiss();
        this.refs.graphEditDialog.dismiss();
    },
    saveConfig: function () {
        var that = this;
        if(that.state.metrics.length==0){
            that.setState({snackMsg: 'Metric field is required'});
            that.refs.snackbar.show();
            return;
        }
        var graphPayload = {
            ips: [this.state.selectedIP],
            metrics: this.state.metrics
        };
        if(this.state.type === 'edit') {
            $.ajax({
                url: '/graph/' + this.state.graph_id,
                type: 'PUT',
                data: {graph: graphPayload},
                success: function () {
                    graphPayload._id = that.state.graph_id;
                    that.props.onUpdate(graphPayload);
                },
                error: function (xhr, status, error) {
                    if (xhr.status === 401) {
                        location.assign('/login.html');
                    }
                    console.log('Error updating user graph', xhr, status, error);
                }
            });
        } else { // type is "add"
            $.ajax({
                url: '/node/' + this.props.node_id + '/graphs',
                type: 'POST',
                data: graphPayload,
                success: function() {
                    that.props.onRefresh();
                },
                error: function(xhr, status, error) {
                    if (xhr.status === 401) {
                        location.assign('/login.html');
                    }
                    console.log('Error adding user graph', xhr, status, error);
                }
            });
        }
        this.refs.graphEditDialog.dismiss();
    },
    render: function () {
        var that = this;
        var deleteButton = <div></div>;
        var title = 'Add new graph';
        if(this.state.type === 'edit') {
            title = 'Edit graph';
            deleteButton =
                <div className="delDialog">
                    <FlatButton label = "Delete" className="delBtn" onClick={this.showDelDialog} />
                </div>
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
                    <DropDownMenu selectedIndex={selectedIpIndex}
                                      menuItems={ipItems}
                                      onChange={this.handleIpChange} />
                </div>
        } else { // only one IP available for this node, so no need to render the dropdown
            ipPicker = <div></div>;
        }
        return (
            <div className="btnParent" >
                <Dialog title={title}
                        actions={[
                            {text: 'Cancel'},
                            {text: 'Submit', onClick: this.saveConfig, ref: 'submit' }
                        ]}
                        ref='graphEditDialog'
                        contentClassName='scrollDialog' >
                    {deleteButton}
                    <Dialog title="Delete confirmation"
                                actions={[
                                            { text: 'Cancel' },
                                            { text: 'Delete', onClick: this.deleteGraph, ref: 'submit' }
                                        ]}
                                ref="delDialog">
                        Please confirm to delete this graph.
                    </Dialog>
                    <div>
                        {ipPicker}
                        <GraphSelector onChange={this.handleMetricChange}
                                       ips={[this.state.selectedIP]}
                                       initialMetrics={this.state.metrics}
                                       needToQueryMeasurements={false}
                                       initialMeasurements={this.props.measurements}
                                       ref='graphMetrics'
                        />
                    </div>
                </Dialog>
                <Snackbar ref="snackbar" message={this.state.snackMsg} />
            </div>
        )
    }
});

module.exports = graphEditor;