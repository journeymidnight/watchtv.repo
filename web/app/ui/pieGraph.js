var React = require('react');

// The component to draw a pie graph

// props:
// graph: graph object as in DB schema.
// onUpdate: callback function(graph).
// showShareDialog: callback function(graph_id). Used to open share dialog.
// ShowEditDialog: callback function(graph_id). Used to open edit dialog.


var PieGraph = React.createClass({
    showShareDialog: function() {
        this.props.showShareDialog(this.props.graph._id);
    },
    showGraphEditDialog: function() {
        this.props.showEditDialog(this.props.graph._id);
    },
    render: function() {
        var graph = this.props.graph;
        var placeholderText = __("Click Here to Edit Graph Name");
        if(graph.title!=null&&graph.title!="") placeholderText = graph.title;
        return (
            <div id={graph._id} style={{width: '25%'}}>
                <div className="graph">
                    <input type="text" name="title" className="titleInput"
                           placeholder={placeholderText}
                    />
                    <div id={'graph' + graph._id}
                         style={{width: '100%', height: '145px',
                            backgroundColor: '#1f1f1f', marginTop: '10px'
                         }}>
                    </div>
                    <div className='shareBtnParent'>
                        <div className="graphBtn" onClick={this.showShareDialog}>
                            <i className='fa fa-share fa-white'></i>
                        </div>
                    </div>
                    <div className="btnParent">
                        <div className="graphBtn" onClick={this.showGraphEditDialog}>
                            <i className="fa fa-pencil fa-white"></i>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
});

module.exports = PieGraph;