import React from 'react';
import { WithStyles, Theme } from '@material-ui/core/styles';
import { IStela } from './_app';
declare const styles: (theme: Theme) => Record<"content" | "right" | "row" | "toolbar" | "title" | "root" | "frame" | "paperFrame" | "drawer" | "appBar" | "menuButton" | "drawerPaper", import("@material-ui/core/styles/withStyles").CSSProperties>;
interface Props extends WithStyles<typeof styles>, IStela {
    session: any;
}
declare const _default: React.ComponentType<Pick<Pick<Props, "backgroundColor" | "lineHeight" | "paddingTop" | "fontName" | "update" | "classes" | "items" | "logout" | "isCondensed" | "isBold" | "title" | "titleColor" | "titleSize" | "nameColor" | "nameSize" | "subColor" | "subSize" | "priceColor" | "priceSize" | "session"> & Partial<Pick<Props, "height" | "width">> & Partial<Pick<{
    width: number;
    height: number;
}, never>>, "backgroundColor" | "height" | "lineHeight" | "paddingTop" | "width" | "fontName" | "update" | "items" | "logout" | "isCondensed" | "isBold" | "title" | "titleColor" | "titleSize" | "nameColor" | "nameSize" | "subColor" | "subSize" | "priceColor" | "priceSize" | "session"> & import("@material-ui/core/styles").StyledComponentProps<"content" | "right" | "row" | "toolbar" | "title" | "root" | "frame" | "paperFrame" | "drawer" | "appBar" | "menuButton" | "drawerPaper">>;
export default _default;
//# sourceMappingURL=dashboard.d.ts.map