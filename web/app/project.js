var React = require('react');
var Table = require('react-bootstrap/lib/Table');
var TextField = require('material-ui/lib/text-field');
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
                this.props.onRefresh(null, null, true);
                this.setState({snackMsg: __('Project created:') + name});
                this.refs.snackbar.show();
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
    onKeydown: function(event) {
        if(event.which === 13) {
            event.preventDefault();
            this.handleCreateNewProject();
        }
    },
    componentDidMount: function() {
        $('#newLeader').autocomplete(createSingleAutocompleteObject('q?oauthuser='));
        $('#newName').bind('keydown', this.onKeydown);
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
                <td><TextField ref="newName" id="newName"/></td>
                <td><TextField ref="newLeader" id="newLeader"/></td>
                <td>
                    <i className="fa fa-plus fa-bg" onClick={this.handleCreateNewProject} title={__("Add")}></i>
                </td>
            </tr>;
        return (
            <div className="clear">
                <Table striped bordered hover condensed>
                    <thead>
                    <tr>
                        <th>{__('Name')}</th>
                        <th>{__('Leader')}</th>
                        <th>{__('Actions')}</th>
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
                    <DeleteButton ids={[this.props.id]} name={this.props.name} url="project"
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
    updateProject: function(){
        $.ajax({
            type: "PUT",
            url: "project/" + this.props.id,
            data: {
                "name": this.refs.nameInput.getValue().trim(),
                "leader": this.refs.leaderInput.getValue().trim().split(/[\s,]+/)
            },
            success: function(_) {
                this.refs.editDialog.dismiss();
                this.props.onRefresh(null, null, true)
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
    onKeydown: function(event) {
        if(event.which === 13) {
            event.preventDefault();
            this.updateProject();
        }
    },
    bindEvents: function() {
        $('#leaderInput').autocomplete(createSingleAutocompleteObject('q?oauthuser='));
        $('#nameInput').bind('keydown', this.onKeydown);
    },
    render: function(){
        var editActions = [
            {text: 'Cancel'},
            {text: 'Update', onClick: this.updateProject}
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
                    <TextField floatingLabelText={__("Name")} defaultValue={this.props.name}
                                   ref="nameInput" id="nameInput"/>
                </div>
                <div>
                    <TextField floatingLabelText={__("Leader")}
                                   defaultValue={leader}
                                   ref="leaderInput" id="leaderInput"/>
                </div>
            </div>;
        return (
            <span>
                <i className="fa fa-pencil fa-transform" onClick={this.handleClick} title={__("Edit")}></i>
                <Dialog
                    title={__("Edit info for ") + this.props.name}
                    actions={editActions}
                    onShow={this.bindEvents}
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
                <NavigationBar title={__("Projects")} />
                <SearchableList
                    type="project"
                    listClass={ProjectList}
                    hintText={__("Find projects")}
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