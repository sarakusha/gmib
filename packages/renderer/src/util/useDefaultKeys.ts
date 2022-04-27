/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { noop } from '@nibus/core';
import hotkeys from 'hotkeys-js';
import { useEffect } from 'react';
import timeid from './timeid';

type Props = {
  enterHandler?: () => void;
  cancelHandler?: () => void;
};
const useDefaultKeys = ({ enterHandler = noop, cancelHandler = noop }: Props): void => {
  useEffect(() => {
    const scope = timeid();
    hotkeys.setScope(scope);
    hotkeys('enter', scope, event => {
      event.preventDefault();
      enterHandler();
    });
    hotkeys('esc', scope, event => {
      event.preventDefault();
      cancelHandler();
    });
    return () => {
      hotkeys.unbind('enter', scope);
      hotkeys.unbind('esc', scope);
    };
  }, [enterHandler, cancelHandler]);
};

export default useDefaultKeys;
