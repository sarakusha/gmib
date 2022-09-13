import type { TypedMessage } from '/@common/TypedMessage';

export default function patchEmitter<
  Emitter extends { emit: (event: string, ...args: unknown[]) => boolean },
>(emitter: Emitter, target: string): void {
  // const typedEmitter = emitter as { emit: (event: string, ...args: unknown[]) => boolean };
  const { emit } = emitter;
  if (typeof emit !== 'function') throw new TypeError('Invalid emitter');
  // eslint-disable-next-line no-param-reassign
  emitter.emit = (event, payload: unknown, ...args: unknown[]) => {
    const msg: TypedMessage = {
      target,
      type: event,
      payload,
    };
    window.postMessage(msg, '*');
    return emit(event, payload, ...args);
  };
}
