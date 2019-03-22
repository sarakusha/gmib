"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) if (e.indexOf(p[i]) < 0)
            t[p[i]] = s[p[i]];
    return t;
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importStar(require("react"));
const AppBar_1 = __importDefault(require("@material-ui/core/AppBar"));
const Drawer_1 = __importDefault(require("@material-ui/core/Drawer"));
const Hidden_1 = __importDefault(require("@material-ui/core/Hidden"));
const IconButton_1 = __importDefault(require("@material-ui/core/IconButton"));
const Paper_1 = __importDefault(require("@material-ui/core/Paper"));
const styles_1 = require("@material-ui/core/styles");
const Toolbar_1 = __importDefault(require("@material-ui/core/Toolbar"));
const Typography_1 = __importDefault(require("@material-ui/core/Typography"));
const Visibility_1 = __importDefault(require("@material-ui/icons/Visibility"));
const ExitToApp_1 = __importDefault(require("@material-ui/icons/ExitToApp"));
const Refresh_1 = __importDefault(require("@material-ui/icons/Refresh"));
const Send_1 = __importDefault(require("@material-ui/icons/Send"));
const StelaForm_1 = __importDefault(require("../components/StelaForm"));
const drawerWidth = 240;
const styles = (theme) => styles_1.createStyles({
    root: {},
    frame: {
        backgroundColor: 'black',
        margin: 5,
    },
    paperFrame: Object.assign({}, theme.mixins.gutters(), { paddingTop: theme.spacing.unit * 2, paddingBottom: theme.spacing.unit * 2 }),
    drawer: {
        [theme.breakpoints.up('sm')]: {
            width: drawerWidth,
            flexShrink: 0,
        },
    },
    appBar: {},
    menuButton: {
        marginRight: 10,
        [theme.breakpoints.up('sm')]: {
            display: 'none',
        },
    },
    toolbar: theme.mixins.toolbar,
    drawerPaper: {
        width: drawerWidth,
    },
    content: {
        flexGrow: 1,
        padding: theme.spacing.unit * 3,
        [theme.breakpoints.down('xs')]: {
            padding: 0,
        },
    },
    row: {
        display: 'flex',
    },
    title: {
        flexGrow: 1,
    },
    right: {
        flexShrink: 0,
        marginLeft: theme.spacing.unit,
        marginRight: theme.spacing.unit,
    },
});
class Dashboard extends react_1.PureComponent {
    constructor() {
        super(...arguments);
        this.submitForm = () => { };
        this.resetForm = () => { };
        this.bindSubmitForm = (submitForm) => {
            this.submitForm = submitForm;
        };
        this.submittingChanged = (isSubmitting) => {
            this.setState({ isSubmitting });
        };
        this.bindResetForm = (resetForm) => {
            this.resetForm = resetForm;
        };
        this.reset = () => {
            this.resetForm && this.resetForm();
        };
        this.state = {
            src: '',
            isOpen: false,
            settingsExpanded: true,
            isSubmitting: true,
        };
        this.handleDrawerToggle = () => {
            this.setState(state => ({ isOpen: !state.isOpen }));
        };
    }
    static getInitialProps() {
        return { isNeedLogin: true };
    }
    componentDidMount() {
        this.setState({ src: `http://${window.location.host}/` });
    }
    render() {
        const _a = this.props, { classes, update, logout } = _a, values = __rest(_a, ["classes", "update", "logout"]);
        const { width, height, title } = values;
        const { src, isSubmitting } = this.state;
        const scale = (drawerWidth - 10) / width;
        const drawer = (<Paper_1.default style={{ height: height * scale + 10 }}>
        <iframe src={src} width={width} style={{
            transform: `scale(${scale}`,
            transformOrigin: 'left top',
        }} height={height} frameBorder={0} className={classes.frame}>
          Стела
        </iframe>
      </Paper_1.default>);
        return (<div className={classes.root}>
        <AppBar_1.default position="fixed" className={classes.appBar}>
          <Toolbar_1.default>
            <IconButton_1.default color="inherit" aria-label="Open drawer" onClick={this.handleDrawerToggle} className={classes.menuButton} title="Просмотр">
              <Visibility_1.default />
            </IconButton_1.default>
            <Typography_1.default variant="h6" color="inherit" className={classes.title}>
              {title || 'Стела'}
            </Typography_1.default>
            <IconButton_1.default color="inherit" onClick={logout} className={classes.right} title="Выйти" aria-label="Log Out">
              <ExitToApp_1.default />
            </IconButton_1.default>
            <IconButton_1.default color="inherit" onClick={this.reset} className={classes.right} title="Сбросить" aria-label="Reset form">
              <Refresh_1.default />
            </IconButton_1.default>
            <IconButton_1.default color="inherit" onClick={this.submitForm} className={classes.right} disabled={isSubmitting} title="Отправить" aria-label="Send data">
              <Send_1.default />
            </IconButton_1.default>
          </Toolbar_1.default>
        </AppBar_1.default>
        <main className={classes.content}>
          <div className={classes.toolbar}/>
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'center',
        }}>
            <StelaForm_1.default {...values} update={update} bindSubmitForm={this.bindSubmitForm} submittingChanged={this.submittingChanged} bindResetForm={this.bindResetForm}/>
            <aside>
              <Hidden_1.default xsDown>
                <div style={{ width: 240 }}>
                  {drawer}
                </div>
              </Hidden_1.default>
            </aside>
          </div>
        </main>
        <nav className={classes.drawer}>
          <Hidden_1.default smUp>
            <Drawer_1.default variant="temporary" open={this.state.isOpen} onClose={this.handleDrawerToggle} classes={{
            paper: classes.drawerPaper,
        }} anchor="right">
              <div className={classes.toolbar}/>
              {drawer}
            </Drawer_1.default>
          </Hidden_1.default>
        </nav>
      </div>);
    }
}
Dashboard.defaultProps = {
    width: 160,
    height: 320,
};
exports.default = styles_1.withStyles(styles)(Dashboard);
//# sourceMappingURL=dashboard.jsx.map