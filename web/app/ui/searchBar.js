var React = require('react');
var Pagination = require('react-bootstrap/lib/Pagination');
var TextField = require('material-ui/lib/text-field');
var RaisedButton = require('material-ui/lib/raised-button');
var DropDownMenu = require('material-ui/lib/drop-down-menu');
var Dialog = require('material-ui/lib/dialog');

var mixins = require('../mixins.js');
var dataMapper = require('../utility.js').dataMapper;

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
//   additionalButton: string, space separated names of buttons, currently only supports
//                      "batchTags"

var displayName = {
    region: __('Region'),
    idc: __('IDC'),
    project: __('Project')
};

var SearchBar = React.createClass({
    mixins: [mixins.materialMixin],
    getDefaultProps: function () {
        return {
            additionalButton: ''
        }
    },
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
    onKeydown: function(event) {
        if(event.which === 13) {
            event.preventDefault();
            this.handleSearch();
        }
    },
    bindEnterKeypress: function () {
        $(document).bind('keydown', this.onKeydown);
    },
    unbindEnterKeypress: function () {
        $(document).unbind('keydown', this.onKeydown);
    },
    showBatchTagsDialog: function () {
        this.refs.batchTagsDialog.show();
    },
    batchAddTags: function () {
        var that = this;
        var project = this.state.project,
            region = this.state.region,
            idc = this.state.idc;
        var keywords = this.refs.keywords.getValue().trim();
        var tagsInput = this.refs.tagsInput.getValue().trim();
        if(tagsInput === '') return;
        var tags = tagsInput.split(' ');

        $.ajax({
            url: '/node/tags',
            type: 'POST',
            data: {
                project: project,
                region: region,
                idc: idc,
                keywords: keywords,
                tags: tags
            },
            success: function (data) {
                that.props.onNewKeywords({
                    project: project,
                    region: region,
                    idc: idc,
                    keywords: keywords
                });
            },
            error: function (xhr, status, err) {
                console.error('Add new tags failed: ', err);
            }
        });
        this.refs.batchTagsDialog.dismiss();
    },
    bindEvents: function () {
        $('#tagBatchInput').autocomplete(createMultiAutocompleteObject('q?tag=',
            dataMapper.tag));
    },
    render: function(){
        var that = this,
            searchComponents = [];

        searchComponents.push(<TextField hintText={this.props.hintText} ref="keywords"
                               key="keywords" onFocus={this.bindEnterKeypress}
                               onBlur={this.unbindEnterKeypress}/>);
        searchComponents.push(<RaisedButton label={__("Find")}
                                            key="find"
                               onClick={this.handleSearch} />);
        this.props.additionalButton.split(' ').map(function (buttonName) {
            if(buttonName === '') return;

            if(buttonName === 'batchTags') {
                searchComponents.push(<RaisedButton label={<i className="fa fa-tags"></i>}
                                                    onClick={that.showBatchTagsDialog} />);
            }
        });
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
                    <i className="fa fa-times fa-cir" onClick={that[dropdownName + 'Reset']} title="Reset"></i>
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
                <Dialog title={__("Add tags to all filtered nodes")}
                        actions={[
                            {text: __('Cancel')},
                            {text: __('Add'), onClick: this.batchAddTags}
                        ]}
                        onShow={this.bindEvents}
                        ref="batchTagsDialog">
                    <TextField floatingLabelText={__('Tags to add')}
                               defaultValue=""
                               style={{width: '80%'}}
                               ref="tagsInput" id="tagBatchInput" />
                </Dialog>
            </div>
        )
    }
});

module.exports = SearchBar;