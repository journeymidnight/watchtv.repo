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
            {text: 'Node',icon:<i className="fa fa-nav fa-sitemap" data-url="/"></i>},
            {text: 'Tag',icon:<i className="fa fa-nav fa-tag" data-url="/tag.html"></i>},
            {text: 'Dashboard',icon:<i className="fa fa-nav fa-signal" data-url="/dashboard.html"></i>}
        ];
        if(this.state.user.role === 'Root' || this.state.user.role === 'Leader') {
            menuItems.push({text: 'User',icon:<i className="fa fa-nav fa-user" data-url="/user.html"></i>});
        }
        if(this.state.user.role === 'Root') {
            menuItems.push({payload:'/project.html', text: 'Project',icon:<i className="fa fa-nav fa-joomla" data-url="/project.html"></i>})
        }
        menuItems.push({payload:'/logout', text: 'Log Out',icon:<i className="fa fa-nav fa-sign-out" data-url="/logout"></i>});
        return (
            <div>
                <div className="head">
                    <AppBar title={this.props.title} onLeftIconButtonTouchTap={this.showNavi}
                                iconElementRight={<FlatButton label={this.state.user.name} />}
                    />
                    <LeftNav menuItems={menuItems} docked={false} ref="navi" className = "navBar"
                        header={header} isInitiallyOpen={true}/>
                </div>
                <div className="afterNav"></div>
            </div>
        )
    }
});

module.exports = NavigationBar;