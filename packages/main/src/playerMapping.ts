import { flag, promisifyAll, promisifyGet, promisifyRun, removeNull, uniqueField } from './db';

import type { NullableOptional, WithRequiredProp } from '/@common/helpers';
import type { PlayerMapping } from '/@common/video';

const enum MappingFlags {
  None = 0,
  // PrimaryDisplay = 1 << 0,
  // SecondaryDisplay = 1 << 1,
  Transparent = 1 << 2,
  Kiosk = 1 << 3,
  AlwaysOnTop = 1 << 4,
}

const toPlayerMapping = (row: NullableOptional): PlayerMapping => {
  const raw = removeNull(row) as Record<string, unknown> | null | undefined;
  const flags = (raw && (raw.flags as number)) || 0;

  return {
    id: raw?.id as number | undefined,
    name: raw?.name as string | null,
    player: raw?.player as number | null,
    left: (raw?.left as number) ?? 0,
    top: (raw?.top as number) ?? 0,
    width: raw?.width as number | null,
    height: raw?.height as number | null,
    display: raw?.display as number | null,
    zOrder: (raw?.zOrder as number) ?? 0,
    zIndex: (raw?.zIndex as number) ?? 0,
    shader: raw?.shader as string | null,
    objectFit: (raw?.objectFit as PlayerMapping['objectFit']) ?? 'cover',
    kiosk: Boolean(flags & MappingFlags.Kiosk),
    transparent: Boolean(flags & MappingFlags.Transparent),
    alwaysOnTop: !(flags & MappingFlags.AlwaysOnTop),
  } as PlayerMapping;
};

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
  $zIndex: props.zIndex ?? 0,
  $shader: props.shader ?? null,
  $objectFit: props.objectFit ?? 'cover',
  $flags:
    flag(props.kiosk, MappingFlags.Kiosk) |
    flag(props.transparent, MappingFlags.Transparent) |
    (props.alwaysOnTop ? 0 : MappingFlags.AlwaysOnTop),
});

export const insertPlayerMapping = promisifyRun(
  `INSERT INTO playerMapping (name, player, left, top, width, height, display, zOrder, zIndex, shader, objectFit, flags)
  VALUES ($name, $player, $left, $top, $width, $height, $display, $zOrder, $zIndex, $shader, $objectFit, $flags)`,
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
      zIndex=$zIndex,
      shader=$shader,
      objectFit=$objectFit,
      flags=$flags
    WHERE id=$id`,
  (id: number, ...[props]: Parameters<typeof playerMappingEncoder>) => ({
    $id: id,
    ...playerMappingEncoder(props),
  }),
);

export const existsPlayerMappingName = promisifyGet(
  'SELECT 1 FROM playerMapping WHERE name = ? AND id != ? LIMIT 1',
  (name: string, id = 0) => [name, id as number],
  result => !!result,
);

export const uniquePlayerMappingName = uniqueField('name', existsPlayerMappingName);
