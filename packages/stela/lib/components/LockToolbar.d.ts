import React from 'react';
import { IconButtonProps } from '@material-ui/core/IconButton';
declare type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export interface Props extends Omit<IconButtonProps, 'classes' | 'onChange'> {
    title: string;
    checked?: boolean;
    onChange?: (event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => void;
    onAdd?: () => void;
}
declare const _default: React.ComponentClass<Props, any>;
export default _default;
//# sourceMappingURL=LockToolbar.d.ts.map