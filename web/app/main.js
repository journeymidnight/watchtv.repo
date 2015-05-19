var SearchableNodeList = React.createClass({
    componentDidMount: function(){
        $.ajax({
            url: this.props.url,
            dataType: 'json',
            success: function(data) {
                this.setState({node_list:data})
            }.bind(this),
            error: function(xhr, status, err){
                console.error(this.props.url, status, err.toString())
            }.bind(this)
        })
    },
    getInitialState: function () {
        return {node_list: [],
                keywords: ""}
    },
    handleKeyword: function(keyword){
        this.setState({keywords:keyword})
    },
    render: function(){
        return (
            <div>
                <SearchBar onNewKeywords={this.handleKeyword} />
                <NodeList node_list={this.state.node_list} keywords={this.state.keywords} />
            </div>
        )
    }
})

var SearchBar = React.createClass({
    handleSearch: function(event){
        event.preventDefault()
        var keywords = React.findDOMNode(this.refs.keywords).value.trim()
        this.props.onNewKeywords(keywords)
    },
    render: function(){
        return (
            <form className="searchForm" onSubmit={this.handleSearch} >
                <input type="text" placeholder="Find anything..." ref="keywords" />
                <input type="submit" value="Find" />
            </form>
        )
    }
})


var NodeList = React.createClass({
    render: function() {
        var key = this.props.keywords
        var nodeList = this.props.node_list.map(function(node, index){
            if (node.name.toLowerCase().indexOf(key) == -1 &&
                node.ip.indexOf(key) == -1 &&
                node.tags.map(function(t, index) {
                    return t['name']
                }).join(" ").toLowerCase().indexOf(key) == -1)
            {
                return;
            }
            var tags = node.tags.map(function(tag, index){
                return(
                    <span>tag['name']</span>
                )
            })
            return(
                <NodeEntry name={node.name} ip={node.ip} tags={node.tags} key={index} />
            )
        })
        return (
            <table>
                <tr>
                    <th>Name</th>
                    <th>IP Address</th>
                    <th>Tags</th>
                    <th>Status</th>
                </tr>
                {nodeList}
            </table>
        )
    }
})


var NodeEntry = React.createClass({
    render: function(){
        return (
            <tr>
                <td>{this.props.name}</td>
                <td>{this.props.ip}</td>
                <td>{this.props.tags}</td>
                <td>Good</td>
            </tr>
        )
    }
})

React.render(
    <SearchableNodeList url="nodes" />,
    document.getElementById('content')
)