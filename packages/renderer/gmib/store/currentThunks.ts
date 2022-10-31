import { setBroadcastDetected } from './currentSlice';
import { startAppListening } from './listenerMiddleware';

let timeoutBroadcast = 0;

startAppListening({
  actionCreator: setBroadcastDetected,
  effect({ payload: address }, { dispatch }) {
    window.clearTimeout(timeoutBroadcast);
    if (address) {
      timeoutBroadcast = window.setTimeout(() => dispatch(setBroadcastDetected()), 60000);
    }
  },
});
