var React = require('react');
var IconButton = require('material-ui/lib/icon-button');
var SvgIcon = require('material-ui/lib/svg-icon');
var Dialog = require('material-ui/lib/dialog');
var Snackbar = require('material-ui/lib/snackbar');

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
//   ids: any type that could be converted into mongoDB ObjectId, the item ids to delete
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
        var that = this;
        var deleteRequests = [];
        this.props.ids.map(function(id){
            deleteRequests.push(
                $.ajax({
                    type: 'DELETE',
                    url: that.props.url + '/' + id,
                    error: function(xhr, status, err) {
                        if (xhr.status === 401) {
                            location.assign('/login.html');
                        }
                    }
                })
            )
        });
        $.when.apply($, deleteRequests)
         .done(function(){
                that.props.onRefresh();
                that.refs.deleteConfirm.dismiss();
         }).fail(function(){
                that.setState({snackMsg: __('Failed to delete') + that.props.name});
                that.refs.snackbar.show();
         });
    },
    render: function(){
        var deleteConfirm = [
            {text: __('Cancel')},
            {text: __('Confirm'), onClick: this.deleteItem}
        ];
        var msg = __('Are you sure to delete "') + this.props.name + '"?';
        return (
            <span>
                <i className="fa fa-times fa-cir" onClick={this.handleClick}
                   title={__("Delete")}></i>
                <Dialog
                    title={__("Delete Confirmation")}
                    actions={deleteConfirm}
                    ref="deleteConfirm"> {msg}
                </Dialog>
                <Snackbar ref="snackbar" message={this.state.snackMsg} />
            </span>
        )
    }
});

module.exports = DeleteButton;