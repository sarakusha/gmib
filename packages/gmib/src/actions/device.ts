/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { mib } from '@nata/nibus.js-client';
import { AddressParam } from '@nata/nibus.js-client/lib/Address';
import { createStandardAction } from 'typesafe-actions';

const { devices } = mib;
export const createMib = createStandardAction('device/CREATE_MIB').map(
  (address: AddressParam, mib: string) => ({
    payload: {
      address,
      mib,
    },
    meta: { devices },
  }));

export const createType = createStandardAction('device/CREATE_TYPE').map(
  (address: AddressParam, type: number, version?: number) => ({
    payload: {
      address,
      type,
      version,
    },
    meta: { devices },
  }));
