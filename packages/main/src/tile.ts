import { promisifyAll, promisifyRun, removeNull } from './db';

import type { Tile } from '/@common/video';
import type { NullableOptional } from '/@common/helpers';

const toTile = (row: NullableOptional): Tile => removeNull(row);

const tileEncoder = (tile: Omit<Tile, 'id'>) => {
  const { name, player, sWidth, sHeight, sx, sy, output, dWidth, dHeight, dx, dy } = tile;
  return {
    $name: name,
    $player: player,
    $sWidth: sWidth,
    $sHeight: sHeight,
    $sx: sx,
    $sy: sy,
    $output: output,
    $dWidth: dWidth,
    $dHeight: dHeight,
    $dx: dx,
    $dy: dy,
  };
};

export const getTiles = promisifyAll(
  'SELECT * FROM tile WHERE player = ? AND output = ?',
  (player: number, output: number) => [player, output],
  toTile,
);

export const deleteTile = promisifyRun('DELETE FROM tile WHERE id = ?', (id: number) => id);

export const insertTile = promisifyRun(
  `INSERT INTO tile (name, player, sWidth, sHeight, sx, sy, output, dWidth, dHeight, dx, dy)
   VALUES ($name, $player, $sWidth, $sHeight, $sx, $sy, $output, $dWidth, $dHeight, $dx, $dy)`,
  tileEncoder,
);
