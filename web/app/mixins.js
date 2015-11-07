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

module.exports = {
    materialMixin: materialMixin
};