var React = require('react');
var mui = require('material-ui');
var bootstrap = require('react-bootstrap');

var mixins = require('./mixins.js');
var SearchBar = require('./ui/searchbar.js');
var DeleteButton = require('./ui/deletebutton.js');
var NavigationBar = require('./ui/navigationbar.js');
var MetricGraph = require('./ui/metricgraph.js');

var SearchableNodeList = React.createClass({
    componentDidMount: function(){
        $.ajax({
            url: 'nodes',
            dataType: 'json',
            success: function(data) {
                this.setState({node_list:data})
            }.bind(this),
            error: function(xhr, status, err){
                console.error(this.props.url, status, err.toString())
            }.bind(this)
        })
    },
    getInitialState: function () {
        return {
            node_list: [],
            keyword: ''
        }
    },
    handleKeyword: function(keyword){
        if(keyword == undefined) {
            keyword = this.state.keyword
        }
        var that = this;
        $.ajax({
            url: 'q?' + $.param({node: keyword}),
            dataType: 'json',
            success: function(data){
                that.setState({
                    node_list:data,
                    keyword: keyword
                });
            }
        });
    },
    render: function(){
        return (
            <div>
                <SearchBar onNewKeywords={this.handleKeyword} hintText="Find anything" />
                <NodeList node_list={this.state.node_list} onRefresh={this.handleKeyword} />
            </div>
        )
    }
});

var NodeList = React.createClass({
    mixins: [mixins.materialMixin],
    getInitialState: function () {
        return {snackMsg: ''}
    },
    handleCreateNewNode: function() {
        var name = this.refs.newName.getValue().trim(),
            ip = this.refs.newIP.getValue().trim(),
            tags = this.refs.newTag.getValue().trim().split(/[\s,]+/);
        $.ajax({
            type: "POST",
            url: "nodes",
            data: {
                "name": name,
                "ip": ip,
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
        var nodeList = this.props.node_list.map(function(node){
            return(
                <NodeEntry name={node.name} ip={node.ip} tags={node.tags} key={node._id}
                    id={node._id} onRefresh={that.props.onRefresh} />
            )
        });
        var addNewNodeRow =
            <tr>
                <td><mui.TextField ref="newName" /></td>
                <td><mui.TextField ref="newIP" /></td>
                <td><mui.TextField ref="newTag" /></td>
                <td><mui.FlatButton label="Add" onClick={this.handleCreateNewNode} /></td>
            </tr>;
        return (
            <div>
            <bootstrap.Table striped bordered hover condensed>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>IP Address</th>
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
        var tags = this.props.tags.map(function(tag, index){
            return(
                <bootstrap.Badge>{tag['name']}</bootstrap.Badge>
            )
        });
        return (
            <tr>
                <td key={this.props.id + 'name'}>{this.props.name}</td>
                <td key={this.props.id + 'ip'}>{this.props.ip}</td>
                <td key={this.props.id + 'tags'}>{tags}</td>
                <td key={this.props.id + 'actions'}>
                    <NodeEditButton nodeId={this.props.id} nodeName={this.props.name}
                        nodeIp={this.props.ip} nodeTags={this.props.tags}
                        onRefresh={this.props.onRefresh} />
                    <NodeInfoButton nodeId={this.props.id} nodeName={this.props.name}
                        nodeIp={this.props.ip} />
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
                "ip": this.refs.ipInput.getValue().trim(),
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
            <mui.TextField floatingLabelText="IP Address" defaultValue={this.props.nodeIp}
                ref="ipInput" />
            <mui.TextField floatingLabelText="Tags" defaultValue={tags.join(" ")}
                ref="tagInput" multiLine={true} />
            </div>;
        return (
            <span>
            <mui.FlatButton label="Edit" onClick={this.handleClick} />
            <mui.Dialog
                title={"Edit info for " + this.props.nodeIp}
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
    showInfo: function(){
        this.refs.infoDialog.show();
    },
    render: function(){
        var title = this.props.nodeName+'('+this.props.nodeIp+')';
        var infoAction = [
            {text: 'Close'}
        ];
        return (
            <span>
            <mui.FlatButton label="Info" onClick={this.showInfo} />
            <mui.Dialog
                title={title}
                actions={infoAction}
                modal={true}
                ref="infoDialog">
                <div>
                    <MetricGraph node_id={this.props.nodeId} node_ip={this.props.nodeIp} />
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
                <SearchableNodeList />
            </mui.AppCanvas>
        )
    }
});

React.render(
    <NodeApp />,
    document.getElementById('content')
);