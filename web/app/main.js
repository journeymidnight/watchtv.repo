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
var get_value = function (ret) {
    return _.flatten(ret.results[0].series[0].values);
};

var GraphSelector = React.createClass({
    getInitialState: function(){
        // measurements: { cpu: { device : ['cpu0' ...],
        //                        measure: ['idle' ...]
        //                      },
        //                 memory: { ... },
        //               }
        var measurements = {};
        $.ajax({
            url: influxdb_url + '/query?' + $.param(
                q_param('SHOW MEASUREMENTS')),
            dataType: 'json',
            success: function(data){
                var measure_list = get_value(data);
                measure_list.map(function(m) {
                    var tags = {};
                    $.ajax({
                        url: influxdb_url + '/query?' + $.param(
                            q_param('SHOW TAG KEYS FROM ' + m)),
                        dataType: 'json',
                        success: function (data) {
                            var key_list = get_value(data);
                            key_list.map(function(k){
                                if(k == 'host') return;
                                $.ajax({
                                    url: influxdb_url + '/query?' + $.param(
                                        q_param('SHOW TAG VALUES FROM ' + m + ' WITH KEY="' +
                                        k + '"')
                                    ),
                                    dataType: 'json',
                                    success: function (data) {
                                        tags[k] = get_value(data)
                                    }
                                })
                            });
                        }
                    });
                    measurements[m] = tags;
                });
                console.log(measurements);
                this.setState({measurements: measurements})
            }.bind(this),
            error: function(xhr, status, err){
                console.error('Init measurements structure ', status, err.toString())
            }.bind(this)
        });
        return {measurements: null}
    },
    changeHandler: function() {
        var that = this;
        ['selectedMeasurement', 'selectedDevice', 'selectedMeasure'].map(function (name) {
            if(that.refs[name]) {
                that.props.onSelect(name, React.findDOMNode(that.refs[name]).value);
            } else {
                that.props.onSelect(name, null)
            }
        })
    },
    handleGraph: function(){
        this.changeHandler();
        this.props.onGraph();
    },
    render: function(){
        var measurementOptions = [];
        var ans = [];
        if(this.state.measurements) {
            Object.keys(this.state.measurements).map(function (m) {
                measurementOptions.push(<option value={m}>{m}</option>)
            });
            ans.push(
                <select onChange={this.changeHandler} ref="selectedMeasurement">
                    <optgroup label="Measurements">
                        {measurementOptions}
                    </optgroup>
                </select>
            )
        }
        if(this.props.selected.selectedMeasurement){
            var device = this.state.measurements[this.props.selected.selectedMeasurement].device;
            if(device) {
                var deviceOptions = [];
                device.map(function (d) {
                    deviceOptions.push(<option value={d}>{d}</option>)
                });
                ans.push(
                    <select onChange={this.changeHandler} ref='selectedDevice'>
                        <optgroup label="Devices">
                            {deviceOptions}
                        </optgroup>
                    </select>
                )
            }

            var measureOptions = [];
            this.state.measurements[this.props.selected.selectedMeasurement].measure.map(function(m){
                measureOptions.push(<option value={m}>{m}</option>)
            });
            ans.push(
                <select onChange={this.changeHandler} ref='selectedMeasure'>
                    <optgroup label="Measures">
                        {measureOptions}
                    </optgroup>
                </select>
            )
        }
        return (
            <div>
                {ans}
                <input type="submit" value="Graph" onClick={this.handleGraph} />
            </div>
        )
    },
});


var NodeGraph = React.createClass({
    getInitialState: function(){
        return {
            data: [],
            node: null,
            selected: {}
        }
    },
    componentWillReceiveProps: function(nextProps){
        var id = nextProps.node_id;
        if(id){
            $.ajax({
                url: 'node/' + id,
                dataType: 'json',
                success: function(data){
                    this.setState({node: data});
                }.bind(this),
                error: function(xhr, status, err){
                    console.error("Fetching node info", status, err.toString())
                }
            })
        }
    },
    handleSelect: function(name, value){
        var selected = this.state.selected;
        selected[name] = value;
        this.setState({selected: selected})
    },
    handleGraph: function(){
        var now = new Date();
        var aDayAgo = new Date(now.getTime() - 60*60*24*1000);
        var query = 'SELECT MEAN(value) FROM ' + this.state.selected.selectedMeasurement +
            " WHERE host='influx2' AND measure='" + this.state.selected.selectedMeasure+ "'" +
            " AND time > '" + aDayAgo.toISOString() + "' AND time < '" +
            now.toISOString() + "' ";
        if(this.state.selected.selectedDevice) {
            query += " AND device='" + this.state.selected.selectedDevice + "'";
        }
        query += ' GROUP BY time(300s) ';
        console.log(query)
        $.ajax({
            url: influxdb_url + '/query?' + $.param(q_param(query)),
            dataType: 'json',
            success: function (data) {
                console.log(get_value(data));
                this.setState({data: get_value(data)})
            }.bind(this)
        })
    },
    render: function(){
        if(this.props.node_id) {
            return (
                <div>
                    <GraphSelector onSelect={this.handleSelect} selected={this.state.selected}
                        onGraph={this.handleGraph} />
                    <div id="graph" style={{width: '500px', height: '300px'}}></div>
                </div>
            )
        } else {
            return null
        }
    },
    componentDidUpdate: function(prevProps, prevState) {
        if (this.props.node_id) {
            fitted_data = [];
            data = this.state.data;
            for (var i = 0; i < data.length; i+=2){
                d = [Date.parse(data[i]) , data[i+1]];
                fitted_data.push(d)
            }
            console.log(fitted_data);
            $.plot('#graph',[fitted_data], {
                xaxis: {mode: "time"}
            });
        }
    }
});

React.render(
    <SearchableNodeList url="nodes" />,
    document.getElementById('content')
);