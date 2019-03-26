import React from 'react';
import { WithStyles, Theme } from '@material-ui/core/styles';
import { IStela } from './_app';
declare const styles: (theme: Theme) => Record<"root" | "title" | "right" | "content" | "row" | "toolbar" | "frame" | "paperFrame" | "drawer" | "appBar" | "menuButton" | "drawerPaper", import("@material-ui/core/styles/withStyles").CSSProperties>;
interface Props extends WithStyles<typeof styles>, IStela {
    session: any;
}
declare const _default: React.ComponentType<Pick<Pick<Props, "classes" | "title" | "backgroundColor" | "lineHeight" | "paddingTop" | "isCondensed" | "isBold" | "titleColor" | "titleSize" | "nameColor" | "nameSize" | "subColor" | "subSize" | "priceColor" | "priceSize" | "items" | "fontName" | "session" | "logout" | "update"> & Partial<Pick<Props, "height" | "width">> & Partial<Pick<{
    width: number;
    height: number;
}, never>>, "title" | "backgroundColor" | "height" | "lineHeight" | "paddingTop" | "width" | "isCondensed" | "isBold" | "titleColor" | "titleSize" | "nameColor" | "nameSize" | "subColor" | "subSize" | "priceColor" | "priceSize" | "items" | "fontName" | "session" | "logout" | "update"> & import("@material-ui/core/styles").StyledComponentProps<"root" | "title" | "right" | "content" | "row" | "toolbar" | "frame" | "paperFrame" | "drawer" | "appBar" | "menuButton" | "drawerPaper">>;
export default _default;
//# sourceMappingURL=dashboard.d.ts.map