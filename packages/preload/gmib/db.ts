import { ipcRenderer } from 'electron';

import type { TelemetryOpts } from '/@common/helpers';

// eslint-disable-next-line import/prefer-default-export
export const addTelemetry = (options: TelemetryOpts): void =>
  ipcRenderer.sendSync('addTelemetry', options);
