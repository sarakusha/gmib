import hotkeys from 'hotkeys-js';
import { useEffect } from 'react';

import timeid from './timeid';

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = (): void => {};

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
