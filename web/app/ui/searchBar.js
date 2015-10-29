var React = require('react');
var Pagination = require('react-bootstrap/lib/Pagination');
var TextField = require('material-ui/lib/text-field');
var RaisedButton = require('material-ui/lib/raised-button');
var DropDownMenu = require('material-ui/lib/drop-down-menu');
var IconButton = require('material-ui/lib/icon-button');
var SvgIcon = require('material-ui/lib/svg-icon');

var mixins = require('../mixins.js');

// Includes an input field and a "Find" button
//     +---------------------------------+ +-------+      
//     | {hint text}                     | | Find  |      
//     +---------------------------------+ +-------+      
// and a pager
//     +---+ +---+ +---+ +---+ +---+
//     | < | | 1 | | 2 | | 3 | | > |
//     +---+ +---+ +---+ +---+ +---+
// and optionally some dropdown menus to filter region, idc and project, like
//     +----------------+
//     | Region: All  \/|
//     +----------------+


// props:
//   onNewKeywords: callback func, called when button is pressed
//   hintText: string, the "hint text" part above
//   totalPages: number, total number of pages
//   activePage: number, start from 1 to totalPages, currently selected page
//   additionalFilter: string, space separated names of filters, possible values are
//                     "region", "idc" and "project"; set to '' if not needed

var displayName = {
    region: 'Region',
    idc: 'IDC',
    project: 'Project'
};

var SearchBar = React.createClass({
    mixins: [mixins.materialMixin],
    raiseStates: function() {
        var filter = {},
            that = this;
        this.props.additionalFilter.split(' ').map(function(dropdownName){
            if (dropdownName === '') return;

            filter[dropdownName] = that.state[dropdownName];
        });
        filter.keywords = this.refs.keywords.getValue().trim();
        this.props.onNewKeywords(filter);
    },
    handleSearch: function(){
        this.raiseStates();
    },
    handlePageSelect: function(event, selectedEvent) {
        this.props.onNewKeywords(undefined, selectedEvent.eventKey);
    },
    updateMenuItems: function () {
        var that = this;
        this.props.additionalFilter.split(' ').map(function(dropdownName){
            if(dropdownName === '' || dropdownName === 'project') {
                return;
            }
            var query = {};
            if(that.state.project) query.project = that.state.project;
            if(that.state.region) query.region = that.state.region;
            if(that.state.idc) query.idc = that.state.idc;
            $.ajax({
                url: dropdownName + 's?' + $.param(query),
                dataType: 'json',
                success: function(data) {
                    var state = {};
                    state[dropdownName +'s'] = data;
                    that.setState(state);
                },
                error: function(xhr, status, err) {
                    if (xhr.status === 401) {
                        location.assign('/login.html');
                    }
                    console.error('Cannot fetch /' + dropdownName + 's');
                }
            });
        });
    },
    getInitialState: function() {
        var state = {},
            that = this;
        var doUpdates = function() {
            that.updateMenuItems();
            that.raiseStates();
        };
        this.props.additionalFilter.split(' ').map(function (dropdownName) {
            if (dropdownName === '') return;

            state[dropdownName + 's'] = []; // All items in dropdown
            state[dropdownName] = '';       // Selected value for dropdown
            // dropdown change handler functions
            that[dropdownName + 'Handler'] = function(err, selectedIndex, menuItem) {
                var newState = {};
                newState[dropdownName] = menuItem.payload;
                if(dropdownName === 'project') {
                    newState['idc'] = '';
                    newState['region'] = '';
                }
                that.setState(newState, doUpdates);
            };
            that[dropdownName + 'Reset'] = function() {
                var newState = {};
                newState[dropdownName] = '';
                that.setState(newState, doUpdates);
            };
        });
        return state;
    },
    componentDidMount: function() {
        var that = this;
        this.props.additionalFilter.split(' ').map(function(dropdownName){
            if (dropdownName === '') return;

            if (dropdownName === 'project') {
                $.ajax({
                    url: '/projects',
                    dataType: 'json',
                    success: function(data) {
                        that.setState({projects: data.result});
                    },
                    error: function(xhr, status, err) {
                        console.error('Cannot fetch /' + dropdownName + 's');
                    }
                });
                return;
            }

            $.ajax({
                url: dropdownName + 's',
                dataType: 'json',
                success: function(data) {
                    var state = {};
                    state[dropdownName +'s'] = data;
                    that.setState(state);
                },
                error: function(xhr, status, err) {
                    console.error('Cannot fetch /' + dropdownName + 's');
                }
            });
        });
    },
    render: function(){
        var that = this,
            searchComponents = [];

        searchComponents.push(<TextField hintText={this.props.hintText} ref="keywords"
                               key="keywords" />);
        searchComponents.push(<RaisedButton label="Find" key="find"
                               onClick={this.handleSearch} />);
        this.props.additionalFilter.split(' ').map(function (dropdownName) {
            if (dropdownName === '') return;

            var menuItems = [{payload: '', text: displayName[dropdownName] + ': All'}],
                selectedIndex = 0;
            that.state[dropdownName + 's'].map(function (entry, index) {
                menuItems.push({payload: entry.name, text: entry.name});
                if(entry.name === that.state[dropdownName]) {
                    selectedIndex = index + 1; // for 0 is the "All"
                }
            });
            searchComponents.push(<DropDownMenu menuItems={menuItems}
                                    onChange={that[dropdownName + 'Handler']}
                                    selectedIndex={selectedIndex}
                                    key={dropdownName + 'DropDown'} />);
            if (selectedIndex !== 0) {
                searchComponents.push(
                    <IconButton tooltip="Reset" onClick={that[dropdownName + 'Reset']}>
                        <SvgIcon hoverColor="#e53935">
                            <svg fill="#444444" height="20" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
                                <path d="M0 0h24v24H0z" fill="none"/>
                            </svg>
                        </SvgIcon>
                    </IconButton>
                )
            }
        });

        return (
            <div>
                <form
                    className="searchForm"
                    style={
                        {
                            float: 'left',
                            marginLeft: '15px'
                        }
                    }>
                    {searchComponents}
                </form>
                <Pagination
                    first={true}
                    last={true}
                    maxButtons={this.props.totalPages > 10 ? 10: this.props.totalPages}
                    bsSize='medium'
                    items={this.props.totalPages}
                    activePage={this.props.activePage}
                    onSelect={this.handlePageSelect}
                    style={
                        {
                            float: 'right',
                            marginRight: '50px',
                            marginTop: '15px'
                        }
                    }
                />
            </div>
        )
    }
});

module.exports = SearchBar;