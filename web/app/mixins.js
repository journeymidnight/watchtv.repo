var React = require("react");
var Styles = require('material-ui/lib/styles');
var ThemeManager = new Styles.ThemeManager();

var materialMixin = {
    childContextTypes: {
        muiTheme: React.PropTypes.object
    },
    getChildContext: function () {
        return {
            muiTheme: ThemeManager.getCurrentTheme()
        };
    }
};

var graphMixin = {
    componentDidMount: function () {
        var that = this;

        // check and set the state of graphWidth so as to redraw the graphs
        // when graph width changes
        var checkGraphWidth = function () {
            var graph = $('#' + that.props.graph._id);
            var graphWidth = graph.width();
            return function () {
                if(graphWidth !== graph.width()) {
                    graphWidth = graph.width();
                    that.setState({graphWidth: graphWidth});
                }
            };
        }();
        setInterval(checkGraphWidth, 1200);

        // For updating graph title
        $("#" + this.props.graph._id + " .titleInput").off().on('blur', function(){
            if($(this).val()=="") return;
            var graph = {
                title: $(this).val()
            };
            $.ajax({
                type: 'PUT',
                url: 'graph/' + that.props.graph._id,
                data: {graph: graph},
                success: function(){
                    if(that.props.onUpdate) {
                        that.props.onUpdate({
                            title: graph.title,
                            _id: that.props.graph._id
                        });
                    }
                },
                error:function(xhr, status, err){
                    if (xhr.status === 401) {
                        location.assign('/login.html');
                    }
                    console.log("error");
                }
            });
        });
        $(".singleDefault .titleInput").off().attr("disabled",true);
    }
};

module.exports = {
    materialMixin: materialMixin,
    graphMixin: graphMixin
};