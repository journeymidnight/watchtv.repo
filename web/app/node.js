var React = require('react');
var Table = require('react-bootstrap/lib/Table');
var Badge = require('react-bootstrap/lib//Badge');
var TextField = require('material-ui/lib/text-field');
var IconButton = require('material-ui/lib/icon-button');
var Snackbar = require('material-ui/lib/snackbar');
var Dialog = require('material-ui/lib/dialog');
var AppCanvas = require('material-ui/lib/app-canvas');

var mixins = require('./mixins.js');
var DeleteButton = require('./ui/deleteButton.js');
var NavigationBar = require('./ui/navigationBar.js');
var SearchableList = require('./ui/searchableList.js');


var NodeList = React.createClass({
    mixins: [mixins.materialMixin],
    getInitialState: function () {
        return {snackMsg: ''};
    },
    handleCreateNewNode: function() {
        var name = this.refs.newName.getValue().trim(),
            ips = this.refs.newIP.getValue().trim().split(/[\s,]+/),
            tags = this.refs.newTag.getValue().trim().split(/[\s,]+/),
            description = this.refs.newDescription.getValue().trim().split(/[\s,]+/),
            region = this.refs.newRegion.getValue().trim(),
            idc = this.refs.newIdc.getValue().trim(),
            project = this.refs.newProject.getValue().trim();
        $.ajax({
            type: "POST",
            url: "nodes",
            data: {
                "name": name,
                "ips": ips,
                "tags": tags,
                "description": description,
                "region": region,
                "idc": idc,
                "project": project
            },
            success: function() {
                this.props.onRefresh();
            }.bind(this),
            error: function(xhr, status, err) {
                if (xhr.status === 401) {
                    location.assign('/login.html');
                }
                console.error(xhr, status, err.toString());
                this.setState({snackMsg: xhr.responseText});
                this.refs.snackbar.show();
            }.bind(this)
        });
    },
    render: function() {
        var that = this;
        var nodeList = this.props.data.map(function(node){
            return(
                <NodeEntry name={node.name} ips={node.ips} tags={node.tags} key={node._id}
                    region={node.region} idc={node.idc} project={node.project}
                    id={node._id} description={node.description} state={node.state}
                    onRefresh={that.props.onRefresh} config={that.props.config} />
            )
        });
        var addNewNodeRow =
            <tr className="add_node">
                <td><TextField ref="newName" /></td>
                <td><TextField ref="newIP" /></td>
                <td><TextField ref="newTag" /></td>
                <td><TextField ref="newDescription" /></td>
                <td><TextField ref="newProject" /></td>
                <td><TextField ref="newRegion" /></td>
                <td><TextField ref="newIdc" /></td>
                <td>
                    <i className="fa fa-plus fa-bg" onClick={this.handleCreateNewNode} title="Add"></i>
                </td>
            </tr>;
        return (
            <div className="clear">
            <Table striped bordered hover condensed>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>IP Addresses</th>
                        <th>Tags</th>
                        <th>Description</th>
                        <th>Project</th>
                        <th>Region</th>
                        <th>IDC</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {nodeList}
                </tbody>
                <tfoot>
                    {addNewNodeRow}
                </tfoot>
            </Table>
            <Snackbar ref="snackbar" message={this.state.snackMsg} />
            </div>
        )
    }
});

var NodeEntry = React.createClass({
    render: function(){
        var that = this;
        var tags = this.props.tags.map(function(tag, index){
            return(
                <Badge key={that.props.id+'tag'+tag['name']}>
                    {tag['name']}
                </Badge>
            )
        });
        return (
            <tr className="nodeEntry">
                <td key={this.props.id + 'name'} className="name">{this.props.name}</td>
                <td key={this.props.id + 'ip'} className="nodeIp">{this.props.ips.join('  ')}</td>
                <td key={this.props.id + 'tags'}>{tags}</td>
                <td key={this.props.id + 'description'}>{this.props.description}</td>
                <td key={this.props.id + 'project'}>{this.props.project.name}</td>
                <td key={this.props.id + 'region'}>{this.props.region.name}</td>
                <td key={this.props.id + 'idc'}>{this.props.idc.name}</td>
                <td key={this.props.id + 'actions'} className="toolBtn">
                    <NodeEditButton nodeId={this.props.id} nodeName={this.props.name}
                        nodeIps={this.props.ips} nodeTags={this.props.tags}
                        nodeRegion={this.props.region} nodeIdc={this.props.idc}
                        nodeProject={this.props.project}
                        onRefresh={this.props.onRefresh}
                        nodeDescription={this.props.description}
                    />
                    <NodeInfoButton nodeId={this.props.id} nodeName={this.props.name}
                        nodeIps={this.props.ips} description={this.props.description}
                        state={this.props.state} config={this.props.config}
                    />
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
                "tags": this.refs.tagInput.getValue().trim().split(/[\s,]+/),
                "region": this.refs.regionInput.getValue().trim(),
                "idc": this.refs.idcInput.getValue().trim(),
                "project": this.refs.projectInput.getValue().trim()
            },
            success: function(data) {
                this.refs.editDialog.dismiss();
                this.props.onRefresh()
            }.bind(this),
            error: function(xhr, status, err) {
                if (xhr.status === 401) {
                    location.assign('/login.html');
                }
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
        var tags = this.props.nodeTags.map(function(t){
            return t.name;
        });
        var edits = <div>
            <TextField floatingLabelText="Name" defaultValue={this.props.nodeName}
                ref="nameInput" />
            <TextField floatingLabelText="IP Address"
                defaultValue={this.props.nodeIps.join("  ")}
                ref="ipInput" />
            <TextField floatingLabelText="Tags" defaultValue={tags.join(" ")}
                ref="tagInput" />
            <TextField floatingLabelText="Project" defaultValue={this.props.nodeProject.name}
                           ref="projectInput" />
            <TextField floatingLabelText="Region" defaultValue={this.props.nodeRegion.name}
                ref="regionInput" />
            <TextField floatingLabelText="IDC" defaultValue={this.props.nodeIdc.name}
                ref="idcInput" />
                <div>
                    <TextField floatingLabelText="Description"
                        defaultValue={this.props.nodeDescription}
                        ref="descriptionInput" multiLine={true}
                    />
                </div>
            </div>;
        return (
            <span>
                <i className="fa fa-pencil fa-transform" onClick={this.handleClick} title="Edit"></i>
                <Dialog
                    title={"Edit info for " + this.props.nodeName}
                    actions={editActions}
                    ref="editDialog">
                {edits}
                </Dialog>
                <Snackbar ref="snackbar" message={this.state.snackMsg} />
            </span>
        )
    }
});

var NodeInfoButton = React.createClass({
    mixins: [mixins.materialMixin],
    getInitialState: function() {
        return {}
    },
    showInfo: function(){
        window.open( "/single.html?_id="+this.props.nodeId);
    },
    render: function(){
        if(this.props.state == "Good") {// green, signifies the node is in good condition
            return (
                <span>
                    <i className="fa fa-signal infoBtn fa-bg active" onClick={this.showInfo} title="Info"></i>
                </span>
            );
        }else{
            return (
                <span>
                    <i className="fa fa-signal infoBtn fa-bg" onClick={this.showInfo} title="Info"></i>
                </span>
            );
        }
    }
});

var NodeApp = React.createClass({
    mixins: [mixins.materialMixin, mixins.configMixin],
    render: function(){
        return (
            <AppCanvas>
                <NavigationBar title="Nodes" />
                <SearchableList
                    type="node"
                    listClass={NodeList}
                    hintText="Find by name ip or tag"
                    config={this.state.config}
                    additionalFilter="project region idc"
                />
            </AppCanvas>
        )
    }
});

React.render(
    <NodeApp />,
    document.getElementById('content')
);