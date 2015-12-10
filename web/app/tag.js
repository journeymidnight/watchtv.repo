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


var TagList = React.createClass({
    mixins: [mixins.materialMixin],
    getInitialState: function () {
        return {snackMsg: ''}
    },
    handleCreateNewTag: function() {
        var name = this.refs.newName.getValue().trim(),
            monItems = this.refs.newMonitorItems.getValue().trim().split(/[\s,]+/),
            alarmRules = this.refs.newAlarmRules.getValue().trim(),
            receivers = this.refs.newReceivers.getValue().trim().split(/[\s,]+/);
        $.ajax({
            type: 'POST',
            url: 'tags',
            data: {
                'name': name,
                'monitorItems': monItems,
                'alarmRules': [alarmRules],
                'alarmReceivers': receivers
            },
            success: function(){
                this.props.onRefresh(null, null, true);
                this.setState({snackMsg: 'Tag"' + name + '" created'});
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
            this.handleCreateNewTag();
        }
    },
    componentDidMount: function () {
        $('#newMonitorItems').autocomplete(createMultiAutocompleteObject('q?monitored='));
        $('#newName').bind('keydown', this.onKeydown);
    },
    render: function() {
        var that = this;
        var tagList = this.props.data.map(function(tag){
            return (
                <TagEntry name={tag.name} id={tag._id} monitorItems={tag.monitorItems}
                    alarmRules={tag.alarmRules} alarmReceivers={tag.alarmReceivers}
                    onRefresh={that.props.onRefresh} />
            )
        });
        var addNewTagRow =
            <tr className="add_node">
                <td><TextField ref="newName" id="newName"/></td>
                <td><TextField ref="newMonitorItems" id="newMonitorItems"/></td>
                <td><TextField ref="newAlarmRules"/></td>
                <td><TextField ref="newReceivers"/></td>
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
                            <th>Alarm Receivers</th>
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
                <td key={this.props.id + 'receivers'}>{this.props.alarmReceivers}</td>
                <td key={this.props.id + 'actions'}>
                    <TagEditButton id={this.props.id} name={this.props.name}
                        monitorItems={this.props.monitorItems}
                        alarmRules={this.props.alarmRules}
                        alarmReceivers={this.props.alarmReceivers}
                        onRefresh={this.props.onRefresh} />
                    <DeleteButton ids={[this.props.id]} name={this.props.name} url="tag"
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
    updateTag: function(){
        $.ajax({
            type: "PUT",
            url: "tag/" + this.props.id,
            data: {
                name: this.refs.nameInput.getValue().trim(),
                monitorItems: this.refs.monitorItemsInput.getValue().trim().split(/[\s,]+/),
                alarmRules: [this.refs.alarmRules.getValue().trim()],
                alarmReceivers: this.refs.alarmReceivers.getValue().trim().split(/[\s,]+/)
            },
            success: function() {
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
            this.updateTag();
        }
    },
    bindEvents: function () {
        $('#monitorItemsInput').autocomplete(createMultiAutocompleteObject('q?monitored='));
        $('#nameInput').bind('keydown', this.onKeydown);
    },
    render: function(){
        var editActions = [
            {text: 'Cancel'},
            {text: 'Update', onClick: this.updateTag}
        ];
        var edits =
            <div>
                <div>
                <TextField floatingLabelText="Name" defaultValue={this.props.name}
                    ref="nameInput" id="nameInput"/>
                <TextField floatingLabelText="Monitored Items"
                    defaultValue={this.props.monitorItems.join(" ")}
                    ref="monitorItemsInput" id="monitorItemsInput" />
                <TextField floatingLabelText="Alarm Receivers"
                    defaultValue={this.props.alarmReceivers.join(' ') || ''}
                    ref="alarmReceivers" />
                <TextField floatingLabelText="Alarm Rules"
                           defaultValue={this.props.alarmRules[0]}
                           multiLine={true}
                           ref="alarmRules" />
                </div>
            </div>;
        return (
            <span>
                <i className="fa fa-pencil fa-transform" onClick={this.handleClick} title="Edit"></i>
                <Dialog
                    title={"Edit info for " + this.props.name}
                    onShow={this.bindEvents}
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