import type { NibusSessionEvents } from '@nibus/core/session/NibusSession';

import TypedEventTarget from '/@common/TypedEventTarget';

const sessionListener = new TypedEventTarget<NibusSessionEvents>('session');

export default sessionListener;
