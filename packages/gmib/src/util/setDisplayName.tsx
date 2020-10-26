/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { ComponentType } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default (name: string) => <T extends ComponentType<any>>(component: T): T => {
  component.displayName = name;
  return component;
};
