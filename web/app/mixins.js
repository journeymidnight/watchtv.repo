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

var configMixin = {
    getInitialState: function() {
        return {config: {}}
    },
    componentWillMount: function(){
        $.ajax({
            url: '/config',
            dataType: 'json',
            success: function(data) {
                this.setState({config: data})
            }.bind(this),
            error: function(_) {
                this.setState({config: {}})
            }.bind(this),
            async: false
        });
    }
};

module.exports = {
    materialMixin: materialMixin,
    configMixin: configMixin
};