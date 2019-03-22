import React from 'react';
import { DraggableProvidedDragHandleProps } from 'react-beautiful-dnd';
import { PriceItem } from '../src/stela';
interface RowProps {
    item: PriceItem;
    index: number;
    handleProps: DraggableProvidedDragHandleProps | null;
    errors: Partial<PriceItem> | undefined;
    locked?: boolean;
    isDragging?: boolean;
    remove: () => void;
    classes: any;
}
declare const _default: React.MemoExoticComponent<({ item: { id }, index, handleProps, classes, errors, locked, isDragging, remove, }: RowProps) => JSX.Element>;
export default _default;
//# sourceMappingURL=StelaFormRow.d.ts.map