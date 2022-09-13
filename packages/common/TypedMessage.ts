export type TypedMessage<T extends string = string, P = unknown> = {
  target: T;
  type: string;
  payload: P;
};

export const isTypedMessage = <T extends string>(
  data: Record<string, unknown>,
  target: T,
): data is TypedMessage<T> =>
  'target' in data && 'type' in data && data.target === target && typeof data.type === 'string';
