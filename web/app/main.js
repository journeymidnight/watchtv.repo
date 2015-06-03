// stub for testing
var stub = undefined;

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
                keywords: "",
                pressed: null}
    },
    handleKeyword: function(keyword){
        this.setState({keywords:keyword})
    },
    handleNodeClick: function(node_id){
        this.setState({pressed:node_id});
    },
    render: function(){
        return (
            <div>
                <SearchBar onNewKeywords={this.handleKeyword} />
                <NodeList node_list={this.state.node_list} keywords={this.state.keywords}
                    onNodeClick={this.handleNodeClick} />
                <div>
                    <NodeGraph node_id={this.state.pressed} />
                </div>
            </div>
        )
    }
});

var SearchBar = React.createClass({
    handleSearch: function(event){
        event.preventDefault();
        var keywords = React.findDOMNode(this.refs.keywords).value.trim();
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
});


var NodeList = React.createClass({
    render: function() {
        var key = this.props.keywords;
        var onNodeClick = this.props.onNodeClick;
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
                    <span>{tag['name']}</span>
                )
            });
            return(
                <NodeEntry name={node.name} ip={node.ip} tags={tags} key={index}
                    id={node._id} onEntryClick={onNodeClick} />
            )
        });
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
});


var NodeEntry = React.createClass({
    handleClick: function(){
        this.props.onEntryClick(this.props.id)
    },
    render: function(){
        return (
            <tr onClick={this.handleClick}>
                <td>{this.props.name}</td>
                <td>{this.props.ip}</td>
                <td>{this.props.tags}</td>
                <td>Good</td>
            </tr>
        )
    }
});

var influxdb_url = 'http://192.169.0.39:8086';
var q_param = function(q){
    return {
        u: 'root',
        p: 'root',
        db: 'rebase',
        q: q
    }
};

var NodeGraph = React.createClass({
    getInitialState: function(){
        $.ajax({
            url: influxdb_url + '/query?' + $.param(
                q_param('SHOW MEASUREMENTS')),
            dataType: 'json',
            success: function(data){
                var measure_list = _.flatten(data.results[0].series[0].values);
                var measurements = {};
                measure_list.map(function(m){
                    measurements[m] = [];
                });
                this.setState({measurements: measurements});
                stub = this.state
            }.bind(this),
            error: function(xhr, status, err){
                console.error('SHOW MEASUREMENTS', status, err.toString())
            }.bind(this)
        });
        return {
            data: [],
            node: null,
            measurements: []
        }
    },
    componentWillReceiveProps: function(nextProps){
        var id = nextProps.node_id;
        if(id){
        $.ajax({
            url: 'node/' + id,
            dataType: 'json',
            success: function(data){
                this.setState({node:data});
                $.ajax({
                    url: influxdb_url + '/query?' + $.param(
                       q_param("select value from cpu where device='cpu0' and measure='user'")),
                    dataType: 'json',
                    success: function(data){
                        console.log(data)
                    }.bind(this),
                    error: function(xhr, status, err){
                        console.error('Fetching data', status, err.toString())
                    }
                })
            }.bind(this),
            error: function(xhr, status, err){
                console.error(id, status, err.toString())
            }.bind(this)
        })}
    },
    render: function(){
        return (
            <div id="graph" style={{width:'300px',height:'200px'}}></div>
        )
    },
    componentDidUpdate: function(prevProps, prevState) {
        $.plot('#graph', [{
            data: [[1,2], [2,5], [3,4], [4,6]],
            lines: {show:true, fill:true},
            points: {show:true},
        }]);
    }
});

React.render(
    <SearchableNodeList url="nodes" />,
    document.getElementById('content')
);