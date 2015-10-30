var React = require('react');
var Table = require('react-bootstrap/lib/Table');
var TextField = require('material-ui/lib/text-field');
var IconButton = require('material-ui/lib/icon-button');
var SvgIcon = require('material-ui/lib/svg-icon');
var Snackbar = require('material-ui/lib/snackbar');
var Dialog = require('material-ui/lib/dialog');
var AppCanvas = require('material-ui/lib/app-canvas');
var DropDownMenu = require('material-ui/lib/drop-down-menu');

var mixins = require('./mixins.js');
var DeleteButton = require('./ui/deleteButton.js');
var NavigationBar = require('./ui/navigationBar.js');
var SearchableList = require('./ui/searchableList.js');

var roleItems = [
    {payload: 'User', text: 'User'},
    {payload: 'Leader', text: 'Leader'},
    {payload: 'Root', text: 'Root'}
];

var UserList = React.createClass({
    mixins: [mixins.materialMixin],
    getInitialState: function () {
        return {
            snackMsg: '',
            roleStateDropDown: 'User'
        }
    },
    handleCreateNewUser: function() {
        var name = this.refs.newName.getValue().trim(),
            role = this.state.roleStateDropDown,
            projects = this.refs.newProject.getValue().trim().split(/[\s,]+/);
        $.ajax({
            type: "POST",
            url: "users",
            data: {
                "name": name,
                "role": role,
                "projects": projects
            },
            success: function(_) {
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
        })
    },
    handleRoleDropDownChange: function(err, selectedIndex, menuItem) {
        this.setState({roleStateDropDown: menuItem.text});
    },
    componentDidUpdate: function() {
        $('#newNameInput').autocomplete({
            source: function(req, res) {
                var input = req.term;
                if(input.length < 3) {
                    res([])
                }
                $.ajax({
                    url: 'q?oauthuser=' + input,
                    dataType: 'json',
                    success: function(data) {
                        res(data)
                    },
                    error: function(_) {
                        res([])
                    }
                })
            }
        })
    },
    render: function() {
        var that = this;
        var userList = this.props.data.map(function(user){
            return (
                <UserEntry name={user.name} role={user.role} projects={user.projects} key={user._id}
                    id={user._id} onRefresh={that.props.onRefresh} />
            )
        });
        var addNewUserRow =
            <tr>
                <td><TextField ref="newName" id="newNameInput" /></td>
                <td><DropDownMenu ref="newRole" menuItems={roleItems}
                    onChange={this.handleRoleDropDownChange} /></td>
                <td><TextField ref="newProject" /></td>
                <td>
                    <i className="fa fa-plus fa-bg" onClick={this.handleCreateNewUser} title="Add"></i>
                </td>
            </tr>;
        return (
            <div className="clear">
                <Table striped bordered hover condensed>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Role</th>
                            <th>Projects</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {userList}
                    </tbody>
                    <tfoot>
                        {addNewUserRow}
                    </tfoot>
                </Table>
                <Snackbar ref="snackbar" message={this.state.snackMsg} />
            </div>
        )
    }
});

var UserEntry = React.createClass({
    render: function() {
        var that = this;
        var projects = this.props.projects.map(function(project){
                return project.name;
        });
        return (
            <tr>
                <td key={this.props.id + 'name'}>{this.props.name}</td>
                <td key={this.props.id + 'role'}>{this.props.role}</td>
                <td key={this.props.id + 'projects'}>{projects.join(' ')}</td>
                <td key={this.props.id + 'actions'}>
                    <UserEditButton id={this.props.id} name={this.props.name}
                        userProjects={this.props.projects} userRole={this.props.role}
                        onRefresh={this.props.onRefresh} />
                    <DeleteButton id={this.props.id} onRefresh={this.props.onRefresh}
                        name={this.props.name} url="user" />
                </td>
            </tr>
        )
    }
});

var UserEditButton = React.createClass({
    mixins: [mixins.materialMixin],
    handleClick: function(){
        this.refs.editDialog.show();
    },
    getInitialState: function(){
        return {snackMsg: ''}
    },
    handleDropDownChange: function(err, selectedIndex, menuItem) {
        this.setState({roleStateDropDown: menuItem.text})
    },
    updateUser: function(){
        $.ajax({
            type: "PUT",
            url: "user/" + this.props.id,
            data: {
                "role": this.state.roleStateDropDown,
                "projects": this.refs.projectInput.getValue().trim().split(/[\s,]+/)
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
            {text: 'Update', onClick: this.updateUser}
        ];
        var projects = this.props.userProjects.map(function(p){
            return p.name;
        });
        var selectedRoleIndex = 0;
        if (!this.state.roleStateDropDown) {
            if(this.props.userRole === 'User') selectedRoleIndex = 0;
            if(this.props.userRole === 'Leader') selectedRoleIndex = 1;
            if(this.props.userRole === 'Root') selectedRoleIndex = 2;
        } else {
            if(this.state.roleStateDropDown === 'User') selectedRoleIndex = 0;
            if(this.state.roleStateDropDown === 'Leader') selectedRoleIndex = 1;
            if(this.state.roleStateDropDown === 'Root') selectedRoleIndex = 2;
        }
        var edits =
            <div>
                <DropDownMenu menuItems={roleItems}
                    selectedIndex={selectedRoleIndex}
                    onChange={this.handleDropDownChange}
                />
                <TextField floatingLabelText="Projects" defaultValue={projects.join(" ")}
                    ref="projectInput" multiLine={true} />
            </div>;
        return (
            <span>
                <i className="fa fa-pencil fa-transform" onClick={this.handleClick} title="Edit"></i>
                <Dialog
                    title={"Edit info for " + this.props.name}
                    actions={editActions}
                    ref="editDialog">
                {edits}
                </Dialog>
                <Snackbar ref="snackbar" message={this.state.snackMsg} />
            </span>
        )
    }
});

var UserApp = React.createClass({
    mixins: [mixins.materialMixin, mixins.configMixin],
    render: function(){
        return (
            <AppCanvas>
                <NavigationBar title="Users" />
                <SearchableList
                    type="user"
                    listClass={UserList}
                    hintText="Find known users"
                    config={this.state.config}
                    additionalFilter="project"
                />
            </AppCanvas>
        )
    }
});

React.render(
    <UserApp />,
    document.getElementById('content')
);