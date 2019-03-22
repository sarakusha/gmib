import { GenerateClassName, SheetsRegistry } from 'jss';
import { Theme } from '@material-ui/core/styles';
export interface IPageContext {
    theme: Theme;
    sheetsManager: Map<any, any>;
    sheetsRegistry: SheetsRegistry;
    generateClassName: GenerateClassName;
}
export default function getPageContext(): IPageContext;
//# sourceMappingURL=getPageContext.d.ts.map