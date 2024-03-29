var React = require('react');
var Table = require('react-bootstrap/lib/Table');
var Badge = require('react-bootstrap/lib//Badge');
var TextField = require('material-ui/lib/text-field');
var Toggle = require('material-ui/lib/toggle');
var Snackbar = require('material-ui/lib/snackbar');
var Dialog = require('material-ui/lib/dialog');
var AppCanvas = require('material-ui/lib/app-canvas');

var mixins = require('./mixins.js');
var DeleteButton = require('./ui/deleteButton.js');
var NavigationBar = require('./ui/navigationBar.js');
var SearchableList = require('./ui/searchableList.js');
var utility = require('./utility.js');


var NodeList = React.createClass({
    mixins: [mixins.materialMixin],
    getInitialState: function () {
        return {snackMsg: ''};
    },
    handleCreateNewNode: function() {
        var name = this.refs.newName.getValue().trim(),
            ips = this.refs.newIP.getValue().trim().split(/[\s,]+/),
            tags = this.refs.newTag.getValue().trim().split(/[\s,]+/),
            description = this.refs.newDescription.getValue().trim().split(/[\s,]+/),
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
                "description": description,
                "region": region,
                "idc": idc,
                "project": project
            },
            success: function() {
                this.props.onRefresh(null, null, true);
                this.setState({snackMsg: 'Node "' + name + '" created'});
                this.refs.snackbar.show();
            }.bind(this),
            error: function(xhr, status, err) {
                if (xhr.status === 401) {
                    location.assign('/login.html');
                }
                console.error(xhr, status, err.toString());
                this.setState({snackMsg: xhr.responseText});
                this.refs.snackbar.show();
            }.bind(this)
        });
    },
    componentDidMount: function() {
        $('#newTag').autocomplete(createMultiAutocompleteObject('q?tag=',
            utility.dataMapper.tag));
        $('#newProject').autocomplete(createSingleAutocompleteObject('q?project=',
            utility.dataMapper.project, 1));
        $('#newRegion').autocomplete(createSingleAutocompleteObject('q?region=',
            utility.dataMapper.region, 1));
        $('#newIdc').autocomplete(createSingleAutocompleteObject('q?idc=',
            utility.dataMapper.idc, 1));
        $('#newName, #newIP, #newDescription').bind('keydown', this.onKeydown);
    },
    onKeydown: function(event) {
        if(event.which === 13) {
            event.preventDefault();
            this.handleCreateNewNode();
        }
    },
    render: function() {
        var that = this;
        var nodeList = this.props.data.map(function(node){
            var judgeEnabled = true;
            if(node.judgeEnabled === false) judgeEnabled = false;
            return(
                <NodeEntry name={node.name} ips={node.ips} tags={node.tags} key={node._id}
                    region={node.region} idc={node.idc} project={node.project}
                    id={node._id} description={node.description} state={node.state}
                    judgeEnabled={judgeEnabled} ignoredAlarms={node.ignoredAlarms || []}
                    onRefresh={that.props.onRefresh} />
            )
        });
        var addNewNodeRow =
            <tr className="add_node">
                <td><TextField ref="newName" id="newName"/></td>
                <td><TextField ref="newIP" id="newIP"/></td>
                <td><TextField ref="newTag" id="newTag"/></td>
                <td><TextField ref="newDescription" id="newDescription"/></td>
                <td><TextField ref="newProject" id="newProject"/></td>
                <td><TextField ref="newRegion" id="newRegion"/></td>
                <td><TextField ref="newIdc" id="newIdc"/></td>
                <td>
                    <i className="fa fa-plus fa-bg" onClick={this.handleCreateNewNode} title={__("Add")}></i>
                </td>
            </tr>;
        return (
            <div className="clear">
            <Table striped bordered hover condensed>
                <thead>
                    <tr>
                        <th>{__('Name')}</th>
                        <th>{__('IP Addresses')}</th>
                        <th>{__('Tags')}</th>
                        <th>{__('Description')}</th>
                        <th>{__('Project')}</th>
                        <th>{__('Region')}</th>
                        <th>{__('IDC')}</th>
                        <th>{__('Actions')}</th>
                    </tr>
                </thead>
                <tbody>
                    {nodeList}
                </tbody>
                <tfoot>
                    {addNewNodeRow}
                </tfoot>
            </Table>
            <Snackbar ref="snackbar" message={this.state.snackMsg} />
            </div>
        )
    }
});

var NodeEntry = React.createClass({
    render: function(){
        var that = this;
        var tags = this.props.tags.map(function(tag, index){
            return(
                <Badge key={that.props.id+'tag'+tag['name']}>
                    {tag['name']}
                </Badge>
            )
        });
        return (
            <tr className="nodeEntry">
                <td key={this.props.id + 'name'} className="name">{this.props.name}</td>
                <td key={this.props.id + 'ip'} className="nodeIp">{this.props.ips.join('  ')}</td>
                <td key={this.props.id + 'tags'}>{tags}</td>
                <td key={this.props.id + 'description'}>{this.props.description}</td>
                <td key={this.props.id + 'project'}>{this.props.project.name}</td>
                <td key={this.props.id + 'region'}>{this.props.region.name}</td>
                <td key={this.props.id + 'idc'}>{this.props.idc.name}</td>
                <td key={this.props.id + 'actions'} className="toolBtn">
                    <NodeEditButton nodeId={this.props.id} nodeName={this.props.name}
                        nodeIps={this.props.ips} nodeTags={this.props.tags}
                        nodeRegion={this.props.region} nodeIdc={this.props.idc}
                        nodeProject={this.props.project}
                        onRefresh={this.props.onRefresh}
                        nodeDescription={this.props.description}
                        judgeEnabled={this.props.judgeEnabled}
                        ignoredAlarms={this.props.ignoredAlarms}
                    />
                    <NodeInfoButton nodeId={this.props.id} nodeName={this.props.name}
                        nodeIps={this.props.ips} description={this.props.description}
                        state={this.props.state}
                    />
                    <NodeAlarmButton nodeId={this.props.id} />
                    <DeleteButton ids={[this.props.id]} onRefresh={this.props.onRefresh}
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
                "project": this.refs.projectInput.getValue().trim(),
                "judgeEnabled": this.refs.alarmToggle.isToggled(),
                "ignoredAlarms": this.refs.ignoredAlarmsInput.getValue().trim().split(/[\s,]+/)
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
    bindEvents: function() {
        $('#tagInput').autocomplete(createMultiAutocompleteObject('q?tag=',
            utility.dataMapper.tag));
        $('#projectInput').autocomplete(createSingleAutocompleteObject('q?project=',
            utility.dataMapper.project, 1));
        $('#regionInput').autocomplete(createSingleAutocompleteObject('q?region=',
            utility.dataMapper.region, 1));
        $('#idcInput').autocomplete(createSingleAutocompleteObject('q?idc=',
            utility.dataMapper.idc, 1));
        $('#nameInput, #ipInput').bind('keydown', this.onKeydown);
    },
    onKeydown: function(event) {
        if(event.which === 13) {
            event.preventDefault();
            this.updateNode();
        }
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
            <Toggle label={__("Enable Alarm")}
                    ref="alarmToggle"
                    style={{width: '35%'}}
                    defaultToggled={this.props.judgeEnabled} />
            <TextField floatingLabelText={__("Name")} defaultValue={this.props.nodeName}
                ref="nameInput" id="nameInput"/>
            <TextField floatingLabelText={__("IP Address")}
                defaultValue={this.props.nodeIps.join("  ")}
                ref="ipInput" id="ipInput"/>
            <TextField floatingLabelText={__("Tags")}
                       defaultValue={tags.join(" ")}
                ref="tagInput" id="tagInput"/>
            <TextField floatingLabelText={__("Project")} defaultValue={this.props.nodeProject.name}
                           ref="projectInput" id="projectInput"/>
            <TextField floatingLabelText={__("Region")} defaultValue={this.props.nodeRegion.name}
                ref="regionInput" id="regionInput"/>
            <TextField floatingLabelText={__("IDC")} defaultValue={this.props.nodeIdc.name}
                ref="idcInput" id="idcInput"/>
            <TextField floatingLabelText={__("Ignored Alarms")}
                       defaultValue={this.props.ignoredAlarms.join(' ')}
                       ref="ignoredAlarmsInput"/>
                <div>
                    <TextField floatingLabelText={__("Description")}
                        defaultValue={this.props.nodeDescription}
                        ref="descriptionInput" multiLine={true}
                    />
                </div>
            </div>;
        return (
            <span>
                <i className="fa fa-pencil fa-transform" onClick={this.handleClick} title={__("Edit")}></i>
                <Dialog
                    title={__("Edit info for ") + this.props.nodeName}
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

var NodeInfoButton = React.createClass({
    mixins: [mixins.materialMixin],
    getInitialState: function() {
        return {}
    },
    showInfo: function(){
        window.open( "/single.html?_id="+this.props.nodeId);
    },
    render: function(){
        if(this.props.state == "Good") {// green, signifies the node is in good condition
            return (
                <span>
                    <i className="fa fa-signal infoBtn fa-bg active" onClick={this.showInfo} title={__("Info")}></i>
                </span>
            );
        }else{
            return (
                <span>
                    <i className="fa fa-signal infoBtn fa-bg" onClick={this.showInfo} title={__("Info")}></i>
                </span>
            );
        }
    }
});

var NodeAlarmButton = React.createClass({
    getInitialState: function() {
        return {alarms: ''};
    },
    getAlarms: function() {
        var that = this;
        $.ajax({
            type: 'GET',
            url: 'node/' + this.props.nodeId + '/alarms',
            success: function(data) {
                var alarms = [];
                data.map(function(alarm) {
                    alarms.push((new Date(alarm.timestamp)).toString() + ' ' + alarm.message);
                });
                that.setState({alarms: alarms.join('\n')});
            },
            error: function(xhr, status, error) {
                if(xhr.status === 401) {
                    location.assign('/login.html');
                }
                console.log('Error fetching alarms', xhr, status, error);
            }
        })
    },
    showInfo: function() {
        this.refs.alarmDialog.show();
    },
    render: function() {
        return (
            <span>
                <i className="fa fa-bell fa-bg" onClick={this.showInfo}
                   title={__("Alarms")}></i>
                <Dialog
                    title={__("Alarms")}
                    actions={[{text: __('Dismiss')}]}
                    onShow={this.getAlarms}
                    ref="alarmDialog">
                    <TextField value={this.state.alarms} style={{width: '90%'}}
                               multiLine={true} />
                </Dialog>
            </span>)
    }
});

var NodeApp = React.createClass({
    mixins: [mixins.materialMixin, mixins.configMixin],
    render: function(){
        return (
            <AppCanvas>
                <NavigationBar title={__("Nodes")} />
                <SearchableList
                    type="node"
                    listClass={NodeList}
                    hintText={__("Find by name, IP or tag")}
                    additionalButton="batchTags"
                    additionalFilter="project region idc"
                />
            </AppCanvas>
        )
    }
});

React.render(
    <NodeApp />,
    document.getElementById('content')
);