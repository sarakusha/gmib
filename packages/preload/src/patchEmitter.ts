import type { TypedMessage } from '/@common/helpers';

export default function patchEmitter(emitter: unknown, target: string): void {
  const typedEmitter = emitter as { emit: (event: string, ...args: unknown[]) => boolean };
  const { emit } = typedEmitter;
  if (typeof emit !== 'function') throw new TypeError('Invalid emitter');
  typedEmitter.emit = (event, payload: unknown, ...args: unknown[]) => {
    const msg: TypedMessage = {
      target,
      type: event,
      payload,
    };
    window.postMessage(msg, '*');
    return emit(event, payload, ...args);
  };
}
