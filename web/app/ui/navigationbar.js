var React = require('react');
var injectTapEventPlugin = require("react-tap-event-plugin");
var Styles = require('material-ui/lib/styles');
var MenuItem = require('material-ui/lib/menu/menu-item');
var AppBar = require('material-ui/lib/app-bar');
var LeftNav = require('material-ui/lib/left-nav');
var FlatButton = require('material-ui/lib/flat-button');

var mixins = require('../mixins.js');

// The navigation UI for watchtv, including a title bar and a side bar

// props:
//   title: string, title for current page

injectTapEventPlugin();

var NavigationBar = React.createClass({
    mixins: [mixins.materialMixin],
    getInitialState:function(){
        var user = {
            name: '',
            role: 'User'
        };
        return {
            user: user
        };
    },
    componentDidMount: function () {
        var that = this;
        $.ajax({
            url: "/user",
            type: "GET",
            success: function (data) {
                that.setState({user: data});
            }
        });
    },
    getStyles: function() {
        return {
            cursor: 'pointer',
            //.mui-font-style-headline
            fontSize: '24px',
            color: Styles.Typography.textFullWhite,
            lineHeight: Styles.Spacing.desktopKeylineIncrement + 'px',
            fontWeight: Styles.Typography.fontWeightLight,
            backgroundColor: Styles.Colors.cyan500,
            paddingLeft: Styles.Spacing.desktopGutter,
            paddingTop: '0px',
            marginBottom: '8px'
        };
    },
    showNavi: function() {
        this.refs.navi.toggle()
    },
    render: function() {
        var header = (
            <div style={this.getStyles()} >
                watchTV
            </div>
        );
        var menuItems = [
            {type: MenuItem.Types.LINK, payload:'/', text: 'Node'},
            {type: MenuItem.Types.LINK, payload:'/tag.html', text: 'Tag'},
            {type: MenuItem.Types.LINK, payload:'/dashboard.html', text: 'Dashboard'}
        ];
        if(this.state.user.role === 'Root' || this.state.user.role === 'Leader') {
            menuItems.push({type: MenuItem.Types.LINK, payload:'/user.html', text: 'User'});
        }
        if(this.state.user.role === 'Root') {
            menuItems.push({type: MenuItem.Types.LINK, payload:'/project.html', text: 'Project'})
        }
        menuItems.push({type: MenuItem.Types.LINK, payload:'/logout', text: 'Log Out'});
        return (
            <div>
                <div className="head">
                    <AppBar title={this.props.title} onLeftIconButtonTouchTap={this.showNavi}
                                iconElementRight={<FlatButton label={this.state.user.name} />}
                    />
                    <LeftNav menuItems={menuItems} docked={false} ref="navi" className = "navBar"
                        header={header} isInitiallyOpen={true} />
                </div>
                <div className="afterNav"></div>
            </div>
        )
    }
});

module.exports = NavigationBar;