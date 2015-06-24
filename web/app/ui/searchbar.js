var React = require('react');
var mui = require('material-ui');
var bootstrap = require('react-bootstrap');

var mixins = require('../mixins.js');

// Includes an input field and a "Find" button
//     +---------------------------------+ +-------+      
//     | {hint text}                     | | Find  |      
//     +---------------------------------+ +-------+      
// and a pager
//     +-+-+ +---+ +---+ +---+ +-+-+
//     | < | | 1 | | 2 | | 3 | | > |
//     +-+-+ +---+ +---+ +---+ +-+-+


// props:
//   onNewKeywords: callback func, called when button is pressed
//   hintText: string, the "hint text" part above

var SearchBar = React.createClass({
    mixins: [mixins.materialMixin],
    handleSearch: function(event){
        event.preventDefault();
        var keywords = this.refs.keywords.getValue().trim();
        this.props.onNewKeywords(keywords)
    },
    handlePageSelect: function(event, selectedEvent) {
        console.log('event ', event);
        console.log('selectedEvent ', selectedEvent);
        this.props.onNewKeywords(undefined, selectedEvent.eventKey)
    },
    render: function(){
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
                    <mui.TextField hintText={this.props.hintText} ref="keywords" />
                    <mui.RaisedButton label="Find" />
                </form>
                <bootstrap.Pagination
                    bsSize='small'
                    items={this.props.totalPages}
                    activePage={this.props.activePage}
                    onSelect={this.handlePageSelect}
                    style={
                        {
                            float: 'right',
                            marginRight: '50px',
                            marginTop: '10px'
                        }
                    }
                />
            </div>
        )
    }
});

module.exports = SearchBar;