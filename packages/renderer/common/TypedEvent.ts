export default class TypedEvent<T extends string = string, P = unknown> extends Event {
  constructor(type: T, readonly payload?: P) {
    super(type);
  }
}
