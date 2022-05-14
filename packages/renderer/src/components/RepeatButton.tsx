import type { IconButtonProps } from '@mui/material';
import { IconButton } from '@mui/material';
import React, { useCallback, useEffect, useRef } from 'react';

type RepeatReturn = Pick<Required<IconButtonProps>, 'onMouseDown' | 'onMouseUp'>;

type Internal = {
  onClick?: React.MouseEventHandler;
  timeoutId?: number;
  intervalId?: number;
};

export const useRepeater = (
  onClick?: React.MouseEventHandler,
  delay = 300,
  interval = 80,
): RepeatReturn => {
  const refInternal = useRef<Internal>({});
  refInternal.current.onClick = onClick;
  const cancel = useCallback(() => {
    window.clearTimeout(refInternal.current.timeoutId);
    window.clearInterval(refInternal.current.intervalId);
  }, []);
  useEffect(() => cancel, [cancel]);
  const start = useCallback<React.MouseEventHandler>(
    e => {
      e.persist();
      refInternal.current.onClick?.(e);
      refInternal.current.timeoutId = window.setTimeout(() => {
        refInternal.current.onClick?.(e);
        refInternal.current.intervalId = window.setInterval(() => {
          refInternal.current.onClick?.(e);
        }, interval);
      }, delay);
    },
    [delay, interval],
  );

  return {
    onMouseDown: start,
    onMouseUp: cancel,
  };
};

const RepeatButton: React.FC<Omit<IconButtonProps, 'onMouseDown' | 'onMouseUp'>> = ({
  onClick,
  children,
  ...props
}) => {
  const { onMouseDown, onMouseUp } = useRepeater(onClick);
  return (
    <IconButton {...props} onMouseDown={onMouseDown} onMouseUp={onMouseUp}>
      {children}
    </IconButton>
  );
};

export default RepeatButton;
