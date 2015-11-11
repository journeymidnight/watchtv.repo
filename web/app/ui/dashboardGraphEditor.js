var React = require('react');
var FlatButton = require('material-ui/lib/flat-button');
var Dialog = require('material-ui/lib/dialog');
var DropDownMenu = require('material-ui/lib/drop-down-menu');
var TextField = require('material-ui/lib/text-field');
var Snackbar = require('material-ui/lib/snackbar');

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
// graph_id: mongodb object id. Used for DELETE action
// onRefresh: callback function(this.state). Called when all graphs on the dashboard should be
//              fetched again, for creating and deleting graphs.
// onUpdate: callback function(this.state). Called when the this graph should be updated.

var dashboardGraphEditor = React.createClass({
    getInitialState: function () {
        var ips = [], metrics = [];
        if(this.props.initialIPs) ips = this.props.initialIPs;
        if(this.props.initialMetrics) metrics = this.props.initialMetrics;
        return {
            ips: ips,
            metrics: metrics
        };
    },
    saveConfig: function () {
        var that = this;
        if(that.state.ips.length==0){
            that.setState({snackMsg: 'IP address is required'});
            that.refs.snackbar.show();
            return;
        }
        if(that.state.metrics.length==0){
            that.setState({snackMsg: 'Metric field is required'});
            that.refs.snackbar.show();
            return;
        }
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
                metrics: that.state.metrics
            },
            success: function() {
                // graph_id does not exist, edit is outside a graph,
                // just let the container to refresh all graphs
                that.props.onRefresh(null,null,that.props.timePeriod);
            },
            error: function(xhr, status, error) {
                if (xhr.status === 401) {
                    location.assign('/login.html');
                }
                console.log('Error adding user graph', xhr, status, error);
            }
        });
        this.refs.graphEditDialog.dismiss();
    },
    importGraph: function() {
        var that = this, graphs;
        var graphJson = this.refs.graphInput.getValue().trim();
        try {
            graphs = JSON.parse(graphJson);
        } catch (e) {
            this.refs.parseErrorDialog.show();
            return;
        }
        $.ajax({
            url: '/user/graphs/imports',
            type: 'POST',
            data: {
                graphs: graphs
            },
            success: function() {
                // graph_id does not exist, edit is outside a graph,
                // just let the container to refresh all graphs
                that.props.onRefresh(null,null,that.props.timePeriod);
            },
            error: function(xhr, status, error) {
                if (xhr.status === 401) {
                    location.assign('/login.html');
                }
                console.log('Error adding user graph', xhr, status, error);
            }
        });
        this.refs.graphImportDialog.dismiss();
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
    showGraphImportDialog: function() {
        this.refs.graphImportDialog.show();
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
                if (xhr.status === 401) {
                    location.assign('/login.html');
                }
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

        var deleteButton;
        if(this.props.graph_id) { // inside a graph
            deleteButton =
                <div className="delDialog">
                    <FlatButton label = "Delete" className="delBtn" onClick={this.showDelDialog} />
                </div>
        } else { // outside a graph
            deleteButton = <div></div>;
        }
        var btn;//add or edit
        var importButton = <i></i>;
        if(this.props.title.indexOf("Add")>=0){
            btn = <i className="fa fa-plus fa-white"></i>;
            importButton = <i className='fa fa-arrow-down fa-white'></i>;
        }else{
            btn = <i className="fa fa-pencil fa-white"></i>
        }
        var graphImportAction = [
            {text: 'Cancel'},
            {text: 'Import', onClick: this.importGraph, ref: 'import'}
        ];
        return (
            <div>
                <div className="btnParent" >
                    <div className="graphBtn" onClick={this.showGraphEditDialog}>
                        {btn}
                    </div>
                    <Dialog title={this.props.title} actions={graphEditAction} ref='graphEditDialog'
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
                <div className="importBtnParent">
                    <div className="importGraphBtn" onClick={this.showGraphImportDialog}>
                        {importButton}
                    </div>
                    <Dialog title="Import graph" actions={graphImportAction}
                            ref='graphImportDialog' >
                        <TextField hintText='Paste the JSON string here' ref='graphInput'
                                   style={{width: '90%'}} multiLine={true}
                            />
                    </Dialog>
                    <Dialog title="Cannot parse the content"
                            actions={[{ text: 'OK' }]}
                            ref="parseErrorDialog">
                        Please double check your input
                    </Dialog>
                </div>
                <Snackbar ref="snackbar" message={this.state.snackMsg} />
            </div>
        )
    }
});


module.exports = dashboardGraphEditor;