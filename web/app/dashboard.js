var React = require('react');
var Dialog = require('material-ui/lib/dialog');
var TextField = require('material-ui/lib/text-field');

var mixins = require('./mixins.js');
var NavigationBar = require('./ui/navigationBar.js');
var BaseGraph  = require('./ui/baseGraph.js');
var Zoom  = require('./ui/zoomGraph.js');
var GraphEditor = require('./ui/dashboardGraphEditor.js');
var utility = require('./utility.js');

var GraphList = React.createClass({
    mixins: [mixins.materialMixin],
    getInitialState: function () {
        return {
            panels: [],
            panelID: '', // current highlighted panel ID
            shareContent: '',
            period: utility.periodFromTimeLength(43200)  // last 12h by default
        };
    },
    getUserGraphs: function (resetPanel) {
        var that = this;
        $.ajax({
            url: '/user/graphs',
            type: 'GET',
            success: function (data) {
                that.setState({panels: data});
                if(resetPanel) {
                    that.changePanel();
                }
            },
            error: function (xhr, status, error) {
                if (xhr.status === 401) {
                    location.assign('/login.html');
                }
                console.log('Error fetching user graphs', xhr, status, error);
            }
        });
    },
    changePanel: function(panel) {
        this.setState({panelID: panel || this.state.panels[0]._id});
    },
    addPanel: function() {
        var that = this;
        var name = this.refs.panelNameInput.getValue().trim();
        $.ajax({
            url: '/user/panels',
            type: 'POST',
            data: {
                name: name
            },
            success: function () {
                that.getUserGraphs();
                that.refs.panelAddDialog.dismiss();
            },
            error: function () {
                if (xhr.status === 401) {
                    location.assign('/login.html');
                }
                console.log('Error adding panel ', xhr, status, error);
            }
        });
    },
    deletePanel: function () {
        var that = this;
        $.ajax({
            url: '/user/panel/' + that.state.panelID,
            type: 'DELETE',
            success: function () {
                that.getUserGraphs(true);
                that.refs.panelDeleteDialog.dismiss();
            },
            error: function () {
                if (xhr.status === 401) {
                    location.assign('/login.html');
                }
                console.log('Error deleting panel ', xhr, status, error);
            }
        });
    },
    componentDidMount: function () {
        this.getUserGraphs(true);
    },
    refreshGraphs: function() {
        this.getUserGraphs();
    },
    updateGraph: function(graph) {
        var panels = this.state.panels;
        for(var i=0;i<panels.length;i++) {
            if(panels[i]._id === this.state.panelID) {
                var graphs = panels[i].graphs;
                for(var j=0;j<graphs.length;j++) {
                    if(graphs[j]._id === graph._id) {
                        if(graph.ips) graphs[j].ips = graph.ips;
                        if(graph.metrics) graphs[j].metrics = graph.metrics;
                        if(graph.title) graphs[j].title = graph.title;
                        break;
                    }
                }
                break;
            }
        }
        this.setState({panels: panels});
    },
    refreshTime: function(timePeriod, stopRefresh){
        if(stopRefresh) this.refs.zoom.stopRefresh();
        this.setState({period: timePeriod});
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
                graphs: graphs,
                panel_id: this.state.panelID
            },
            success: function() {
                that.getUserGraphs();
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
    graphFromID: function(graphID) {
        var panels = this.state.panels;
        for(var i = 0; i < panels.length; i++) {
            if(panels[i]._id === this.state.panelID) {
                var graphs = panels[i].graphs;
                for(var j = 0; j < graphs.length; j++) {
                    if(graphs[j]._id === graphID) {
                        return graphs[j];
                    }
                }
            }
        }
        return null;
    },
    showShareDialog: function(graphID) {
        var graph = this.graphFromID(graphID);
        if(graph) {
            var shareContent = '[' + JSON.stringify({
                    ips: graph.ips,
                    metrics: graph.metrics,
                    title: graph.title
                }) + ']';
            this.setState({shareContent: shareContent});
            this.refs.shareDialog.show();
        }
    },
    showEditDialog: function(graphID) {
        if(!graphID) {
            this.refs.graphEditor.show(this.state.panelID);
            return;
        }

        var graph = this.graphFromID(graphID);
        this.refs.graphEditor.show(this.state.panelID, graph);
    },
    showGraphImportDialog: function() {
        this.refs.graphImportDialog.show();
    },
    showPanelAddDialog: function () {
        this.refs.panelAddDialog.show();
    },
    showPanelDeleteDialog: function () {
        this.refs.panelDeleteDialog.show();
    },
    render: function(){
        var _this = this;
        var currentPanelName = '';
        var panels = this.state.panels.map(function(p) {
            var lastClickTime = null;
            var click = function() {
                if(!lastClickTime || Date.now() - lastClickTime > 300) { // single click
                    setTimeout(function () {
                        _this.setState({panelID: p._id});
                    }, 300);
                } else { // double click
                    // show input and hide a
                    $('#' + p._id + 'a').css('display', 'none');
                    $('#' + p._id + 'input').css('display', 'block').focus().select();
                }
                lastClickTime = Date.now();
            };
            var savePanelTitle = function (event) {
                var t = event.target.value;
                if(t === '') return;
                $('#' + p._id + 'a').css('display', 'block');
                $('#' + p._id + 'input').css('display', 'none');
                $.ajax({
                    type: 'PUT',
                    url: '/user/panel/' + p._id,
                    data: {
                        name: t
                    },
                    success: function() {
                        var panels = _this.state.panels;
                        for(var i = 0; i < panels.length; i++) {
                            if(panels[i]._id === p._id) {
                                panels[i].name = t;
                                break;
                            }
                        }
                        _this.setState({panels: panels});
                    },
                    error:function(xhr, status, err) {
                        if (xhr.status === 401) {
                            location.assign('/login.html');
                        }
                        console.log("Error updating panel title", err);
                    }
                });
            };
            if(p._id === _this.state.panelID) {
                currentPanelName = p.name;
                return (
                    <li><a className="focusedPanel" href="#" onClick={click} id={p._id+'a'}>
                        {p.name}</a>
                        <input type="text" defaultValue={p.name} id={p._id+'input'}
                               onBlur={savePanelTitle}/></li>
                )
            }
            return (
                <li><a href="#" onClick={click} id={p._id+'a'}>{p.name}</a>
                    <input type="text" defaultValue={p.name} id={p._id+'input'}
                           onBlur={savePanelTitle}/></li>
            )
        });
        panels.push(<li><a href="#" onClick={_this.showPanelAddDialog}>
            <i className="fa fa-white fa-plus-circle"></i></a></li>);
        panels.push(<li><a href="#" onClick={_this.showPanelDeleteDialog}>
            <i className="fa fa-white fa-trash"></i></a></li>);
        var currentPanel = this.state.panels.filter(function(p) {
            return p._id === _this.state.panelID;
        })[0];
        var graphList = [];
        if(currentPanel) {
            graphList = currentPanel.graphs.map(function(graph) {
                // make a copy since we need to compare ips and metrics in baseGraph.
                // otherwise, in baseGraph `this.props` is always the same with `nextProps`,
                // since they are pointing to the same object
                var graphCopy = {
                    _id: graph._id,
                    title: graph.title,
                    ips: graph.ips.slice(),
                    metrics: graph.metrics.slice()
                };
                return <BaseGraph key={graph._id}
                                  graph={graphCopy}
                                  period={_this.state.period}
                                  onRefresh={_this.refreshTime}
                                  onUpdate={_this.updateGraph}
                                  showShareDialog={_this.showShareDialog}
                                  showEditDialog={_this.showEditDialog}
                />
            });
        }
        var otherPanelItems = this.state.panels.filter(function(panel) {
            return panel._id !== _this.panelID;
        }).map(function(panel) {
            return {payload: panel._id, text: panel.name};
        });

        return (
            <div>
                <Zoom onRefresh={this.refreshTime} period={this.state.period} ref="zoom"/>
                <div>
                    <ul className="dashboardPanel">
                        {panels}
                    </ul>
                    <Dialog title={__("Add new graph group")}
                            actions={[
                                {text: __('Cancel')},
                                {text: __('Add'), onClick: this.addPanel}
                            ]}
                            ref="panelAddDialog" >
                        <TextField hintText={__('Graph group name')}
                                   ref='panelNameInput'
                                   style={{width: '90%'}} />
                    </Dialog>
                    <Dialog title={__("Delete graph group: ") + currentPanelName}
                            actions={[
                                {text: __('Cancel')},
                                {text: __('Confirm'), onClick: this.deletePanel}
                            ]}
                            ref="panelDeleteDialog" >
                    </Dialog>
                </div>
                <div className="graphList">
                    {graphList}
                </div>
                <GraphEditor onRefresh={this.refreshGraphs}
                             onUpdate={this.updateGraph}
                             otherPanelsDropdownItems={otherPanelItems}
                             ref="graphEditor"
                />
                <Dialog title={__("Copy the contents below to share this graph")}
                        actions={[{text: __('Close')}]}
                        autoDetectWindowHeight={true} autoScrollBodyContent={true}
                        ref='shareDialog'>
                    <TextField value={this.state.shareContent} style={{width: '90%'}}
                               multiLine={true} />
                </Dialog>
                <div className="btnParent" >
                    <div className="graphBtn" onClick={this.showEditDialog}>
                        <i className="fa fa-plus fa-white"></i>
                    </div>
                </div>
                <div className="importBtnParent">
                    <div className="importGraphBtn" onClick={this.showGraphImportDialog}>
                        <i className='fa fa-arrow-down fa-white'></i>
                    </div>
                    <Dialog title={__("Import graph")}
                            actions={[
                                {text: __('Cancel')},
                                {text: __('Import'), onClick: this.importGraph}
                            ]}
                            ref='graphImportDialog'>
                        <TextField hintText={__('Paste the JSON string here')}
                                   ref='graphInput'
                                   style={{width: '90%'}} multiLine={true}
                        />
                    </Dialog>
                    <Dialog title={__("Cannot parse the content")}
                            actions={[{ text: __('OK') }]}
                            ref="parseErrorDialog">
                        {__('Please double check your input')}
                    </Dialog>
                </div>
            </div>
        );
    }
});

React.render(
    <div>
        <NavigationBar title={__("Dashboard")} />
        <GraphList />
    </div>,
    document.getElementById('content')
);
