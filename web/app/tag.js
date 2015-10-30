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


var TagList = React.createClass({
    mixins: [mixins.materialMixin],
    getInitialState: function () {
        return {snackMsg: ''}
    },
    handleCreateNewTag: function() {
        var name = this.refs.newName.getValue().trim(),
            monItems = this.refs.newMonitorItems.getValue().trim().split(/[\s,]+/);
        $.ajax({
            type: 'POST',
            url: 'tags',
            data: {
                'name': name,
                'monitorItems': monItems,
                'alarmRules': [], // not implemented yet
                'alarmReceiverGroups': []  // not implemented yet
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
        var tagList = this.props.data.map(function(tag){
            return (
                <TagEntry name={tag.name} id={tag._id} monitorItems={tag.monitorItems}
                    alarmRules={tag.alarmRules} receiverGroups={tag.alarmReceiverGroups}
                    onRefresh={that.props.onRefresh} />
            )
        });
        var addNewTagRow =
            <tr className="add_node">
                <td><TextField ref="newName" /></td>
                <td><TextField ref="newMonitorItems" /></td>
                <td><TextField ref="newAlarmRules" disabled={true} /></td>
                <td><TextField ref="newReceiverGroups" disabled={true} /></td>
                <td>
                    <i className="fa fa-plus fa-bg" onClick={this.handleCreateNewTag} title="Add"></i>
                </td>
            </tr>;
        return (
            <div className="clear">
                <Table striped bordered hover condensed>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Monitored Items</th>
                            <th>Alarm Rules</th>
                            <th>Alarm Receiver Groups</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tagList}
                    </tbody>
                    <tfoot>
                        {addNewTagRow}
                    </tfoot>
                </Table>
                <Snackbar ref="snackbar" message={this.state.snackMsg} />
            </div>
        )
    }
});

var TagEntry = React.createClass({
    render: function(){
        return (
            <tr>
                <td key={this.props.id + 'name'}>{this.props.name}</td>
                <td key={this.props.id + 'monItems'}>{this.props.monitorItems.join(', ')}</td>
                <td key={this.props.id + 'alarmRules'}>{this.props.alarmRules}</td>
                <td key={this.props.id + 'receiverGroups'}>{this.props.receiverGroups}</td>
                <td key={this.props.id + 'actions'}>
                    <TagEditButton id={this.props.id} name={this.props.name}
                        monitorItems={this.props.monitorItems}
                        onRefresh={this.props.onRefresh} />
                    <DeleteButton id={this.props.id} name={this.props.name} url="tag"
                        onRefresh={this.props.onRefresh}/>
                </td>
            </tr>
        )
    }
});

var TagEditButton = React.createClass({
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
            url: "tag/" + this.props.id,
            data: {
                "name": this.refs.nameInput.getValue().trim(),
                "monitorItems": this.refs.monitorItemsInput.getValue().trim().split(/[\s,]+/)
            },
            success: function() {
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
        var edits =
            <div>
                <div>
                <TextField floatingLabelText="Name" defaultValue={this.props.name}
                    ref="nameInput" />
                </div>
                <div>
                <TextField floatingLabelText="Monitored Items"
                    defaultValue={this.props.monitorItems.join(" ")}
                    ref="monitorItemsInput" multiLine={true} />
                </div>
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

var TagApp = React.createClass({
    mixins: [mixins.materialMixin, mixins.configMixin],
    render: function(){
        return (
            <AppCanvas>
                <NavigationBar title="Tags" />
                <SearchableList
                    type="tag"
                    listClass={TagList}
                    hintText="Find tags"
                    config={this.state.config}
                    additionalFilter=""
                />
            </AppCanvas>
        )
    }
});

React.render(
    <TagApp />,
    document.getElementById('content')
);