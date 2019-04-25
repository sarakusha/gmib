import React, { ReactNode } from 'react';
import { WithStyles, Theme } from '@material-ui/core/styles';
export interface SectionProps extends WithStyles<typeof styles> {
    title: ReactNode;
    defaultExpanded?: boolean;
    disabled?: boolean;
    expanded?: boolean;
    onChange?: (event: React.ChangeEvent<{}>, expanded: boolean) => void;
    children?: ReactNode;
    className?: string;
    actions?: ReactNode;
}
declare const styles: (theme: Theme) => Record<"title", import("@material-ui/core/styles/withStyles").CSSProperties>;
declare const _default: React.ComponentType<Pick<SectionProps, "expanded" | "disabled" | "title" | "children" | "className" | "onChange" | "actions" | "defaultExpanded"> & import("@material-ui/core/styles").StyledComponentProps<"title">>;
export default _default;
//# sourceMappingURL=Section.d.ts.map