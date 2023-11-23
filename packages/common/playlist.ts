export type PlaylistItem = {
  id: string;
  md5: string;
  flags?: number;
  start?: number;
  duration?: number;
  // rank: number;
};

// export type CreatePlaylistItem = Omit<PlaylistItem, 'rank'>;

type ISODate = string;

export type Playlist = {
  id: number;
  name: string;
  flags: number;
  creationTime?: ISODate;
  lastUsed?: ISODate;
  items: PlaylistItem[];
};

export type CreatePlaylist = Pick<Playlist, 'name' | 'flags'> & {
  items?: Omit<PlaylistItem, 'id'>[];
};
// & {
//   items?: PlaylistItem[];
// };

/*
type UpdateProps<T> = {
  [P in keyof T]?: T[P] | null;
};
*/

// export type PlaylistChanges = Omit<Playlist, 'id'>;

// export type UpdatePlaylist = {
//   id: number;
//   changes: PlaylistChanges;
// };

export type InsertMedia = {
  id: number;
  insert: string[];
};

export type RemoveMedia = {
  id: number;
  itemId: string;
};

// const playlistChangeProps: (keyof PlaylistChanges)[] = [
//   'name',
//   'flags',
//   'creationTime',
//   'lastUsed',
// ];
//
// export const shouldPlaylistUpdate = (changes: PlaylistChanges): boolean =>
//   Object.keys(changes).some(key => playlistChangeProps.includes(key as keyof PlaylistChanges));
