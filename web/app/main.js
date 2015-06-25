var React = require('react');
var mui = require('material-ui');
var bootstrap = require('react-bootstrap');
var markdown = require('markdown').markdown;

var mixins = require('./mixins.js');
var DeleteButton = require('./ui/deletebutton.js');
var NavigationBar = require('./ui/navigationbar.js');
var MetricGraph = require('./ui/metricgraph.js');
var SearchableList = require('./ui/searchablelist.js');


var NodeList = React.createClass({
    mixins: [mixins.materialMixin],
    getInitialState: function () {
        return {snackMsg: ''}
    },
    handleCreateNewNode: function() {
        var name = this.refs.newName.getValue().trim(),
            ips = this.refs.newIP.getValue().trim().split(/[\s,]+/),
            tags = this.refs.newTag.getValue().trim().split(/[\s,]+/);
        $.ajax({
            type: "POST",
            url: "nodes",
            data: {
                "name": name,
                "ips": ips,
                "tags": tags
            },
            success: function(_) {
                this.props.onRefresh()
            }.bind(this),
            error: function(xhr, status, err) {
                console.error(xhr, status, err.toString());
                this.setState({snackMsg: xhr.responseText});
                this.refs.snackbar.show()
            }.bind(this)
        })
    },
    render: function() {
        var that = this;
        var nodeList = this.props.data.map(function(node){
            return(
                <NodeEntry name={node.name} ips={node.ips} tags={node.tags} key={node._id}
                    id={node._id} description={node.description}
                    onRefresh={that.props.onRefresh} />
            )
        });
        var addNewNodeRow =
            <tr>
                <td><mui.TextField ref="newName" /></td>
                <td><mui.TextField ref="newIP" /></td>
                <td><mui.TextField ref="newTag" /></td>
                <td>
                    <mui.IconButton tooltip="Add" onClick={this.handleCreateNewNode}>
                        <mui.SvgIcon>
                            <svg fill="#000000" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
                                <path d="M0 0h24v24H0z" fill="none"/>
                            </svg>
                        </mui.SvgIcon>
                    </mui.IconButton>
                </td>
            </tr>;
        return (
            <div>
            <bootstrap.Table striped bordered hover condensed>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>IP Addresses</th>
                        <th>Tags</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {nodeList}
                </tbody>
                <tfoot>
                    {addNewNodeRow}
                </tfoot>
            </bootstrap.Table>
                <mui.Snackbar ref="snackbar" message={this.state.snackMsg} />
            </div>
        )
    }
});


var NodeEntry = React.createClass({
    render: function(){
        var that = this;
        var tags = this.props.tags.map(function(tag, index){
            return(
                <bootstrap.Badge key={that.props.id+'tag'+tag['name']}>
                    {tag['name']}
                </bootstrap.Badge>
            )
        });
        return (
            <tr>
                <td key={this.props.id + 'name'}>{this.props.name}</td>
                <td key={this.props.id + 'ip'}>{this.props.ips.join('  ')}</td>
                <td key={this.props.id + 'tags'}>{tags}</td>
                <td key={this.props.id + 'actions'}>
                    <NodeEditButton nodeId={this.props.id} nodeName={this.props.name}
                        nodeIps={this.props.ips} nodeTags={this.props.tags}
                        onRefresh={this.props.onRefresh}
                        nodeDescription={this.props.description}
                    />
                    <NodeInfoButton nodeId={this.props.id} nodeName={this.props.name}
                        nodeIps={this.props.ips} description={this.props.description} />
                    <DeleteButton id={this.props.id} onRefresh={this.props.onRefresh}
                        name={this.props.name} url="node" />
                </td>
            </tr>
        )
    }
});

var NodeEditButton = React.createClass({
    mixins: [mixins.materialMixin],
    handleClick: function(){
        this.refs.editDialog.show();
    },
    getInitialState: function(){
        return {snackMsg: ''}
    },
    updateNode: function(){
        $.ajax({
            type: "PUT",
            url: "node/" + this.props.nodeId,
            data: {
                "name": this.refs.nameInput.getValue().trim(),
                "description": this.refs.descriptionInput.getValue().trim(),
                "ips": this.refs.ipInput.getValue().trim().split(/[\s,]+/),
                "tags": this.refs.tagInput.getValue().trim().split(/[\s,]+/)
            },
            success: function(data) {
                this.refs.editDialog.dismiss();
                this.props.onRefresh()
            }.bind(this),
            error: function(xhr, status, err) {
                this.setState({snackMsg: xhr.responseText});
                this.refs.snackbar.show()
            }.bind(this)
        })
    },
    render: function(){
        var editActions = [
            {text: 'Cancel'},
            {text: 'Update', onClick: this.updateNode}
        ];
        console.log(this.props.nodeTags);
        var tags = this.props.nodeTags.map(function(t){
            return t.name;
        });
        var edits = <div>
            <mui.TextField floatingLabelText="Name" defaultValue={this.props.nodeName}
                ref="nameInput" />
            <mui.TextField floatingLabelText="IP Address"
                defaultValue={this.props.nodeIps.join("  ")}
                ref="ipInput" />
            <mui.TextField floatingLabelText="Tags" defaultValue={tags.join(" ")}
                ref="tagInput" multiLine={true} />
                <div>
                    <mui.TextField floatingLabelText="Description"
                        defaultValue={this.props.nodeDescription}
                        ref="descriptionInput" multiLine={true}
                    />
                </div>
            </div>;
        return (
            <span>
            <mui.IconButton tooltip="Edit" onClick={this.handleClick}>
                <mui.SvgIcon>
                    <svg fill="#000000" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        <path d="M0 0h24v24H0z" fill="none"/>
                    </svg>
                </mui.SvgIcon>
            </mui.IconButton>
            <mui.Dialog
                title={"Edit info for " + this.props.nodeName}
                actions={editActions}
                modal={true}
                ref="editDialog">
            {edits}
            </mui.Dialog>
            <mui.Snackbar ref="snackbar" message={this.state.snackMsg} />
            </span>
        )
    }
});

var NodeInfoButton = React.createClass({
    mixins: [mixins.materialMixin],
    getInitialState: function() {
        return {
            renderGraph: false  // don't render the graph at startup
        }
    },
    showInfo: function(){
        this.setState({renderGraph: true});
        this.refs.infoDialog.show();
    },
    createMarkdown: function(){
        return {
            __html: markdown.toHTML(this.props.description)
        }
    },
    render: function(){
        var title = this.props.nodeName + '(' + this.props.nodeIps.join(', ') + ')';
        var infoAction = [
            {text: 'Close'}
        ];
        return (
            <span>
                <mui.IconButton tooltip="Info" onClick={this.showInfo}>
                    <mui.SvgIcon>
                        <svg fill="#000000" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                            <path d="M0 0h24v24H0z" fill="none"/>
                        </svg>
                    </mui.SvgIcon>
                </mui.IconButton>
                <mui.Dialog
                    title={title}
                    actions={infoAction}
                    modal={true}
                    ref="infoDialog">
                    <div>
                        <bootstrap.Panel collapsible={this.props.description == ''}>
                            <div dangerouslySetInnerHTML={this.createMarkdown()} />
                        </bootstrap.Panel>
                        <MetricGraph node_id={this.props.nodeId} node_ips={this.props.nodeIps}
                            render={this.state.renderGraph} />
                    </div>
                </mui.Dialog>
            </span>
        )
    }
});

var NodeApp = React.createClass({
    mixins: [mixins.materialMixin],
    render: function(){
        return (
            <mui.AppCanvas>
                <NavigationBar title="Nodes" />
                <SearchableList
                    type="node"
                    listClass={NodeList}
                    hintText="Find anything"
                />
            </mui.AppCanvas>
        )
    }
});

React.render(
    <NodeApp />,
    document.getElementById('content')
);