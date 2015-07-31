var React = require('react');
var injectTapEventPlugin = require("react-tap-event-plugin");
var mui = require('material-ui');

var mixins = require('../mixins.js');

// The navigation UI for watchtv, including a title bar and a side bar

// props:
//   title: string, title for current page

injectTapEventPlugin();

var NavigationBar = React.createClass({
    mixins: [mixins.materialMixin],
    getInitialState:function(){
        var user;
        $.ajax({
            url:"/user",
            type:"get",
            async:false,
            success:function(data){
                user = data.name;
            }
        });
        return {
            user:user,
        }
    },
    getStyles: function() {
        return {
            cursor: 'pointer',
            //.mui-font-style-headline
            fontSize: '24px',
            color: mui.Styles.Typography.textFullWhite,
            lineHeight: mui.Styles.Spacing.desktopKeylineIncrement + 'px',
            fontWeight: mui.Styles.Typography.fontWeightLight,
            backgroundColor: mui.Styles.Colors.cyan500,
            paddingLeft: mui.Styles.Spacing.desktopGutter,
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
        menuItems = [
            {type: mui.MenuItem.Types.LINK, payload:'/', text: 'Nodes'},
            {type: mui.MenuItem.Types.LINK, payload:'/tag.html', text: 'Tags'},
            {type: mui.MenuItem.Types.LINK, payload:'/dashboard.html', text: 'Dashboard'},
            {type: mui.MenuItem.Types.LINK, payload:'/logout', text: 'LoginOut'}
        ];
        return (
            <div>
                <mui.AppBar title={this.props.title} onLeftIconButtonTouchTap={this.showNavi} />
                <mui.LeftNav menuItems={menuItems} docked={false} ref="navi" className = "navBar"
                    header={header} isInitiallyOpen={true} />
                <mui.CardHeader
                    title={this.state.user}
                    avatar=""
                    className="icon"/>
            </div>
        )
    }
});

module.exports = NavigationBar;