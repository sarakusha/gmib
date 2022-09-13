type ExpandTypes<T> = T extends Record<PropertyKey, unknown>
  ? // eslint-disable-next-line @typescript-eslint/ban-types
    {} & { [P in keyof T]: ExpandTypes<T[P]> }
  : T extends PromiseLike<infer M>
  ? Promise<ExpandTypes<M>>
  : T extends (infer U)[]
  ? ExpandTypes<U>[]
  : // : T extends (...args: infer A) => PromiseLike<infer R>
    // ? (...args: Id<A>) => Promise<Id<R>>
    // : T extends (...args: infer A) => infer R
    // ? (...args: Id<A>) => R
    T;

const expandTypes = <T>(value: T): ExpandTypes<T> => value as ExpandTypes<T>;

export default expandTypes;
