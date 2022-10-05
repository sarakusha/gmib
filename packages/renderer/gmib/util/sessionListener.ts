import TypedEventTarget from '../../common/TypedEventTarget';

import type { NibusSessionEvents } from '@nibus/core/session/NibusSession';

const sessionListener = new TypedEventTarget<NibusSessionEvents>('session');

export default sessionListener;
