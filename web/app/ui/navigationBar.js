var React = require('react');
var injectTapEventPlugin = require("react-tap-event-plugin");
var Styles = require('material-ui/lib/styles');
var IconMenu = require('material-ui/lib/menus/icon-menu');
var FontIcon = require('material-ui/lib/font-icon');
var MenuItem = require('material-ui/lib/menus/menu-item');
var AppBar = require('material-ui/lib/app-bar');
var LeftNav = require('material-ui/lib/left-nav');
var DropDownMenu = require('material-ui/lib/drop-down-menu');
var Dialog = require('material-ui/lib/dialog');
var TextField = require('material-ui/lib/text-field');

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
            showName: '',
            role: 'User',
            graphColumnNumber: 2
        };
        return {
            user: user
        };
    },
    fetchUser: function () {
        var that = this;
        $.ajax({
            url: "/user",
            type: "GET",
            success: function (data) {
                that.setState({user: data});
            }
        });
    },
    componentDidMount: function () {
        this.fetchUser();
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
    handleRightMenuChange: function (event, value) {
        if(value === 'help') {
            window.open("http://wiki.letv.cn/display/pla/watchTV");
        } else if(value === 'logout') {
            window.location.href="/logout";
        } else if(value === 'preferences') {
            this.refs.preferenceDialog.show();
        }
    },
    updatePreference: function () {
        $.ajax({
            type: 'PUT',
            url: '/preferences',
            data: {
                showName: this.refs.showNameInput.getValue().trim(),
                graphColumnNumber: this.getDropdownValue()
            },
            success: function() {
                this.refs.preferenceDialog.dismiss();
                this.fetchUser();
            }.bind(this),
            error: function(xhr, status, err) {
                if (xhr.status === 401) {
                    location.assign('/login.html');
                }
                console.log(err);
            }
        });
    },
    createDropdownChangeHandler: function (selected) {
        var selectedValue = selected;
        this.getDropdownValue = function() {
            return selectedValue;
        };
        return function (event, index, item) {
            selectedValue = item.payload;
        }
    },
    componentDidUpdate: function() {
        // make left navigation items clickable
        $(".fa-nav").parent().off().click(function(){
            window.location.href = $(this).find(".fa-nav").attr("data-url");
        });
    },
    render: function() {
        var header = (
            <div style={this.getStyles()} >
                watchTV
            </div>
        );
        var name = this.state.user.name;
        if(this.state.user.showName) {
            name = this.state.user.showName + '(' + name + ')';
        }
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

        var preferenceActions = [
            {text: 'Cancel'},
            {text: 'Update', onClick: this.updatePreference}
        ];
        var preferenceEdits = [];
        var dropdownItems = [
            {payload: 2, text: 'Graph column number'},
            {payload: 1, text: '1'},
            {payload: 2, text: '2'},
            {payload: 3, text: '3'},
            {payload: 4, text: '4'}
        ], selectedIndex = 0;
        for(var i=1; i<dropdownItems.length; i++) {
            if(dropdownItems[i].payload === this.state.user.graphColumnNumber) {
                selectedIndex = i;
                break;
            }
        }
        preferenceEdits.push(<TextField floatingLabelText="Show Name"
                                         defaultValue={this.state.user.showName}
                                         ref="showNameInput" />);
        preferenceEdits.push(<DropDownMenu menuItems={dropdownItems}
                                            selectedIndex={selectedIndex}
                                            onChange={this.createDropdownChangeHandler()}/>);
        return (
            <div>
                <div className="head">
                    <AppBar title={this.props.title} onLeftIconButtonTouchTap={this.showNavi}
                            iconElementRight={
                                <IconMenu iconButtonElement={<FontIcon className="fa fa-ellipsis-v"
                                    color="#d8f4f9" />}  desktop={true}
                                    onChange={this.handleRightMenuChange}>
                                <MenuItem primaryText={name} disabled={true} />
                                <MenuItem primaryText="Preferences"
                                    leftIcon={<FontIcon className="fa fa-cog" style={{margin: 0}} />}
                                    value="preferences" />
                                <MenuItem primaryText="Help"
                                    leftIcon={<FontIcon className="fa fa-lightbulb-o" style={{margin: 0}}/>}
                                    value="help" />
                                <MenuItem primaryText="Log Out"
                                    leftIcon={<FontIcon className="fa fa-sign-out" style={{margin: 0}}/>}
                                    value="logout" />
                                </IconMenu>
                            }
                    />
                    <LeftNav menuItems={menuItems} docked={false} ref="navi" className = "navBar"
                        header={header} isInitiallyOpen={true}/>
                    <Dialog
                        title="Preferences"
                        actions={preferenceActions}
                        ref="preferenceDialog"
                        contentClassName="dropDownDiv">
                        {preferenceEdits}
                    </Dialog>
                </div>
                <div className="afterNav"></div>
            </div>
        )
    }
});

module.exports = NavigationBar;