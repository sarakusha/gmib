// import { nanoid } from 'nanoid';

import type { NullableOptional } from '/@common/helpers';
import type { CreatePlaylist, Playlist, PlaylistItem } from '/@common/playlist';

import { promisifyAll, promisifyGet, promisifyRun, removeNull, uniqueField } from './db';

const toPlaylist = (res: NullableOptional): Omit<Playlist, 'items'> => {
  const { id, name, flags, creation_time: creationTime, last_used: lastUsed } = removeNull(res);
  return {
    id,
    name,
    flags,
    creationTime,
    lastUsed,
  };
};

const toPlaylistItem = (res: NullableOptional): PlaylistItem => {
  const { media_md5: md5, flags, start, duration, id } = removeNull(res);
  return { md5, flags, start, duration, id } as PlaylistItem;
};

export const getPlaylist = promisifyGet(
  'SELECT * FROM playlist WHERE id = ? LIMIT 1',
  (id: number) => id,
  toPlaylist,
);

export const getPlaylists = promisifyAll('SELECT * FROM playlist', () => [], toPlaylist);

export const getPlaylistItems = promisifyAll(
  'SELECT rowid, * from playlistToMedia WHERE playlist_id = ? ORDER BY pos',
  (id: number) => id,
  toPlaylistItem,
);

export const deletePlaylist = promisifyRun('DELETE FROM playlist WHERE id = ?', (id: number) => id);

export const insertPlaylist = promisifyRun(
  `INSERT INTO playlist (name, flags, creation_time)
   VALUES ($name, $flags, datetime('now'))`,
  (params: CreatePlaylist) => ({
    $name: params.name,
    $flags: params.flags,
  }),
);

export const updatePlaylist = promisifyRun(
  'UPDATE playlist SET name=$name, flags=$flags, last_used=$lastUsed WHERE id=$id',
  (playlist: Omit<Playlist, 'items' | 'creationTime'>) => ({
    $id: playlist.id,
    $name: playlist.name,
    $flags: playlist.flags,
    $lastUsed: playlist.lastUsed,
  }),
);

const playlistItemEncoder = (
  playlistId: number,
  pos: number,
  item: PlaylistItem,
) => ({
  $id: item.id,
  $playlistID: playlistId,
  $pos: pos,
  $md5: item.md5,
  $flags: item.flags ?? 0,
  $start: item.start ?? null,
  $duration: item.duration ?? null,
});

// export const updatePlaylistItem = promisifyRun(
//   `UPDATE playlistMedia
//    SET flags=$flags,
//        start=$start,
//        duration=$duration,
//        media_md5=$md5,
//        id=$id
//    WHERE playlist_id = $playlistID
//      AND pos = $pos`,
//   playlistItemEncoder,
// );

export const insertPlaylistItem = promisifyRun(
  `INSERT INTO playlistToMedia (id, playlist_id, media_md5, flags, start, duration, pos)
   VALUES ($id, $playlistID, $md5, $flags, $start, $duration, $pos)`,
  playlistItemEncoder,
);

export const deletePlaylistItemById = promisifyRun(
  'DELETE FROM playlistToMedia WHERE id = ?',
  (itemId: string) => itemId,
);

export const deleteAllPlaylistItems = promisifyRun(
  'DELETE FROM playlistToMedia WHERE playlist_id = ?',
  (id: number) => id,
);

// export const deleteExtraPlaylistItems = promisifyRun(`
//   DELETE FROM playlistToMedia WHERE pos = 
//   (SELECT pos FROM 
//     (SELECT ROW_NUMBER() OVER (ORDER BY pos ASC) AS rowNumber, pos FROM playlistToMedia)
//     WHERE rowNumber > ?)`,
//   (id: number, from: number) => [id, from],
// );

export const existsPlaylistName = promisifyGet(
  'SELECT 1 FROM playlist WHERE name=? AND id != ? LIMIT 1',
  (name: string, id = 0) => [name, id],
  result => !!result,
);

export const getLastPlaylistItemPos = promisifyGet(
  'SELECT MAX(pos) AS max FROM playlistToMedia WHERE playlist_id = ?',
  (id: number) => id,
  result => result?.max as number,
);

export const uniquePlaylistName = uniqueField('name', existsPlaylistName);

// export const removeItemFromPlaylist = promisifyRun(
//   'DELETE FROM playlistMedia WHERE playlist_id = ? AND  = (SELECT ID FROM (SELECT ID FROM PROTOTYPE_1 ORDER BY ID LIMIT 1,1) AS T)',
// );
