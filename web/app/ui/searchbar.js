var React = require('react');
var mui = require('material-ui');
var bootstrap = require('react-bootstrap');

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
    handleSearch: function(event){
        event.preventDefault();
        var filter = {},
            that = this;
        this.props.additionalFilter.split(' ').map(function(dropdownName){
            filter[dropdownName] = that.state[dropdownName + 'Selected'];
        });
        filter['keywords'] = this.refs.keywords.getValue().trim();
        this.props.onNewKeywords(keywords);
    },
    handlePageSelect: function(event, selectedEvent) {
        console.log('event ', event);
        console.log('selectedEvent ', selectedEvent);
        this.props.onNewKeywords(undefined, selectedEvent.eventKey);
    },
    getInitialState: function() {
        var state = {},
            that = this;
        this.props.additionalFilter.split(' ').map(function (dropdownName) {
            if (dropdownName === '') return;

            state[dropdownName] = [];
            state[dropdownName + 'Selected'] = '';  // Selected value for dropdown
            // dropdown change handler functions
            that[dropdownName + 'Handler'] = function(err, selectedIndex, menuItem) {
                var newState = {};
                newState[dropdownName + 'Selected'] = menuItem.payload;
                that.setState(newState);
            };
        });
        return state;
    },
    componentDidMount: function() {
        var that = this;
        this.props.additionalFilter.split(' ').map(function(dropdownName){
            $.ajax({
                url: dropdownName + 's',
                dataType: 'json',
                success: function(data) {
                    var state = {};
                    state[dropdownName] = data.result;
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

        searchComponents.push(<mui.TextField hintText={this.props.hintText} ref="keywords" />);
        searchComponents.push(<mui.RaisedButton label="Find" />);
        this.props.additionalFilter.split(' ').map(function (dropdownName) {
            if (dropdownName === '') return;

            var menuItems = [{payload: '', text: displayName[dropdownName] + ': All'}];
            that.state[dropdownName].map(function (entry) {
                menuItems.push({payload: entry.name, text: entry.name});
            });
            searchComponents.push(<mui.DropDownMenu menuItems={menuItems}
                                    onChange={that[dropdownName + 'Handler']} />);
        });

        return (
            <div>
                <form
                    className="searchForm"
                    onSubmit={this.handleSearch}
                    style={
                        {
                            float: 'left',
                            marginLeft: '15px'
                        }
                    }>
                    {searchComponents}
                </form>
                <bootstrap.Pagination
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