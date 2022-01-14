/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
/// <reference types="react" />

import * as React from 'react';

export type IPProps = {
  className?: string;
  defaultValue?: string;
  isError?: () => boolean;
  onChange?: (ip: string) => void;
};

declare const IPut: React.FC<IPProps>;

export default IPut;
