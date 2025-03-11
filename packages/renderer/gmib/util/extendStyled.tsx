/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-types */
import type { PropsOf } from '@emotion/react';
import type { Theme } from '@mui/material/styles';
import { styled } from '@mui/material/styles';
import type { CreateStyledComponent } from '@mui/styled-engine';
import type { MUIStyledCommonProps } from '@mui/system';
import type React from 'react';

export type ExtendProps<
  C extends
    | React.ComponentClass<React.ComponentProps<C>>
    | React.JSXElementConstructor<React.ComponentProps<C>>,
  P,
> = PropsOf<C> & Partial<P> & MUIStyledCommonProps<Theme>;

export default function extendStyled<
  C extends
    | React.ComponentClass<React.ComponentProps<C>>
    | React.JSXElementConstructor<React.ComponentProps<C>>,
  P,
>(component: C, additionalProps: P): CreateStyledComponent<ExtendProps<C, P>, {}, {}, Theme> {
  return styled(component, {
    shouldForwardProp: prop => !Object.prototype.hasOwnProperty.call(additionalProps, prop),
  }) as any;
}
