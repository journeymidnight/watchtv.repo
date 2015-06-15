var React = require('react');
var _ = require('underscore');
var mui = require('material-ui');
var bootstrap = require('react-bootstrap');

var mixins = require('./mixins.js');
var SearchBar = require('./ui/searchbar.js');
var DeleteButton = require('./ui/deletebutton.js');
var NavigationBar = require('./ui/navigationbar.js');

var SearchableTagList = React.createClass({
    componentDidMount: function() {
        $.ajax({
            url: 'tags',
            dataType: 'json',
            success: function(data){
                this.setState({tag_list: data})
            }.bind(this),
            error: function(xhr, status, err){
                console.error('get tags: ', status, err.toString())
            }
        })
    },
    getInitialState: function() {
        return {
            tag_list: [],
            keyword: ''
        }
    },
    handleKeyword: function(keyword){
        if(keyword == undefined) {
            keyword = this.state.keyword
        }
        var that = this;
        $.ajax({
            url: 'q?' + $.param({tag: keyword}),
            dataType: 'json',
            success: function(data) {
                console.log(data)
                that.setState({
                    tag_list: data,
                    keyword: keyword
                });
            }
        })
    },
    render: function(){
        return (
            <div>
                <SearchBar onNewKeywords={this.handleKeyword} hintText="Find tags" />
                <TagList tag_list={this.state.tag_list} onRefresh={this.handleKeyword} />
            </div>
        )
    }
});

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
            success: function(_){
                this.props.onRefresh()
            }.bind(this),
            error: function(xhr, status, err) {
                console.error(xhr, status, err.toString());
                this.setState({snackMsg: xhr.responseText});
                this.refs.snackbar.show()
            }.bind(this)
        })
    },
    render: function() {
        var that = this;
        var tagList = this.props.tag_list.map(function(tag){
            return (
                <TagEntry name={tag.name} id={tag._id} monitorItems={tag.monitorItems}
                    alarmRules={tag.alarmRules} receiverGroups={tag.alarmReceiverGroups}
                    onRefresh={that.props.onRefresh} />
            )
        });
        var addNewTagRow =
            <tr>
                <td><mui.TextField ref="newName" /></td>
                <td><mui.TextField ref="newMonitorItems" /></td>
                <td><mui.TextField ref="newAlarmRules" disabled={true} /></td>
                <td><mui.TextField ref="newReceiverGroups" disabled={true} /></td>
                <td><mui.FlatButton label="Add" onClick={this.handleCreateNewTag} /></td>
            </tr>;
        return (
            <div>
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
            success: function(_) {
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
                <mui.FlatButton label="Edit" onClick={this.handleClick} />
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
    mixins: [mixins.materialMixin],
    render: function(){
        return (
            <mui.AppCanvas>
                <NavigationBar title="Tags" />
                <SearchableTagList />
            </mui.AppCanvas>
        )
    }
});

React.render(
    <TagApp />,
    document.getElementById('content')
);