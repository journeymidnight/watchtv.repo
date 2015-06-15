var React = require('react');
var mui = require('material-ui');

// A well known delete button like this:
//   +--------+      
//   | DELETE |      
//   +--------+ 
// when clicked, prompts a confirm dialog
// +-----------------------------------------------------------------------+
// | Delete confirmation                                                   |
// +-----------------------------------------------------------------------+
// |                                                                       |
// | Are you sure to delete {name}?                                        |
// |                                                                       |
// |                                                                       |
// |                                            +--------+    +---------+  |
// |                                            | Cancel |    | Confirm |  |
// |                                            +--------+    +---------+  |
// +-----------------------------------------------------------------------+

// props:
//   name: string, the "name" part above
//   id: any type that could be converted into mongoDB ObjectId, the item id to delete
//   url: string, url base of the delete API
//        e.g. DELETE /node/<id> then url="node"
//   onRefresh: callback func, after a successful deletion, the function will be called


var DeleteButton = React.createClass({
    handleClick: function(event){
        this.refs.deleteConfirm.show();
    },
    getInitialState: function(){
        return {snackMsg: ''}
    },
    deleteItem: function(){
        $.ajax({
            type:'DELETE',
            url: this.props.url + '/' + this.props.id,
            success: function(_){
                this.props.onRefresh();
            }.bind(this),
            error: function(xhr, status, err) {
                this.setState({snackMsg: xhr.responseText});
                this.refs.snackbar.show()
            }.bind(this)
        })
    },
    render: function(){
        var deleteConfirm = [
            {text: 'Cancel'},
            {text: 'Confirm', onClick: this.deleteItem}
        ];
        var msg = 'Are you sure to delete "' + this.props.name + '"?';
        return (
            <span>
                <mui.FlatButton label="Delete" onClick={this.handleClick} />
                <mui.Dialog
                    title="Delete Confirmation"
                    actions={deleteConfirm}
                    modal={true}
                    ref="deleteConfirm"> {msg}
                </mui.Dialog>
                <mui.Snackbar ref="snackbar" message={this.state.snackMsg} />
            </span>
        )
    }
});

module.exports = DeleteButton;