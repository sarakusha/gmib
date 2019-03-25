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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const head_1 = __importDefault(require("next/head"));
const react_1 = __importDefault(require("react"));
const app_1 = __importStar(require("next/app"));
const pick_1 = __importDefault(require("lodash/pick"));
const LoginDialog_1 = __importDefault(require("../components/LoginDialog"));
const socket_io_client_1 = __importDefault(require("socket.io-client"));
const styles_1 = require("@material-ui/core/styles");
const CssBaseline_1 = __importDefault(require("@material-ui/core/CssBaseline"));
const JssProvider_1 = __importDefault(require("react-jss/lib/JssProvider"));
const stela_1 = require("../src/stela");
const getPageContext_1 = __importDefault(require("../src/getPageContext"));
const parseResponse = async (res) => {
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.indexOf('application/json') !== -1) {
        return [res.ok, await res.json()];
    }
    return [res.ok, { message: await res.text() }];
};
class StelaApp extends app_1.default {
    constructor(props) {
        super(props);
        this.pageContext = getPageContext_1.default();
        this.needLogin = false;
        this.handleChanged = (props) => {
            this.setState(props);
        };
        this.update = (props) => {
            this.socket.emit('update', pick_1.default(props, stela_1.PROPS));
        };
        this.handleSubmitLogin = (values) => {
            return Promise.resolve()
                .then(() => fetch('/login', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(values),
            }))
                .then(parseResponse, () => [false, { message: 'Server error' }])
                .then((res) => {
                const [isOk, session] = res;
                if (isOk) {
                    this.setState({ username: session && session.passport && session.passport.user });
                    this.socket.emit('reload');
                }
                return res;
            });
        };
        this.logout = () => {
            fetch('/logout').then();
            this.handleLogout();
        };
        this.handleLogout = () => {
            this.setState({ username: null });
        };
        const { pageProps, session } = props;
        this.state = Object.assign({ titleColor: '#7cb5ec', nameColor: '#fff', subColor: '#e7ba00', priceColor: '#fff', isBold: true, lineHeight: 1, items: [], marginTop: 0, fontName: 'Ubuntu' }, pageProps, { username: session && session.passport && session.passport.user });
    }
    static async getInitialProps({ ctx, Component }) {
        const { req, query } = ctx;
        let isNeedLogin = false;
        if (Component.getInitialProps) {
            const compProps = await Component.getInitialProps(ctx);
            isNeedLogin = compProps.isNeedLogin;
        }
        if (req) {
            return {
                isNeedLogin,
                pageProps: query,
                session: req.session,
            };
        }
        return { pageProps: {} };
    }
    componentDidMount() {
        this.socket = socket_io_client_1.default({ transports: ['websocket'] });
        this.socket.on('reconnect_attempt', () => {
            console.log('RECONNECT');
            this.socket.io.opts.transports = ['polling', 'websocket'];
        });
        this.socket.on('initial', this.handleChanged);
        this.socket.on('changed', this.handleChanged);
        this.socket.on('logout', this.handleLogout);
        const jssStyles = document.querySelector('#jss-sever-side');
        if (jssStyles && jssStyles.parentNode) {
            jssStyles.parentNode.removeChild(jssStyles);
        }
    }
    componentWillUnmount() {
        this.socket.off('logout', this.handleLogout);
        this.socket.off('changed', this.handleChanged);
        this.socket.off('initial', this.handleChanged);
        this.socket.close();
    }
    render() {
        const { Component, isNeedLogin } = this.props;
        const _a = this.state, { username } = _a, pageProps = __rest(_a, ["username"]);
        const isLoginOpen = !username;
        const { theme, generateClassName, sheetsManager, sheetsRegistry } = this.pageContext;
        return (<app_1.Container>
        <head_1.default>
          <title>{pageProps.title || 'Стела'}</title>
        </head_1.default>
        <JssProvider_1.default registry={sheetsRegistry} generateClassName={generateClassName}>
          <styles_1.MuiThemeProvider theme={theme} sheetsManager={sheetsManager}>
            <CssBaseline_1.default />
            <Component {...pageProps} pageContext={this.pageContext} update={this.update} logout={this.logout}/>
            {isNeedLogin &&
            <LoginDialog_1.default isOpen={isLoginOpen} onSubmit={this.handleSubmitLogin}/>}
          </styles_1.MuiThemeProvider>
        </JssProvider_1.default>
      </app_1.Container>);
    }
}
exports.default = StelaApp;
//# sourceMappingURL=_app.jsx.map