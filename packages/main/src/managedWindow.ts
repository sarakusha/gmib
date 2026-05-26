import type { WebContents } from 'electron';
import type { EventEmitter } from 'events';

export type CloseEvent = {
  defaultPrevented: boolean;
  preventDefault: () => void;
};

export interface ManagedWindow extends EventEmitter {
  readonly id: number;
  readonly webContents: WebContents;
  close: () => void;
  focus: () => void;
  hide: () => void;
  isDestroyed: () => boolean;
  isVisible: () => boolean;
  loadURL: (url: string) => Promise<void>;
  setTitle: (title: string) => void;
  show: () => void;
}

export const createCloseEvent = (): CloseEvent => ({
  defaultPrevented: false,
  preventDefault() {
    this.defaultPrevented = true;
  },
});
