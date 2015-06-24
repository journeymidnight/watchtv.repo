var React = require('react');
var mui = require('material-ui');
var bootstrap = require('react-bootstrap');
var markdown = require('markdown').markdown;

var mixins = require('./mixins.js');
var SearchBar = require('./ui/searchbar.js');
var DeleteButton = require('./ui/deletebutton.js');
var NavigationBar = require('./ui/navigationbar.js');
var MetricGraph = require('./ui/metricgraph.js');

var itemsPerPage = 1;  // Make it configurable

var SearchableNodeList = React.createClass({
    componentDidMount: function(){
        $.ajax({
            url: 'nodes?' + $.param({limit: itemsPerPage}),
            dataType: 'json',
            success: function(data) {
                this.setState({
                    node_list:data.node,
                    totalPages: Math.ceil(data.total/itemsPerPage)
                })
            }.bind(this),
            error: function(xhr, status, err){
                console.error(this.props.url, status, err.toString())
            }.bind(this)
        })
    },
    getInitialState: function () {
        return {
            node_list: [],
            totalPages: 1,
            activePage: 1,
            keyword: ''
        }
    },
    handleKeyword: function(keyword, pageNumber){
        if(keyword == undefined) {
            keyword = this.state.keyword
        }
        if(!pageNumber) {
            pageNumber = 1;
        }
        var that = this;
        $.ajax({
            url: 'q?' + $.param({
                node: keyword,
                skip: itemsPerPage * (pageNumber - 1),
                limit: itemsPerPage
            }),
            dataType: 'json',
            success: function(data){
                that.setState({
                    node_list:data.node,
                    keyword: keyword,
                    totalPages: Math.ceil(data.total/itemsPerPage),
                    activePage: pageNumber
                });
            }
        });
    },
    render: function(){
        return (
            <div>
                <SearchBar onNewKeywords={this.handleKeyword} hintText="Find anything"
                    totalPages={this.state.totalPages} activePage={this.state.activePage}
                />
                <NodeList node_list={this.state.node_list} onRefresh={this.handleKeyword} />
            </div>
        )
    }
});

var NodeList = React.createClass({
    mixins: [mixins.materialMixin],
    getInitialState: function () {
        return {snackMsg: ''}
    },
    handleCreateNewNode: function() {
        var name = this.refs.newName.getValue().trim(),
            ips = this.refs.newIP.getValue().trim().split(/[\s,]+/),
            tags = this.refs.newTag.getValue().trim().split(/[\s,]+/);
        $.ajax({
            type: "POST",
            url: "nodes",
            data: {
                "name": name,
                "ips": ips,
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
    render: function() {
        var that = this;
        var nodeList = this.props.node_list.map(function(node){
            return(
                <NodeEntry name={node.name} ips={node.ips} tags={node.tags} key={node._id}
                    id={node._id} description={node.description}
                    onRefresh={that.props.onRefresh} />
            )
        });
        var addNewNodeRow =
            <tr>
                <td><mui.TextField ref="newName" /></td>
                <td><mui.TextField ref="newIP" /></td>
                <td><mui.TextField ref="newTag" /></td>
                <td><mui.FlatButton label="Add" onClick={this.handleCreateNewNode} /></td>
            </tr>;
        return (
            <div>
            <bootstrap.Table striped bordered hover condensed>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>IP Addresses</th>
                        <th>Tags</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {nodeList}
                </tbody>
                <tfoot>
                    {addNewNodeRow}
                </tfoot>
            </bootstrap.Table>
                <mui.Snackbar ref="snackbar" message={this.state.snackMsg} />
            </div>
        )
    }
});


var NodeEntry = React.createClass({
    render: function(){
        var that = this;
        var tags = this.props.tags.map(function(tag, index){
            return(
                <bootstrap.Badge key={that.props.id+'tag'+tag['name']}>
                    {tag['name']}
                </bootstrap.Badge>
            )
        });
        return (
            <tr>
                <td key={this.props.id + 'name'}>{this.props.name}</td>
                <td key={this.props.id + 'ip'}>{this.props.ips.join('  ')}</td>
                <td key={this.props.id + 'tags'}>{tags}</td>
                <td key={this.props.id + 'actions'}>
                    <NodeEditButton nodeId={this.props.id} nodeName={this.props.name}
                        nodeIps={this.props.ips} nodeTags={this.props.tags}
                        onRefresh={this.props.onRefresh}
                        nodeDescription={this.props.description}
                    />
                    <NodeInfoButton nodeId={this.props.id} nodeName={this.props.name}
                        nodeIps={this.props.ips} description={this.props.description} />
                    <DeleteButton id={this.props.id} onRefresh={this.props.onRefresh}
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
            {text: 'Update', onClick: this.updateNode}
        ];
        console.log(this.props.nodeTags);
        var tags = this.props.nodeTags.map(function(t){
            return t.name;
        });
        var edits = <div>
            <mui.TextField floatingLabelText="Name" defaultValue={this.props.nodeName}
                ref="nameInput" />
            <mui.TextField floatingLabelText="IP Address"
                defaultValue={this.props.nodeIps.join("  ")}
                ref="ipInput" />
            <mui.TextField floatingLabelText="Tags" defaultValue={tags.join(" ")}
                ref="tagInput" multiLine={true} />
                <div>
                    <mui.TextField floatingLabelText="Description"
                        defaultValue={this.props.nodeDescription}
                        ref="descriptionInput" multiLine={true}
                    />
                </div>
            </div>;
        return (
            <span>
            <mui.FlatButton label="Edit" onClick={this.handleClick} />
            <mui.Dialog
                title={"Edit info for " + this.props.nodeName}
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

var NodeInfoButton = React.createClass({
    mixins: [mixins.materialMixin],
    getInitialState: function() {
        return {
            renderGraph: false  // don't render the graph at startup
        }
    },
    showInfo: function(){
        this.setState({renderGraph: true});
        this.refs.infoDialog.show();
    },
    createMarkdown: function(){
        return {
            __html: markdown.toHTML(this.props.description)
        }
    },
    render: function(){
        var title = this.props.nodeName + '(' + this.props.nodeIps.join(', ') + ')';
        var infoAction = [
            {text: 'Close'}
        ];
        return (
            <span>
                <mui.FlatButton label="Info" onClick={this.showInfo} />
                <mui.Dialog
                    title={title}
                    actions={infoAction}
                    modal={true}
                    ref="infoDialog">
                    <div>
                        <bootstrap.Panel collapsible={this.props.description == ''}>
                            <div dangerouslySetInnerHTML={this.createMarkdown()} />
                        </bootstrap.Panel>
                        <MetricGraph node_id={this.props.nodeId} node_ips={this.props.nodeIps}
                            render={this.state.renderGraph} />
                    </div>
                </mui.Dialog>
            </span>
        )
    }
});

var NodeApp = React.createClass({
    mixins: [mixins.materialMixin],
    render: function(){
        return (
            <mui.AppCanvas>
                <NavigationBar title="Nodes" />
                <SearchableNodeList />
            </mui.AppCanvas>
        )
    }
});

React.render(
    <NodeApp />,
    document.getElementById('content')
);