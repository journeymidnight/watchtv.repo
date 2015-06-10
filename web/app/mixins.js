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

module.exports = {
    materialMixin: materialMixin
};