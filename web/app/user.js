var React = require('react');
//var Table = require('react-bootstrap/lib/Table');
var TextField = require('material-ui/lib/text-field');
var IconButton = require('material-ui/lib/icon-button');
var SvgIcon = require('material-ui/lib/svg-icon');
var Snackbar = require('material-ui/lib/snackbar');
var Dialog = require('material-ui/lib/dialog');
var AppCanvas = require('material-ui/lib/app-canvas');
var DropDownMenu = require('material-ui/lib/drop-down-menu');

var Table = require('material-ui/lib/table/table');
var TableBody = require('material-ui/lib/table/table-body');
var TableFooter =  require('material-ui/lib/table/table-footer');
var TableHeader= require('material-ui/lib/table/table-header');
var TableHeaderColumn = require('material-ui/lib/table/table-header-column');
var TableRow = require('material-ui/lib/table/table-row');
var TableRowColumn = require('material-ui/lib/table/table-row-column');

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
            selectedRows: []
        }
    },
    onRowSelection: function (selectedRows) {
        this.setState({selectedRows: selectedRows});
    },
    onRefresh: function() { // use this method to also clear current selections,
                            // otherwise only use `this.props.onRefresh` to keep them
        this.setState({selectedRows: []});
        this.props.onRefresh();
    },
    render: function() {
        var that = this;

        var userList = this.props.data.map(function(user, index){
            var projects = user.projects.map(function(project){
                return project.name;
            });
            var selected = true;
            if(that.state.selectedRows.indexOf(index) === -1) {
                selected = false;
            }
            return (
                <TableRow key={index} selected={selected}>
                    <TableRowColumn key={user._id + 'name'}>{user.name}</TableRowColumn>
                    <TableRowColumn key={user._id + 'role'}>{user.role}</TableRowColumn>
                    <TableRowColumn key={user._id + 'projects'}>{projects.join(' ')}</TableRowColumn>
                </TableRow>
            )
        });

        var actions = [];
        var names = [], ids = [];
        this.state.selectedRows.map(function(rowIndex){
            var user = that.props.data[rowIndex];
            names.push(user.name);
            ids.push(user._id);
        });
        names = names.join(', ');
        actions.push(<UserAddButton onRefresh={this.props.onRefresh}/>);
        if(this.state.selectedRows.length === 1) {
            actions.push(<UserEditButton id={ids[0]}
                user={that.props.data[that.state.selectedRows[0]]}
                onRefresh={that.props.onRefresh}/>);
        }
        if(this.state.selectedRows.length >= 1) {
            actions.push(<DeleteButton name={names} ids={ids} url='user'
                                       onRefresh={this.onRefresh}/>);
            actions.push(<BatchAddProjectButton names={names} ids={ids}
                                    onRefresh={this.props.onRefresh}/>)
        }
        var ActionsRow =
            <TableRow>
                <TableRowColumn></TableRowColumn>
                <TableRowColumn></TableRowColumn>
                <TableRowColumn>
                    Actions: {actions}
                </TableRowColumn>
            </TableRow>;

        return (
            <div className="clear">
                <Table
                    fixedHeader={false}
                    fixedFooter={false}
                    selectable={true}
                    multiSelectable={true}
                    onRowSelection={this.onRowSelection}>
                    <TableHeader
                        displaySelectAll={false}
                        enableSelectAll={false}>
                        <TableRow>
                            <TableHeaderColumn>Name</TableHeaderColumn>
                            <TableHeaderColumn>Role</TableHeaderColumn>
                            <TableHeaderColumn>Projects</TableHeaderColumn>
                        </TableRow>
                    </TableHeader>
                    <TableBody
                        showRowHover={true}
                        deselectOnClickaway={false}>
                        {userList}
                    </TableBody>
                    <TableFooter>
                        {ActionsRow}
                    </TableFooter>
                </Table>
                <Snackbar ref="snackbar" message={this.state.snackMsg} />
            </div>
        )
    }
});

var UserAddButton = React.createClass({
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
    bindAutocomplete: function() {
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
    addUser: function(){
        $.ajax({
            type: "POST",
            url: "users",
            data: {
                "name": this.refs.nameInput.getValue().trim(),
                "role": this.state.roleStateDropDown,
                "projects": this.refs.projectInput.getValue().trim().split(/[\s,]+/)
            },
            success: function(data) {
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
    render: function(){
        var actions = [
            {text: 'Cancel'},
            {text: 'Add', onClick: this.addUser}
        ];
        var edits =
            <div>
                <TextField floatingLabelText="Name" defaultValue=''
                           id="newNameInput" ref="nameInput"/>
                <DropDownMenu menuItems={roleItems}
                              selectedIndex={0}
                              onChange={this.handleDropDownChange}
                    />
                <TextField floatingLabelText="Projects" defaultValue=''
                           ref="projectInput"/>
            </div>;
        return (
            <span>
                <i className="fa fa-plus fa-bg" onClick={this.handleClick} title="Add"></i>
                <Dialog
                    title="Add new user"
                    actions={actions}
                    ref="editDialog" contentClassName="dropDownDiv"
                    onShow={this.bindAutocomplete}>
                    {edits}
                </Dialog>
                <Snackbar ref="snackbar" message={this.state.snackMsg} />
            </span>
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
            url: "user/" + this.props.user._id,
            data: {
                "role": this.state.roleStateDropDown,
                "projects": this.refs.projectInput.getValue().trim().split(/[\s,]+/)
            },
            success: function(data) {
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
    render: function(){
        var editActions = [
            {text: 'Cancel'},
            {text: 'Update', onClick: this.updateUser}
        ];
        var projects = this.props.user.projects.map(function(p){
            return p.name;
        });
        var selectedRoleIndex = 0;
        if (!this.state.roleStateDropDown) {
            if(this.props.user.role === 'User') selectedRoleIndex = 0;
            if(this.props.user.role === 'Leader') selectedRoleIndex = 1;
            if(this.props.user.role === 'Root') selectedRoleIndex = 2;
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
                    title={"Edit info for " + this.props.user.name}
                    actions={editActions}
                    ref="editDialog" contentClassName="dropDownDiv">
                {edits}
                </Dialog>
                <Snackbar ref="snackbar" message={this.state.snackMsg} />
            </span>
        )
    }
});

var BatchAddProjectButton = React.createClass({
    mixins: [mixins.materialMixin],
    handleClick: function() {
        this.refs.editDialog.show();
    },
    getInitialState: function() {
        return {snackMsg: ''}
    },
    addUser: function() {
        var that = this;
        var appendRequests = [];
        this.props.ids.map(function(id){
            appendRequests.push(
                $.ajax({
                    type: 'POST',
                    url: 'user/' + id + '/projects',
                    data: {
                        projects: that.refs.projectInput.getValue().trim().split(/[\s,]+/)
                    },
                    error: function(xhr, status, err) {
                        if (xhr.status === 401) {
                            location.assign('/login.html');
                        }
                    }
                })
            );
            $.when.apply($, appendRequests)
             .done(function(){
                 that.props.onRefresh(null, null, true);
                 that.refs.editDialog.dismiss();
             }).fail(function(){
                that.setState({snackMsg: 'Failed to add projects'});
                that.refs.snackbar.show();
             })
        });
    },
    render: function() {
        var actions = [
            {text: 'Cancel'},
            {text: 'Add', onClick: this.addUser}
        ];
        var edits =
            <div>
                <TextField floatingLabelText="Projects" defaultValue=''
                           ref="projectInput"/>
            </div>;
        return (
            <span>
                <i className="fa fa-tags fa-bg" onClick={this.handleClick} title="Add Projects"></i>
                <Dialog
                    title="Add extra projects to these users:"
                    actions={actions}
                    ref="editDialog" contentClassName="dropDownDiv"
                    onShow={this.bindAutocomplete}>
                    {'Users: ' + this.props.names}
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