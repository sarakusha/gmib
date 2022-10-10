/* eslint-disable no-bitwise */
// import debugFactory from 'debug';

import type { NullableOptional } from '/@common/helpers';
import type { Player, Screen } from '/@common/video';

import db, { flag, promisifyAll, promisifyGet, promisifyRun, removeNull, uniqueField } from './db';

// const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:main`);

const enum ScreenFlags {
  None = 0,
  DownToTop = 1 << 0,
  RightToLeft = 1 << 1,
}

const enum PlayerFlags {
  None = 0,
  AutoPlay = 1 << 0,
  DisableFadeIn = 1 << 1,
  DisableFadeOut = 1 << 2,
  Hidden = 1 << 3,
}

const toScreen = (result: NullableOptional): Omit<Screen, 'addresses'> => {
  const { flags = 0, ...props } = removeNull(result);

  return {
    downToTop: Boolean(flags & ScreenFlags.DownToTop),
    rightToLeft: Boolean(flags & ScreenFlags.RightToLeft),
    ...props,
  };
};

const toPlayer = (result: NullableOptional): Player => {
  const { id, name, playlistId, current, width, height, flags } = removeNull(result);
  return {
    id,
    name,
    playlistId,
    current,
    width,
    height,
    autoPlay: Boolean(flags & PlayerFlags.AutoPlay),
    disableFadeIn: Boolean(flags & PlayerFlags.DisableFadeIn),
    disableFadeOut: Boolean(flags & PlayerFlags.DisableFadeOut),
    hidden: Boolean(flags & PlayerFlags.Hidden),
  };
};

const screenEncoder = (screen: Omit<Screen, 'id' | 'addresses'>) => {
  const {
    name,
    width,
    height,
    moduleWidth,
    moduleHeight,
    left,
    top,
    downToTop,
    rightToLeft,
    borderTop,
    borderBottom,
    borderLeft,
    borderRight,
    brightnessFactor,
    test,
    display,
    brightness,
  } = screen;
  const $flags =
    flag(downToTop, ScreenFlags.DownToTop) + flag(rightToLeft, ScreenFlags.RightToLeft);

  const res = {
    $name: name,
    $width: width,
    $height: height,
    $moduleWidth: moduleWidth,
    $moduleHeight: moduleHeight,
    $left: left,
    $top: top,
    $display: display,
    $borderTop: borderTop,
    $borderBottom: borderBottom,
    $borderLeft: borderLeft,
    $borderRight: borderRight,
    $brightnessFactor: brightnessFactor,
    $flags,
    $test: test,
    $brightness: brightness,
  };
  return res;
};

const playerEncoder = (player: Partial<Omit<Player, 'id'>>) => ({
  $name: player.name,
  $playlistId: player.playlistId,
  $current: player.current,
  $width: player.width,
  $height: player.height,
  $flags:
    flag(player.autoPlay, PlayerFlags.AutoPlay) |
    flag(player.disableFadeIn, PlayerFlags.DisableFadeIn) |
    flag(player.disableFadeOut, PlayerFlags.DisableFadeOut) |
    flag(player.hidden, PlayerFlags.Hidden),
});

export const getScreen = promisifyGet(
  'SELECT * from screen WHERE id = ?',
  (id: number) => id,
  toScreen,
);

export const getScreens = promisifyAll('SELECT * FROM screen', () => {}, toScreen);

export const getAddressesForScreen = promisifyAll(
  'SELECT address FROM address WHERE screenId = ?',
  (id: number) => id,
  result => (result as { address: string }).address,
);

export const loadScreen = async (id: number): Promise<Screen | undefined> => {
  const screen = await getScreen(id);
  if (!screen) return undefined;
  return {
    ...screen,
    addresses: await getAddressesForScreen(screen.id),
  };
};

export const getAddresses = promisifyAll(
  `SELECT address
   FROM address`,
  () => {},
  ({ address }) => address as string,
);

export const existsAddress = promisifyGet(
  'SELECT 1 FROM address WHERE screenId=? AND address=? LIMIT 1',
  (screenId: number, address: string) => [screenId, address],
  result => !!result,
);

export const insertAddress = promisifyRun(
  'INSERT INTO address (address, screenId) VALUES (?, ?)',
  (id: number, address: string) => [address, id],
);

export const deleteAddressesForScreen = promisifyRun(
  'DELETE FROM address WHERE screenId=?',
  (id: number) => id,
);

export const deleteExtraAddresses = (screenId: number, validAddresses?: string[]) =>
  new Promise<{ changes: number }>((resolve, reject) => {
    if (!validAddresses || validAddresses.length === 0) resolve(deleteAddressesForScreen(screenId));
    else
      db.run(
        `DELETE
         FROM address
         WHERE screenId = ?
           AND address NOT IN (${validAddresses.map(address => `"${address}"`).join()})`,
        screenId,
        function cb(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        },
      );
  });

export const getPlayers = promisifyAll('SELECT * FROM player', () => {}, toPlayer);

export const getPlayer = promisifyGet(
  'SELECT * FROM player WHERE id = ? LIMIT 1',
  (id: number) => id,
  toPlayer,
);

export const deletePlayer = promisifyRun(
  `DELETE
   FROM player
   WHERE id = ?`,
  (playerId: number) => playerId,
);

/*
export const deleteAllPlayers = promisifyRun(
  `DELETE
   FROM player
   WHERE screenId = ?`,
  (screenId: number) => screenId,
);
*/

/*
export const deleteExtraPlayers = (screenId: number, validIds?: number[]) =>
  new Promise<{ changes: number }>((resolve, reject) => {
    if (!validIds || validIds.length === 0) resolve(deleteAllPlayers(screenId));
    else
      db.run(
        `DELETE
         FROM player
         WHERE screenId = ?
           AND id NOT IN (${validIds.join()})`,
        screenId,
        function (err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        },
      );
  });
*/

export type CreatePlayer = Partial<Omit<Player, 'id'>>;

export const insertPlayer = promisifyRun(
  `INSERT INTO player (name, playlistId, current, width, height, flags)
   VALUES ($name, $playlistId, $current, $width, $height, $flags)`,
  (player: CreatePlayer) => playerEncoder(player),
);

export const updatePlayer = promisifyRun(
  `UPDATE player
   SET name=$name,
       playlistId=$playlistId,
       "current"=$current,
       width=$width,
       height=$height,
       flags=$flags
   WHERE id = $id`,
  (player: Player) => ({
    $id: player.id,
    ...playerEncoder(player),
  }),
);

export const updateShowPlayer = promisifyRun(
  'UPDATE player SET flags = flags & ? WHERE id = ?',
  (id: number) => [~PlayerFlags.Hidden, id],
);

export const updateHidePlayer = promisifyRun(
  'UPDATE player SET flags = flags | ? WHERE id = ?',
  (id: number) => [PlayerFlags.Hidden, id],
);

export const existsPlayerName = promisifyGet(
  `SELECT 1
   FROM player
   WHERE name = ? AND id != ? LIMIT 1`,
  (name: string, id = 0) => [name, id],
  result => !!result,
);

export const uniquePlayerName = uniqueField('name', existsPlayerName);

export const insertScreen = promisifyRun(
  `INSERT INTO screen (name, width, height, moduleWidth, moduleHeight, "left", top, flags, borderTop,
                       borderBottom, borderLeft, borderRight, display, brightnessFactor, test)
   VALUES ($name, $width, $height, $moduleWidth, $moduleHeight, $left, $top, $flags, $borderTop,
           $borderBottom, $borderLeft, $borderRight, $display, $brightnessFactor, $test)`,
  screenEncoder,
);

export const updateScreen = promisifyRun(
  `UPDATE screen
   SET name=$name,
       width=$width,
       height=$height,
       moduleWidth=$moduleWidth,
       moduleHeight=$moduleHeight,
       "left"=$left,
       top=$top,
       flags=$flags,
       borderTop=$borderTop,
       borderBottom=$borderBottom,
       borderLeft=$borderLeft,
       borderRight=$borderRight,
       display=$display,
       brightnessFactor=$brightnessFactor,
       test=$test,
       brightness=$brightness
   WHERE id = $id`,
  (screen: Omit<Screen, 'addresses'>) => ({ $id: screen.id, ...screenEncoder(screen) }),
);

export const deleteScreen = promisifyRun('DELETE FROM screen WHERE id = ?', (id: number) => id);

export const existsScreenName = promisifyGet(
  `SELECT 1
   FROM screen
   WHERE name = ? AND id != ? LIMIT 1`,
  (name: string, id = 0) => [name, id],
  result => !!result,
);

export const uniqueScreenName = uniqueField('name', existsScreenName);

export const hasPlayers = promisifyGet(
  'SELECT 1 FROM player LIMIT 1',
  () => [],
  result => !!result,
);
