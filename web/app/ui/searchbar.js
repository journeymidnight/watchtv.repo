var React = require('react');
var mui = require('material-ui');

var mixins = require('../mixins.js');

// Includes an input field and a "Find" button
//     +---------------------------------+ +-------+      
//     | {hint text}                     | | Find  |      
//     +---------------------------------+ +-------+      

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
    render: function(){
        return (
            <form className="searchForm" onSubmit={this.handleSearch} >
                <mui.TextField hintText={this.props.hintText} ref="keywords" />
                <mui.RaisedButton label="Find" />
            </form>
        )
    }
});

module.exports = SearchBar;