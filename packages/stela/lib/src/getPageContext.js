"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jss_1 = require("jss");
const styles_1 = require("@material-ui/core/styles");
const createPageContext = () => {
    return ({
        theme: styles_1.createMuiTheme({
            typography: {
                useNextVariants: true,
            },
            overrides: {
                MuiCssBaseline: {
                    '@global': {
                        body: {
                            backgroundColor: undefined,
                        },
                    },
                },
            },
        }),
        sheetsManager: new Map(),
        sheetsRegistry: new jss_1.SheetsRegistry(),
        generateClassName: styles_1.createGenerateClassName(),
    });
};
let pageContext;
function getPageContext() {
    if (!process.browser) {
        return createPageContext();
    }
    if (!pageContext) {
        pageContext = createPageContext();
    }
    return pageContext;
}
exports.default = getPageContext;
//# sourceMappingURL=getPageContext.js.map