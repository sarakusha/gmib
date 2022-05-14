import type { NibusSessionEvents } from '@nibus/core/lib/session/NibusSession';

import TypedEventTarget from './TypedEventTarget';

const sessionListener = new TypedEventTarget<NibusSessionEvents>('session');

export default sessionListener;
