import type { ComponentType } from 'react';

export default (name: string) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <T extends ComponentType<any>>(component: T): T => {
    // eslint-disable-next-line no-param-reassign
    component.displayName = name;
    return component;
  };
