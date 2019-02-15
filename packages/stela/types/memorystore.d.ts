import session, { Store } from 'express-session';
declare module 'memorystore' {
  interface Options {
    checkPeriod?: number;
    max?: number;
    ttl?: number | (() => number);
    dispose?: (key: any, value: any) => void;
    stale?: boolean;
  }
  class MemoryStore extends Store {
    constructor(options: Options);
  }
  export default function memorystore(session: session): typeof MemoryStore;
}
