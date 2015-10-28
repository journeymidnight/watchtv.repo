var React = require('react');
var mui = require('material-ui');
var bootstrap = require('react-bootstrap');

var mixins = require('./mixins.js');
var DeleteButton = require('./ui/deletebutton.js');
var NavigationBar = require('./ui/navigationbar.js');
var SearchableList = require('./ui/searchablelist.js');


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
                <td><mui.TextField ref="newName" /></td>
                <td><mui.TextField ref="newMonitorItems" /></td>
                <td><mui.TextField ref="newAlarmRules" disabled={true} /></td>
                <td><mui.TextField ref="newReceiverGroups" disabled={true} /></td>
                <td>
                    <mui.IconButton tooltip="Add" onClick={this.handleCreateNewTag}>
                    <mui.SvgIcon>
                        <svg fill="#000000" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
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
                </bootstrap.Table>
                <mui.Snackbar ref="snackbar" message={this.state.snackMsg} />
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
                <mui.TextField floatingLabelText="Name" defaultValue={this.props.name}
                    ref="nameInput" />
                </div>
                <div>
                <mui.TextField floatingLabelText="Monitored Items"
                    defaultValue={this.props.monitorItems.join(" ")}
                    ref="monitorItemsInput" multiLine={true} />
                </div>
            </div>;
        return (
            <span>
                <mui.IconButton tooltip="Edit" onClick={this.handleClick}>
                    <mui.SvgIcon>
                        <svg fill="#000000" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
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

var TagApp = React.createClass({
    mixins: [mixins.materialMixin, mixins.configMixin],
    render: function(){
        return (
            <mui.AppCanvas>
                <NavigationBar title="Tags" />
                <SearchableList
                    type="tag"
                    listClass={TagList}
                    hintText="Find tags"
                    config={this.state.config}
                    additionalFilter=""
                />
            </mui.AppCanvas>
        )
    }
});

React.render(
    <TagApp />,
    document.getElementById('content')
);