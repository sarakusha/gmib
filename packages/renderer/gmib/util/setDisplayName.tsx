import type { ComponentType } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default (name: string) => <T extends ComponentType<any>>(component: T): T => {
  // eslint-disable-next-line no-param-reassign
  component.displayName = name;
  return component;
};
