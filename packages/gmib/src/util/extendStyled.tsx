/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
/* eslint-disable @typescript-eslint/ban-types,@typescript-eslint/no-explicit-any */
import { PropsOf } from '@emotion/react';
import { Theme, styled } from '@mui/material/styles';
import type { CreateStyledComponent } from '@mui/styled-engine';
import type { MUIStyledCommonProps } from '@mui/system/createStyled';
import React from 'react';

export type ExtendProps<
  C extends
    | React.ComponentClass<React.ComponentProps<C>>
    | React.JSXElementConstructor<React.ComponentProps<C>>,
  P
> = PropsOf<C> & Partial<P> & MUIStyledCommonProps<Theme>;

export default function extendStyled<
  C extends
    | React.ComponentClass<React.ComponentProps<C>>
    | React.JSXElementConstructor<React.ComponentProps<C>>,
  P
>(component: C, additionalProps: P): CreateStyledComponent<ExtendProps<C, P>, {}, {}, Theme> {
  return styled(component, {
    shouldForwardProp: prop => !Object.prototype.hasOwnProperty.call(additionalProps, prop),
  }) as any;
}
