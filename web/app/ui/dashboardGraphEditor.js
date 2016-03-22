var React = require('react');
var FlatButton = require('material-ui/lib/flat-button');
var Dialog = require('material-ui/lib/dialog');
var DropDownMenu = require('material-ui/lib/drop-down-menu');
var Snackbar = require('material-ui/lib/snackbar');

var GraphSelector = require('./graphSelector.js');
var NodeSelector = require('./nodeSelector.js');

// The graph editor for Dashboard page, includes a NodeSelector to pick IPs,
// a GraphSelector to pick metrics and a time dropdown menu to pick time period to draw.

// Props:
// onRefresh: callback function(). Called when all graphs on the dashboard should be
//              fetched again, for creating and deleting graphs.
// onUpdate: callback function(graph). Called when the this graph should be updated.

// Methods:
// show(graph): if graph is null, this would be an "add" type dialog.

var dashboardGraphEditor = React.createClass({
    getInitialState: function () {
        return {
            _id: null,  // graph id
            panel_id: null,
            ips: [],
            metrics: [],
            snackMsg: '',
            type: 'edit'  // type could be 'add' or 'edit'
        };
    },
    saveConfig: function () {
        var that = this;
        if(that.state.ips.length==0){
            that.setState({snackMsg: __('IP address is required')});
            that.refs.snackbar.show();
            return;
        }
        if(that.state.metrics.length==0){
            that.setState({snackMsg: __('Metric field is required')});
            that.refs.snackbar.show();
            return;
        }

        var graphPayload = {
            ips: this.state.ips,
            metrics: this.state.metrics,
            panel_id: this.state.panel_id
        };
        if(this.state.type === 'edit') {
            $.ajax({
                url: '/graph/' + this.state._id,
                type: 'PUT',
                data: {graph: graphPayload},
                success: function () {
                    that.props.onUpdate(that.state);
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
                url: '/user/graphs',
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
    handleIpChange: function (ips) {
        this.setState({ips: ips});
    },
    handleMetricChange: function (metrics) {
        this.setState({metrics: metrics});
    },
    show: function (panel_id, graph) {
        if(graph) {
            this.setState({
                _id: graph._id,
                panel_id: panel_id,
                ips: graph.ips,
                metrics: graph.metrics,
                type: 'edit'
            });
        } else {
            this.setState({
                _id: null,
                panel_id: panel_id,
                ips: [],
                metrics: [],
                type: 'add'
            });
        }
        this.refs.graphEditDialog.show();
    },
    showDelDialog:function(){
        this.refs.delDialog.show();
    },
    deleteGraph: function() {
        var that = this;
        $.ajax({
            url: '/user/graph/' + this.state.panel_id + '/' + this.state._id,
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
    moveGraph: function() {
        var that = this;
        $.ajax({
            url: '/user/graph/move/' + that.state._id,
            type: 'POST',
            data: {
                from_panel_id: that.state.panel_id,
                to_panel_id: that.getDropdownValue()
            },
            success: function() {
                that.props.onRefresh();
                that.refs.graphMoveDialog.dismiss();
                that.refs.graphEditDialog.dismiss();
            },
            error: function(xhr, status, error) {
                if (xhr.status === 401) {
                    location.assign('/login.html');
                }
                console.log('Error moving user graph', xhr, status, error);
            }
        })
    },
    showGraphMoveDialog: function () {
        this.refs.graphMoveDialog.show();
    },
    render: function() {
        var that = this;
        var deleteButton = <div></div>;
        var moveButton = <div></div>;
        var title = __('Add new graph');
        if(this.state.type === 'edit') {
            title = __('Edit graph');
            deleteButton =
                <div className="delDialog">
                    <FlatButton label="Delete" className="delBtn" onClick={this.showDelDialog}/>
                </div>;
            moveButton = <FlatButton label="Move" className="moveBtn"
                                     onClick={this.showGraphMoveDialog} />
        }
        var createPanelNameDropdownHandler = function () {
            if(!that.props.otherPanelsDropdownItems[0]) return null;

            var selected = that.props.otherPanelsDropdownItems[0].payload;
            that.getDropdownValue = function() {
                return selected;
            };
            return function (event, index, item) {
                selected = item.payload;
            }
        };
        return (
            <div>
                <div className="btnParent" >
                    <Dialog title={title}
                            actions={[
                                {text: __('Cancel')},
                                {text: __('Submit'), onClick: this.saveConfig, ref: 'submit' }
                            ]}
                            ref='graphEditDialog'
                            contentClassName='scrollDialog' >
                        {deleteButton}
                        {moveButton}
                        <Dialog title={__("Delete confirmation")}
                                    actions={[
                                                { text: __('Cancel') },
                                                { text: __('Delete'), onClick: this.deleteGraph, ref: 'submit' }
                                            ]}
                                    ref="delDialog">
                            {__('Please confirm to delete this graph.')}
                        </Dialog>
                        <Dialog title={__('Move graph to')}
                                actions={[
                                    {text: __('Cancel')},
                                    {text: __('Move'), onClick: this.moveGraph}
                                ]}
                                ref="graphMoveDialog">
                            <DropDownMenu menuItems={this.props.otherPanelsDropdownItems}
                                          onChange={createPanelNameDropdownHandler()}
                            />
                        </Dialog>
                        <div>
                            <NodeSelector ref='nodeIPs' onChange={this.handleIpChange}
                                          initialIPs={this.state.ips}
                            />
                            <GraphSelector onChange={this.handleMetricChange} ips={this.state.ips}
                                           initialMetrics={this.state.metrics}
                                           needToQueryMeasurements={true}
                                           ref='graphMetrics'
                            />
                        </div>
                    </Dialog>
                </div>
                <Snackbar ref="snackbar" message={this.state.snackMsg} />
            </div>
        )
    }
});


module.exports = dashboardGraphEditor;