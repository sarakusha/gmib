type ExpandTypes<T> = T extends Record<PropertyKey, unknown>
  ? // eslint-disable-next-line @typescript-eslint/ban-types
    {} & { [P in keyof T]: ExpandTypes<T[P]> }
  : T extends PromiseLike<infer M>
    ? Promise<ExpandTypes<M>>
    : T extends (infer U)[]
      ? ExpandTypes<U>[]
      : // : T extends () => infer R
        // ? () => ExpandTypes<R>
        // : T extends (arg: infer A, ...args: infer B) => PromiseLike<infer R>
        // ? (arg: ExpandTypes<A>, ...args: B) => Promise<ExpandTypes<R>>
        // : T extends (arg: infer A, ...args: infer B) => infer R
        // ? (arg: ExpandTypes<A>, ...args: B) => ExpandTypes<R>
        T;

const expandTypes = <T>(value: T): ExpandTypes<T> => value as ExpandTypes<T>;

export default expandTypes;
