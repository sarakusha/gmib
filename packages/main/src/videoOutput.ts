/* eslint-disable no-bitwise */
import { flag, promisifyAll, promisifyGet, promisifyRun, removeNull } from './db';

import type { VideoOutput } from '/@common/video';
import type { NullableOptional } from '/@common/helpers';

const enum OutputFlags {
  None = 0,
  PrimaryDisplay = 1 << 0,
  SecondaryDisplay = 1 << 1,
  Transparent = 1 << 2,
  Kiosk = 1 << 3,
}

const toVideoOutput = (row: NullableOptional): VideoOutput => {
  const { flags = 0, display, ...props } = removeNull(row);
  return {
    ...props,
    display:
      // eslint-disable-next-line no-nested-ternary
      flags & OutputFlags.PrimaryDisplay
        ? true
        : flags & OutputFlags.SecondaryDisplay
        ? false
        : display,
    transparent: Boolean(flags & OutputFlags.Transparent),
    kiosk: Boolean(flags & OutputFlags.Kiosk),
  };
};

const videoOutputEncoder = (output: Omit<VideoOutput, 'id'>) => {
  const { name, minWidth, minHeight, left, top, display, kiosk, transparent } = output;
  return {
    $name: name,
    $minWidth: minWidth,
    $minHeight: minHeight,
    $left: left,
    $top: top,
    $display: typeof display === 'number' ? display : null,
    $flags: flag(kiosk, OutputFlags.Kiosk) + flag(transparent, OutputFlags.Transparent),
  };
};

export const getVideoOutputs = promisifyAll('SELECT * FROM videoOutput', () => {}, toVideoOutput);

export const insertVideoOutput = promisifyRun(
  `INSERT INTO videoOutput (name, minWidth, minHeight, "left", top, display, flags)
   VALUES ($name, $minWidth, $minHeight, $left, $top, $display, $flags)`,
  videoOutputEncoder,
);

export const deleteVideoOutput = promisifyRun(
  'DELETE FROM videoOutput WHERE id=?',
  (id: number) => id,
);

export const getVideoOutput = promisifyGet(
  'SELECT * FROM videoOutput WHERE id=? LIMIT 1',
  (id: number) => id,
  toVideoOutput,
);
