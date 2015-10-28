var React = require('react');
var mui = require('material-ui');

// A well known delete button like this:
//   +--------+      
//   | [icon] |      
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
                if (xhr.status === 401) {
                    location.assign('/login.html');
                }
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
                <mui.IconButton tooltip="Delete" onClick={this.handleClick}>
                    <mui.SvgIcon hoverColor="#e53935">
                        <svg fill="#444444" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
                            <path d="M0 0h24v24H0z" fill="none"/>
                        </svg>
                    </mui.SvgIcon>
                </mui.IconButton>
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