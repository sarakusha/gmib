/// <reference types="react" />
import Document from 'next/document';
import { IPageContext } from '../src/getPageContext';
import { IStela } from './_app';
declare class StelaDocument extends Document<{
    pageContext: IPageContext;
} & IStela> {
    render(): JSX.Element;
}
export default StelaDocument;
//# sourceMappingURL=_document.d.ts.map