var React = require('react');

var SearchBar = require('./searchbar.js');


// The integration place for SearchBar and a table class(currently TagList or NodeList)

// props:
// type: string, used to form query url, currently "node" or "tag"
// listClass: react class, currently "NodeList" or "TagList"
// hintText: string, text to show as a placeholder in search input box


var itemsPerPage = 10;  // TODO: Make it configurable

var SearchableList = React.createClass({
    componentDidMount: function(){
        $.ajax({
            url: this.props.type + 's?' + $.param({limit: itemsPerPage}),
            dataType: 'json',
            success: function(data) {
                this.setState({
                    data:data.result,
                    totalPages: Math.ceil(data.total/itemsPerPage)
                })
            }.bind(this),
            error: function(xhr, status, err){
                console.error(this.props.url, status, err.toString())
            }.bind(this)
        })
    },
    getInitialState: function () {
        return {
            data: [],
            totalPages: 1,
            activePage: 1,
            keyword: ''
        }
    },
    handleKeyword: function(keyword, pageNumber){
        if(keyword == undefined) {
            keyword = this.state.keyword
        }
        if(!pageNumber) {
            pageNumber = 1;
        }
        var that = this;
        var urlParameter = {
            skip: itemsPerPage * (pageNumber - 1),
            limit: itemsPerPage
        };
        urlParameter[this.props.type] = keyword;
        $.ajax({
            url: 'q?' + $.param(urlParameter),
            dataType: 'json',
            success: function(data){
                that.setState({
                    data:data.result,
                    keyword: keyword,
                    totalPages: Math.ceil(data.total/itemsPerPage),
                    activePage: pageNumber
                });
            }
        });
    },
    render: function(){
        return (
            <div>
                <SearchBar onNewKeywords={this.handleKeyword} hintText={this.props.hintText}
                    totalPages={this.state.totalPages} activePage={this.state.activePage}
                />
                <this.props.listClass data={this.state.data} onRefresh={this.handleKeyword} />
            </div>
        )
    }
});


module.exports = SearchableList;