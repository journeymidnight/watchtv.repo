var React = require('react');
var mui = require('material-ui');
var bootstrap = require('react-bootstrap');

var mixins = require('./mixins.js');
var DeleteButton = require('./ui/deletebutton.js');
var NavigationBar = require('./ui/navigationbar.js');
var SearchableList = require('./ui/searchablelist.js');


var NodeList = React.createClass({
    mixins: [mixins.materialMixin],
    getInitialState: function () {
        return {snackMsg: ''};
    },
    handleCreateNewNode: function() {
        var name = this.refs.newName.getValue().trim(),
            ips = this.refs.newIP.getValue().trim().split(/[\s,]+/),
            tags = this.refs.newTag.getValue().trim().split(/[\s,]+/),
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
                "region": region,
                "idc": idc,
                "project": project
            },
            success: function() {
                this.props.onRefresh();
            }.bind(this),
            error: function(xhr, status, err) {
                console.error(xhr, status, err.toString());
                this.setState({snackMsg: xhr.responseText});
                this.refs.snackbar.show();
            }.bind(this)
        });
    },
    componentDidUpdate: function(){
        // clicking on table also triggers info button(show single page)
        $(".table").off().on('click','.name,.nodeIp',function(){
            $(this).parent().find('.toolBtn .infoBtn').trigger("click");
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
                <td><mui.TextField ref="newName" /></td>
                <td><mui.TextField ref="newIP" /></td>
                <td><mui.TextField ref="newTag" /></td>
                <td><mui.TextField ref="newRegion" /></td>
                <td><mui.TextField ref="newIdc" /></td>
                <td><mui.TextField ref="newProject" /></td>
                <td>
                    <mui.IconButton tooltip="Add" onClick={this.handleCreateNewNode}>
                        <mui.SvgIcon>
                            <svg fill="#444444" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
                                <path d="M0 0h24v24H0z" fill="none"/>
                            </svg>
                        </mui.SvgIcon>
                    </mui.IconButton>
                </td>
            </tr>;
        return (
            <div className="clear">
            <bootstrap.Table striped bordered hover condensed>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>IP Addresses</th>
                        <th>Tags</th>
                        <th>Region</th>
                        <th>IDC</th>
                        <th>Project</th>
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
            <tr className="nodeEntry">
                <td key={this.props.id + 'name'} className="name">{this.props.name}</td>
                <td key={this.props.id + 'ip'} className="nodeIp">{this.props.ips.join('  ')}</td>
                <td key={this.props.id + 'tags'}>{tags}</td>
                <td key={this.props.id + 'region'}>{this.props.region.name}</td>
                <td key={this.props.id + 'idc'}>{this.props.idc.name}</td>
                <td key={this.props.id + 'project'}>{this.props.project.name}</td>
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
            <mui.TextField floatingLabelText="Name" defaultValue={this.props.nodeName}
                ref="nameInput" />
            <mui.TextField floatingLabelText="IP Address"
                defaultValue={this.props.nodeIps.join("  ")}
                ref="ipInput" />
            <mui.TextField floatingLabelText="Tags" defaultValue={tags.join(" ")}
                ref="tagInput" />
            <mui.TextField floatingLabelText="Region" defaultValue={this.props.nodeRegion.name}
                ref="regionInput" />
            <mui.TextField floatingLabelText="IDC" defaultValue={this.props.nodeIdc.name}
                ref="idcInput" />
            <mui.TextField floatingLabelText="Project" defaultValue={this.props.nodeProject.name}
                ref="projectInput" />
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
                    <svg fill="#444444" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        <path d="M0 0h24v24H0z" fill="none"/>
                    </svg>
                </mui.SvgIcon>
            </mui.IconButton>
            <mui.Dialog
                title={"Edit info for " + this.props.nodeName}
                actions={editActions}
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
        return {}
    },
    showInfo: function(){
        window.location.href = "/single.html?_id="+this.props.nodeId;
    },
    render: function(){
        var fillColor = "#019875"; // green, signifies the node is in good condition
        if(this.props.state != "Good") {
            fillColor = "#444444"; // grey
        }
        return (
            <span>
                <mui.IconButton tooltip="Info" onClick={this.showInfo} className="infoBtn">
                    <mui.SvgIcon>
                        <svg fill={fillColor} height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                            <path d="M0 0h24v24H0z" fill="none"/>
                        </svg>
                    </mui.SvgIcon>
                </mui.IconButton>
            </span>
        )
    }
});

var NodeApp = React.createClass({
    mixins: [mixins.materialMixin, mixins.configMixin],
    render: function(){
        return (
            <mui.AppCanvas>
                <NavigationBar title="Nodes" />
                <SearchableList
                    type="node"
                    listClass={NodeList}
                    hintText="Find by name ip or tag"
                    config={this.state.config}
                    additionalFilter="region idc project"
                />
            </mui.AppCanvas>
        )
    }
});

React.render(
    <NodeApp />,
    document.getElementById('content')
);