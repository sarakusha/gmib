import { isAnyOf } from '@reduxjs/toolkit';

import { startAppListening } from './listenerMiddleware';
import { calculate, changeInterval, MIN_INTERVAL, pushSensorValue } from './sensorsSlice';

let timeout = 0;

startAppListening({
  matcher: isAnyOf(changeInterval, pushSensorValue),
  effect(action, { dispatch }) {
    if (pushSensorValue.match(action)) {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => dispatch(calculate()), 2 * MIN_INTERVAL * 1000);
    }
    dispatch(calculate());
  },
});
