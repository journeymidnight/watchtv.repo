var React = require("react");
var mui = require('material-ui');
var ThemeManager = new mui.Styles.ThemeManager();

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
    getConfig : function() {
        $.ajax({
            url: '/config',
            dataType: 'json',
            success: function(data) {
                this.setState({config: data})
            }.bind(this),
            error: function(_) {
                this.setState({config: data})
            }.bind(this)
        })
    }
};

module.exports = {
    materialMixin: materialMixin,
    configMixin: configMixin
};