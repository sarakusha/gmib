/* eslint-disable no-bitwise */
import { flag, promisifyAll, promisifyGet, promisifyRun, removeNull, uniqueField } from './db';

import type { NullableOptional, WithRequiredProp } from '/@common/helpers';
import type { PlayerMapping } from '/@common/video';

const enum MappingFlags {
  None = 0,
  // PrimaryDisplay = 1 << 0,
  // SecondaryDisplay = 1 << 1,
  Transparent = 1 << 2,
  Kiosk = 1 << 3,
}

const toPlayerMapping = (row: NullableOptional): PlayerMapping => {
  const { flags = 0, ...props } = removeNull(row);
  return {
    ...props,
    kiosk: Boolean(flags & MappingFlags.Kiosk),
  };
};

type CreatePlayerMapping = Partial<Omit<PlayerMapping, 'id' | 'player'>>;

export const getPlayerMappings = promisifyAll(
  'SELECT * FROM playerMapping',
  () => {},
  toPlayerMapping,
);

const playerMappingEncoder = (props: WithRequiredProp<Partial<PlayerMapping>, 'player'>) => ({
  $name: props.name,
  $player: props.player,
  $left: props.left ?? 0,
  $top: props.top ?? 0,
  $width: props.width ?? null,
  $height: props.height ?? null,
  $display: props.display ?? null,
  $zOrder: props.zOrder ?? 0,
  $shader: props.shader ?? null,
  $flags: flag(props.kiosk, MappingFlags.Kiosk),
});

export const insertPlayerMapping = promisifyRun(
  `INSERT INTO playerMapping (name, player, left, top, width, height, display, zOrder, shader, flags)
  VALUES ($name, $player, $left, $top, $width, $height, $display, $zOrder, $shader, $flags)`,
  playerMappingEncoder,
);

export const deletePlayerMapping = promisifyRun(
  'DELETE FROM playerMapping WHERE id = ?',
  (id: number) => id,
);

export const getPlayerMappingById = promisifyGet(
  'SELECT * FROM playerMapping WHERE id = ? LIMIT 1',
  (id: number) => id,
  toPlayerMapping,
);

export const getPlayerMappingsForPlayer = promisifyAll(
  'SELECT * FROM playerMapping WHERE player = ?',
  (id: number) => id,
  toPlayerMapping,
);

export const updatePlayerMapping = promisifyRun(
  `UPDATE playerMapping
    SET
      name=$name,
      player=$player,
      left=$left,
      top=$top,
      width=$width,
      height=$height,
      display=$display,
      zOrder=$zOrder,
      shader=$shader, 
      flags=$flags
    WHERE id=$id`,
  (id: number, ...[props]: Parameters<typeof playerMappingEncoder>) => ({
    $id: id,
    ...playerMappingEncoder(props),
  }),
);

export const existsPlayerMappingName = promisifyGet(
  'SELECT 1 FROM playerMapping WHERE name = ? AND id != ? LIMIT 1',
  (name: string, id = 0) => [name, id],
  result => !!result,
);

export const uniquePlayerMappingName = uniqueField('name', existsPlayerMappingName);
