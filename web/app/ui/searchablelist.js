var React = require('react');

var SearchBar = require('./searchbar.js');


// The integration place for SearchBar and a table class
// currently: TagList, NodeList, UserList

// props:
// type: string, used to form query url, currently "node", "tag" or "user"
// listClass: react class, currently "NodeList", "TagList", "UserList"
// hintText: string, text to show as a placeholder in search input box


var SearchableList = React.createClass({
    componentDidMount: function(){
        var itemsPerPage = this.props.config.itemsPerPage;
        $.ajax({
            url: this.props.type + 's?' + $.param({limit: itemsPerPage}),
            dataType: 'json',
            success: function(data) {
                this.setState({
                    data:data.result,
                    totalPages: Math.ceil(data.total / itemsPerPage)
                });
            }.bind(this),
            error: function(xhr, status, err){
                console.error(this.props.url, status, err.toString());
            }.bind(this)
        });
    },
    getInitialState: function () {
        return {
            data: [],
            totalPages: 1,
            activePage: 1,
            keyword: {
                keywords: ''
            }
        };
    },
    handleKeyword: function(keyword, pageNumber){
        var itemsPerPage = this.props.config.itemsPerPage;
        if(keyword == undefined) {
            keyword = this.state.keyword;
        }
        if(!pageNumber) {
            pageNumber = 1;
        }
        var that = this;
        var urlParameter = {
            skip: itemsPerPage * (pageNumber - 1),
            limit: itemsPerPage
        };
        for (var k in keyword) {
            if (k === 'keywords') {
                urlParameter[this.props.type] = keyword[k];
                continue;
            }
            urlParameter[k] = keyword[k];
        }
        $.ajax({
            url: 'q?' + $.param(urlParameter),
            dataType: 'json',
            success: function(data){
                that.setState({
                    data: data.result,
                    keyword: keyword,
                    totalPages: Math.ceil(data.total / itemsPerPage),
                    activePage: pageNumber
                });
            },
            error: function(xhr, status, err) {
                if (xhr.status === 401) {
                    location.assign('/login.html');
                }
            }
        });
    },
    render: function(){
        return (
            <div>
                <SearchBar onNewKeywords={this.handleKeyword} hintText={this.props.hintText}
                    totalPages={this.state.totalPages} activePage={this.state.activePage}
                    additionalFilter={this.props.additionalFilter}
                />
                <this.props.listClass data={this.state.data} onRefresh={this.handleKeyword}
                    config={this.props.config}
                />
            </div>
        )
    }
});


module.exports = SearchableList;