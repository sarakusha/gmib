import { BaseWindow, dialog, type MessageBoxOptions, type MessageBoxReturnValue } from 'electron';

import log from './initlog';

/** macOS needs a visible parent to use an asynchronous sheet instead of NSAlert.runModal. */
export const showUpdateDialog = async (
  options: MessageBoxOptions,
  parent?: BaseWindow,
): Promise<MessageBoxReturnValue> => {
  const preferred = parent && !parent.isDestroyed() ? parent : BaseWindow.getFocusedWindow();
  const owner =
    preferred && !preferred.isDestroyed()
      ? preferred
      : BaseWindow.getAllWindows().find(window => !window.isDestroyed() && window.isVisible());
  if (owner) {
    if (owner.isMinimized()) owner.restore();
    if (!owner.isVisible()) owner.show();
    return dialog.showMessageBox(owner, options);
  }
  if (process.platform === 'darwin') {
    log.warn('Update dialog deferred: no available parent window', options.title);
    return { response: options.cancelId ?? -1, checkboxChecked: false };
  }
  return dialog.showMessageBox(options);
};
