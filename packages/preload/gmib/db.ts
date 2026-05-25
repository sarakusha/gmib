import { ipcRenderer } from 'electron';

import type { TelemetryOpts } from '/@common/helpers';

export const addTelemetry = (options: TelemetryOpts): void => {
  ipcRenderer.sendSync('addTelemetry', options);
};
