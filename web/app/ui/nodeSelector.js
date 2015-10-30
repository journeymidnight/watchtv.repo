var React = require('react');
var TextField = require('material-ui/lib/text-field');
var IconButton = require('material-ui/lib/icon-button');
var SvgIcon = require('material-ui/lib/svg-icon');
var List = require('material-ui/lib/lists/list');
var ListItem = require('material-ui/lib/lists/list-item');

// A node IP selector includes a search input, a button and a list to show current IPs
//   +---------------+ +---+
//   |Type to search | | + |
//   +---------------+ +---+
//   +---------------------+
//   | +-----------------+ |
//   | | 1.2.3.4      x  | |
//   | +-----------------+ |
//   | +-----------------+ |
//   | | 2.3.4.5      x  | |
//   | +-----------------+ |
//   +---------------------+

// props:
// onChange: callback function(ips). Return current selected IPs.
// initialIPs: array of string. Could be null.

// Use `getIPs()` to get current IPs inside the list

// This component uses jQuery.autocomplete, so remember to include both the jquery-ui
// js and css files

var NodeSelector = React.createClass({
    getInitialState: function() {
        var ips = [];
        if(this.props.initialIPs) ips = this.props.initialIPs;
        return {
            ips: ips
        };
    },
    componentDidMount: function() {
        $('#nodeInput').autocomplete({
            source: function(req, res) {
                var input = req.term;
                if(input.length < 2) {
                    res([]);
                    return;
                }
                $.ajax({
                    url: 'q?node=' + input + '&limit=5',
                    dataType: 'json',
                    success: function(data) {
                        var source = [];
                        data.result.map(function(node) {
                            node.ips.map(function(ip){
                                source.push({
                                    value: ip,
                                    label: ip + '(' + node.name + ':' + node.project.name + '-' +
                                        node.region.name + node.idc.name + ')'
                                });
                            });
                        });
                        res(source);
                    },
                    error: function() {
                        res([]);
                    }
                });
            }
        });
    },
    handleAddingNode: function() {
        var ip = this.refs.nodeInput.getValue(),
            listItems = this.state.ips;
        if(listItems.indexOf(ip) === -1) {
            listItems.push(ip);
        }
        this.setState({ips: listItems});
        if(this.props.onChange) this.props.onChange(listItems);
    },
    handleDelete: function(ip) {
        var listItems = this.state.ips.filter(function(i){
            return i !== ip;
        });
        this.setState({ips: listItems});
        if(this.props.onChange) this.props.onChange(listItems);
    },
    deleteButtonMaker: function(ip) {
            return <IconButton tooltip="Delete" onClick={this.handleDelete.bind(null, ip)}>
                <SvgIcon hoverColor="#e53935">
                    <svg fill="#444444" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
                        <path d="M0 0h24v24H0z" fill="none"/>
                    </svg>
                </SvgIcon>
            </IconButton>;
    },
    getIPs: function() {
        // return current IPs to outside world
        return this.state.ips;
    },
    render: function () {
        var that = this;
        var ipItems = this.state.ips.map(function(ip) {
            return <ListItem primaryText={ip} rightIconButton={that.deleteButtonMaker(ip)}
                                 key={ip}
                   />
        });
        return (
            <div>
                <div>
                    <TextField ref='nodeInput' id='nodeInput' hintText='Type to search' />
                    <i className="fa fa-plus fa-bg fa-transform" onClick={this.handleAddingNode} title="Add"></i>
                </div>
                <div className="ipList">
                    <List>
                        {ipItems}
                    </List>
                </div>
            </div>
        )
    }
});

module.exports = NodeSelector;
