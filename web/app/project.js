var React = require('react');
var Table = require('react-bootstrap/lib/Table');
var TextField = require('material-ui/lib/text-field');
var IconButton = require('material-ui/lib/icon-button');
var SvgIcon = require('material-ui/lib/svg-icon');
var Snackbar = require('material-ui/lib/snackbar');
var Dialog = require('material-ui/lib/dialog');
var AppCanvas = require('material-ui/lib/app-canvas');

var mixins = require('./mixins.js');
var DeleteButton = require('./ui/deleteButton.js');
var NavigationBar = require('./ui/navigationBar.js');
var SearchableList = require('./ui/searchableList.js');

var ProjectList = React.createClass({
    mixins: [mixins.materialMixin],
    getInitialState: function () {
        return {snackMsg: ''}
    },
    handleCreateNewProject: function() {
        var name = this.refs.newName.getValue().trim(),
            leader = this.refs.newLeader.getValue().trim();
        $.ajax({
            type: 'POST',
            url: 'projects',
            data: {
                'name': name,
                'leader': leader
            },
            success: function(){
                this.props.onRefresh()
            }.bind(this),
            error: function(xhr, status, err) {
                if (xhr.status === 401) {
                    location.assign('/login.html');
                }
                console.error(xhr, status, err.toString());
                this.setState({snackMsg: xhr.responseText});
                this.refs.snackbar.show()
            }.bind(this)
        })
    },
    render: function() {
        var that = this;
        var projectList = this.props.data.map(function(project){
            return (
                <ProjectEntry name={project.name} id={project._id} leader={project.leader}
                          onRefresh={that.props.onRefresh} />
            )
        });
        var addNewProjectRow =
            <tr>
                <td><TextField ref="newName" /></td>
                <td><TextField ref="newLeader" /></td>
                <td>
                    <IconButton tooltip="Add" onClick={this.handleCreateNewProject}>
                        <SvgIcon>
                            <svg fill="#000000" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
                                <path d="M0 0h24v24H0z" fill="none"/>
                            </svg>
                        </SvgIcon>
                    </IconButton>
                </td>
            </tr>;
        return (
            <div className="clear">
                <Table striped bordered hover condensed>
                    <thead>
                    <tr>
                        <th>Name</th>
                        <th>Leader</th>
                        <th>Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {projectList}
                    </tbody>
                    <tfoot>
                    {addNewProjectRow}
                    </tfoot>
                </Table>
                <Snackbar ref="snackbar" message={this.state.snackMsg} />
            </div>
        )
    }
});

var ProjectEntry = React.createClass({
    render: function(){
        var leader;
        if(!this.props.leader) {
            leader = ''
        } else {
            leader = this.props.leader.name
        }
        return (
            <tr>
                <td key={this.props.id + 'name'}>{this.props.name}</td>
                <td key={this.props.id + 'leader'}>{leader}</td>
                <td key={this.props.id + 'actions'}>
                    <ProjectEditButton id={this.props.id} name={this.props.name}
                                   leader={this.props.leader}
                                   onRefresh={this.props.onRefresh} />
                    <DeleteButton id={this.props.id} name={this.props.name} url="project"
                                  onRefresh={this.props.onRefresh}/>
                </td>
            </tr>
        )
    }
});

var ProjectEditButton = React.createClass({
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
            url: "project/" + this.props.id,
            data: {
                "name": this.refs.nameInput.getValue().trim(),
                "leader": this.refs.leaderInput.getValue().trim().split(/[\s,]+/)
            },
            success: function(_) {
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
        var leader;
        if(!this.props.leader) {
            leader = ''
        } else {
            leader = this.props.leader.name
        }
        var edits =
            <div>
                <div>
                    <TextField floatingLabelText="Name" defaultValue={this.props.name}
                                   ref="nameInput" />
                </div>
                <div>
                    <TextField floatingLabelText="Leader"
                                   defaultValue={leader}
                                   ref="leaderInput" multiLine={true} />
                </div>
            </div>;
        return (
            <span>
                <IconButton tooltip="Edit" onClick={this.handleClick}>
                    <SvgIcon>
                        <svg fill="#000000" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                            <path d="M0 0h24v24H0z" fill="none"/>
                        </svg>
                    </SvgIcon>
                </IconButton>
                <Dialog
                    title={"Edit info for " + this.props.name}
                    actions={editActions}
                    modal={true}
                    ref="editDialog">
                    {edits}
                </Dialog>
                <Snackbar ref="snackbar" message={this.state.snackMsg} />
            </span>
        )
    }
});

var ProjectApp = React.createClass({
    mixins: [mixins.materialMixin, mixins.configMixin],
    render: function(){
        return (
            <AppCanvas>
                <NavigationBar title="Projects" />
                <SearchableList
                    type="project"
                    listClass={ProjectList}
                    hintText="Find projects"
                    config={this.state.config}
                    additionalFilter=""
                    />
            </AppCanvas>
        )
    }
});

React.render(
    <ProjectApp />,
    document.getElementById('content')
);