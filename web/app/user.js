var React = require('react');
var mui = require('material-ui');
var bootstrap = require('react-bootstrap');

var mixins = require('./mixins.js');
var DeleteButton = require('./ui/deletebutton.js');
var NavigationBar = require('./ui/navigationbar.js');
var SearchableList = require('./ui/searchablelist.js');

var roleItems = [
    {payload: 'User', text: 'User'},
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
            tags = this.refs.newTag.getValue().trim().split(/[\s,]+/);
        $.ajax({
            type: "POST",
            url: "users",
            data: {
                "name": name,
                "role": role,
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
    handleDropDownChange: function(err, selectedIndex, menuItem) {
        this.setState({roleStateDropDown: menuItem.text})
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
                <UserEntry name={user.name} role={user.role} tags={user.tags} key={user._id}
                    id={user._id} onRefresh={that.props.onRefresh} />
            )
        });
        var addNewUserRow =
            <tr>
                <td><mui.TextField ref="newName" id="newNameInput" /></td>
                <td><mui.DropDownMenu ref="newRole" menuItems={roleItems}
                    onChange={this.handleDropDownChange} /></td>
                <td><mui.TextField ref="newTag" /></td>
                <td>
                    <mui.IconButton tooltip="Add" onClick={this.handleCreateNewUser}>
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
            <div>
                <bootstrap.Table striped bordered hover condensed>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Role</th>
                            <th>Tags</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {userList}
                    </tbody>
                    <tfoot>
                        {addNewUserRow}
                    </tfoot>
                </bootstrap.Table>
                <mui.Snackbar ref="snackbar" message={this.state.snackMsg} />
            </div>
        )
    }
});

var UserEntry = React.createClass({
    render: function() {
        var that = this;
        var tags = this.props.tags.map(function(tag){
            return(
                <bootstrap.Badge key={that.props.id+'tag'+tag['name']}>
                    {tag['name']}
                </bootstrap.Badge>
            )
        });
        return (
            <tr>
                <td key={this.props.id + 'name'}>{this.props.name}</td>
                <td key={this.props.id + 'role'}>{this.props.role}</td>
                <td key={this.props.id + 'tags'}>{tags}</td>
                <td key={this.props.id + 'actions'}>
                    <UserEditButton id={this.props.id} name={this.props.name}
                        userTags={this.props.tags} userRole={this.props.role}
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
            {text: 'Update', onClick: this.updateUser}
        ];
        var tags = this.props.userTags.map(function(t){
            return t.name;
        });
        var selectedRoleIndex = 0;
        if (!this.state.roleStateDropDown) {
            if(this.props.userRole == 'Root') selectedRoleIndex = 1;
        } else {
            if(this.state.roleStateDropDown == 'Root') {
                selectedRoleIndex = 1;
            } else {
                selectedRoleIndex = 0;
            }
        }
        var edits =
            <div>
                <mui.DropDownMenu menuItems={roleItems}
                    selectedIndex={selectedRoleIndex}
                    onChange={this.handleDropDownChange}
                />
                <mui.TextField floatingLabelText="Tags" defaultValue={tags.join(" ")}
                    ref="tagInput" multiLine={true} />
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
                    title={"Edit info for " + this.props.name}
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

var UserApp = React.createClass({
    mixins: [mixins.materialMixin, mixins.configMixin],
    render: function(){
        return (
            <mui.AppCanvas>
                <NavigationBar title="Users" />
                <SearchableList
                    type="user"
                    listClass={UserList}
                    hintText="Find known users"
                    config={this.state.config}
                />
            </mui.AppCanvas>
        )
    }
});

React.render(
    <UserApp />,
    document.getElementById('content')
);