var React = require('react');
var _ = require('underscore');
var mui = require('material-ui');
var bootstrap = require('react-bootstrap');

var mixins = require('./mixins.js');

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
                pressed: null}
    },
    handleKeyword: function(keyword){
        console.log(keyword);
        if(keyword == undefined) {
            keyword = this.state.keyword
        }
        var that = this;
        $.ajax({
            url: 'q?' + $.param({node: keyword}),
            dataType: 'json',
            success: function(data){
                that.setState({
                    node_list:data,
                    keyword: keyword
                });
                console.log(data)
            }
        });
    },
    handleNodeClick: function(node_id){
        this.setState({pressed:node_id});
    },
    render: function(){
        return (
            <div>
                <SearchBar onNewKeywords={this.handleKeyword} />
                <NodeList node_list={this.state.node_list} onRefresh={this.handleKeyword} />
                <div>
                    <NodeGraph node_id={this.state.pressed} />
                </div>
            </div>
        )
    }
});

var SearchBar = React.createClass({
    mixins: [mixins.materialMixin],
    handleSearch: function(event){
        event.preventDefault();
        var keywords = this.refs.keywords.getValue().trim();
        this.props.onNewKeywords(keywords)
    },
    render: function(){
        return (
            <form className="searchForm" onSubmit={this.handleSearch} >
                <mui.TextField hintText="Find anything" ref="keywords" />
                <mui.RaisedButton label="Find" />
            </form>
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
            ip = this.refs.newIP.getValue().trim(),
            tag = this.refs.newTag.getValue().trim().split(/[\s,]+/);
        $.ajax({
            type: "POST",
            url: "nodes",
            data: {
                "name": name,
                "ip": ip,
                "tags": tag
            },
            success: function(data) {
                this.props.onRefresh()
            }.bind(this),
            error: function(xhr, status, err) {
                console.error(xhr, status, err.toString());
                this.setState({snackMsg: xhr.responseText});
                this.refs.snackbar.show()
            }.bind(this)
        })
    },
    dismissSnackbar: function(){
        this.refs.snackbar.dismiss()
    },
    render: function() {
        var that = this;
        var nodeList = this.props.node_list.map(function(node, index){
            var tags = node.tags.map(function(tag, index){
                return(
                    <bootstrap.Badge>{tag['name']}</bootstrap.Badge>
                )
            });
            return(
                <NodeEntry name={node.name} ip={node.ip} tags={tags} key={node._id}
                    id={node._id} onRefresh={that.props.onRefresh} />
            )
        });
        var tfoot =
            <tr>
                <td><mui.TextField ref="newName" /></td>
                <td><mui.TextField ref="newIP" /></td>
                <td><mui.TextField ref="newTag" /></td>
                <td><mui.FlatButton label="Add" onClick={this.handleCreateNewNode}/></td>
            </tr>;
        return (
            <div>
            <bootstrap.Table striped bordered hover condensed>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>IP Address</th>
                        <th>Tags</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {nodeList}
                </tbody>
                <tfoot>
                    {tfoot}
                </tfoot>
            </bootstrap.Table>
                <mui.Snackbar ref="snackbar" message={this.state.snackMsg} />
            </div>
        )
    }
});


var NodeEntry = React.createClass({
    render: function(){
        return (
            <tr>
                <td key={this.props.id + 'name'}>{this.props.name}</td>
                <td key={this.props.id + 'ip'}>{this.props.ip}</td>
                <td key={this.props.id + 'tags'}>{this.props.tags}</td>
                <td key={this.props.id + 'actions'}>
                    <NodeEditButton />
                    <NodeInfoButton nodeId={this.props.id} nodeName={this.props.name}
                        nodeIp={this.props.ip} />
                    <NodeDeleteButton nodeId={this.props.id} onRefresh={this.props.onRefresh}
                        nodeName={this.props.name} />
                </td>
            </tr>
        )
    }
});

var NodeEditButton = React.createClass({
    mixins: [mixins.materialMixin],
    render: function(){
        return <mui.FlatButton label="Edit" />
    }
});

var NodeInfoButton = React.createClass({
    mixins: [mixins.materialMixin],
    showInfo: function(){
        this.refs.infoDialog.show();
    },
    render: function(){
        var title = this.props.nodeName+'('+this.props.nodeIp+')';
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
                    <NodeGraph node_id={this.props.nodeId} />
                </div>
            </mui.Dialog>
            </span>
        )
    }
});

var NodeDeleteButton = React.createClass({
    mixins: [mixins.materialMixin],
    handleClick: function(event){
        this.refs.deleteConfirm.show();
    },
    deleteNode: function(){
        $.ajax({
            type:'DELETE',
            url: 'node/' + this.props.nodeId,
            success: function(data){
                this.props.onRefresh();
            }.bind(this),
            error: function(xhr, status, err) {
                console.log(status, xhr.responseText);
                var msgBar = <mui.Snackbar message={xhr.responseText} />;
                React.render(msgBar, this.refs.deleteConfirm)
            }.bind(this)
        })
    },
    render: function(){
        var deleteConfirm = [
            {text: 'Cancel'},
            {text: 'Confirm', onClick: this.deleteNode}
        ];
        var msg = 'Are you sure to delete node "' + this.props.nodeName + '"?';

        return (
            <span>
            <mui.FlatButton label="Delete" onClick={this.handleClick} />
            <mui.Dialog
                title="Delete Confirmation"
                actions={deleteConfirm}
                modal={true}
                ref="deleteConfirm"> {msg}
            </mui.Dialog>
            </span>
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
    mixins: [mixins.materialMixin],
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
                this.setState({measurements: measurements});
            }.bind(this),
            error: function(xhr, status, err){
                console.error('Init measurements structure ', status, err.toString())
            }.bind(this)
        });
        return {measurements: null}
    },
    componentWillReceiveProps: function(){
        if(!this.props.selected.selectedMeasurement && this.state.measurements){
            this.props.onSelect('selectedMeasurement',
                                Object.keys(this.state.measurements)[0])
        }
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
                <mui.FlatButton label="Graph" onClick={this.handleGraph} />
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
                    <div id={'graph'+this.props.node_id} style={{width: '650px', height: '300px',
                        backgroundColor: "#6EB5F0"}}></div>
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
            $.plot('#graph' + this.props.node_id,
                [fitted_data],
                {
                    xaxis: {
                        mode: "time",
                        color: "white",
                        font: {color: "white"}
                    },
                    yaxis: {
                        color: "white",
                        font: {color: "white"}
                    },
                    series: {
                        lines: {
                            show: true,
                            fill: true,
                            fillColor: "rgba(143, 198, 242, 0.7)"
                        }
                    },
                    grid: {
                        color: "transparent",
                        margin: 10
                    },
                    colors: ["white"]
                });
        }
    }
});

React.render(
    <SearchableNodeList url="nodes" />,
    document.getElementById('content')
);