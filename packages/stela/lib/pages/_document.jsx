"use strict";
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
const react_1 = __importDefault(require("react"));
const document_1 = __importStar(require("next/document"));
const server_1 = __importDefault(require("styled-jsx/server"));
const react_beautiful_dnd_1 = require("react-beautiful-dnd");
const ubuntuFonts = 'https://fonts.googleapis.com/css?family=Ubuntu+Condensed|Ubuntu:400,700&amp;subset=cyrillic';
class StelaDocument extends document_1.default {
    render() {
        const { pageContext } = this.props;
        return (<html lang="ru" dir="ltr">
      <document_1.Head>
        <meta charSet="utf-8"/>
        
        <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no"/>
        
        <meta name="theme-color" content={pageContext && pageContext.theme.palette.primary.main}/>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto:300,400,500"/>
        <link href={ubuntuFonts} rel="stylesheet"/>
        <link href="/static/stylesheet.css" rel="stylesheet"/>
      </document_1.Head>
      <body>
      <document_1.Main />
      <document_1.NextScript />
      </body>
      </html>);
    }
}
StelaDocument.getInitialProps = async (ctx) => {
    react_beautiful_dnd_1.resetServerContext();
    let pageContext;
    const page = ctx.renderPage(Component => (props) => {
        pageContext = props.pageContext;
        return <Component {...props}/>;
    });
    let css;
    if (pageContext) {
        css = pageContext.sheetsRegistry.toString();
    }
    return Object.assign({}, page, { pageContext, styles: [
            (<style key="jss-server-side" id="jss-server-side" dangerouslySetInnerHTML={{ __html: css || '' }}/>),
            server_1.default() || null,
        ] });
};
exports.default = StelaDocument;
//# sourceMappingURL=_document.jsx.map