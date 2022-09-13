/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'crypto';
import { app as electronApp } from 'electron';
import fs from 'fs';
import path from 'path';

import { nanoid } from '@reduxjs/toolkit';
import debugFactory from 'debug';
import express from 'express';
import type { File } from 'formidable';
import formidable from 'formidable';
import pMap from 'p-map';

import type { MediaInfo } from '/@common/mediaInfo';
import { notEmpty } from '/@common/helpers';
import type { CreatePlaylist, Playlist } from '/@common/playlist';

import { beginTransaction, commitTransaction, incrementCounterString, rollback } from './db';
import {
  convertCopy,
  doesPlayerSupportFile,
  generateFromImage,
  getAudioStreams,
  getRealVideoStreams,
  getSmarterOutFormat,
  getStreamFps,
  getTimecodeFromStreams,
  html5ify,
  isDurationValid,
  outExt,
  readFileMeta,
  renderThumbnail,
  renderThumbnailFromImage,
} from './ffmpeg';
import getAllDisplays from './getAllDisplays';
import { updateMenu } from './mainMenu';
import {
  deleteMedia,
  getAllMedia,
  getMediaByMD5,
  getMediaByOriginalMD5,
  insertMedia,
} from './media';
import { getPlayerTitle } from './playerWindow';
import {
  deleteAllPlaylistItems,
  deleteExtraPlaylistItems,
  deletePlaylist,
  deletePlaylistItemById,
  getLastPlaylistItemPos,
  getPlaylist,
  getPlaylistItems,
  getPlaylists,
  insertPlaylist,
  insertPlaylistItem,
  uniquePlaylistName,
  updatePlaylist,
  updatePlaylistItem,
} from './playlist';
import {
  deleteExtraAddresses,
  deletePlayer,
  deleteScreen,
  existsAddress,
  getAddresses,
  getAddressesForScreen,
  getPlayer,
  getPlayers,
  getScreen,
  getScreens,
  insertAddress,
  insertPlayer,
  insertScreen,
  uniquePlayerName,
  uniqueScreenName,
  updatePlayer,
  updateScreen,
} from './screen';

// import updateScreens from './updateScreens';
import type { Screen } from '/@common/video';

import { playerWindows } from './windows';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:api`);

export const mediaRoot = path.join(electronApp.getPath('userData'), 'media');

const resolveMedia = <T>(filename: T): T extends string ? string : T =>
  typeof filename === 'string' ? path.resolve(mediaRoot, filename) : (filename as any);

const thumbFromName = <T>(filepath: T): T extends string ? string : T =>
  typeof filepath === 'string' ? `${filepath}.png` : (filepath as any);

fs.mkdir(mediaRoot, { recursive: true }, err => {
  if (err) {
    debug(`error while create "${mediaRoot}" directory`);
  } else {
    debug(`media store: ${mediaRoot}`);
  }
});

const noop = (): void => {};

const getHash = (filepath: string): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const hashSum = crypto.createHash('md5');
    const stream = fs.createReadStream(filepath);
    stream.on('data', chunk => hashSum.update(chunk));
    stream.once('end', () => resolve(hashSum.digest('hex')));
    stream.once('error', err => reject(err));
  });

const loadMedia = async (file: File, force = false): Promise<MediaInfo> => {
  let { hash } = file;
  if (!hash) hash = await getHash(file.filepath);
  const media = await getMediaByOriginalMD5(hash);
  if (media) {
    if (!force) {
      fs.unlinkSync(file.filepath);
      return media;
    }
    await deleteMedia(hash);
    fs.unlinkSync(resolveMedia(media.filename));
  }
  let md5 = hash;
  let fileMeta = await readFileMeta(file.filepath);
  const fileFormatNew = await getSmarterOutFormat(file.filepath, fileMeta.format);
  debug(`fileFormatNew: ${fileFormatNew}`);
  if (!fileFormatNew) throw new Error('Unable to determine file format');
  let outPath = file.filepath;
  let duration = fileMeta.format.duration !== undefined && parseFloat(fileMeta.format.duration);
  const validDuration = duration && isDurationValid(duration);
  const isImage = !duration && file.mimetype?.startsWith('image/');
  if (!validDuration && !isImage) throw new Error('Unknown duration');
  const original = file.originalFilename ?? file.newFilename;
  let unlink = false;
  const isVideoJsSupported = ['matroska', 'webm'].includes(fileFormatNew);
  const isPlayerSupport = doesPlayerSupportFile(fileMeta.streams);
  if (!isPlayerSupport || !isVideoJsSupported || isImage) {
    debug(`convert ${file.originalFilename} ${file.newFilename}`);
    let { name } = path.parse(original);
    while (fs.existsSync(resolveMedia(`${name}.${outExt}`))) {
      name = incrementCounterString(name);
    }
    outPath = resolveMedia(`${name}.${outExt}`);
    if (isImage) {
      await generateFromImage({ outPath, filePath: file.filepath });
    } else if (!isPlayerSupport) {
      await html5ify({ outPath, filePath: file.filepath, speed: 'slowest', onProgress: noop });
    } else {
      await convertCopy(file.filepath, outPath);
    }
    [fileMeta, md5] = await Promise.all([readFileMeta(outPath), getHash(outPath)]);
    duration = fileMeta.format.duration !== undefined && parseFloat(fileMeta.format.duration);
    unlink = true;
  }
  if (!duration) throw new Error('Unknown duration');
  const { format, streams } = fileMeta;
  const timecode = getTimecodeFromStreams(streams);
  const videoStreams = getRealVideoStreams(streams);
  const audioStreams = getAudioStreams(fileMeta.streams);

  const videoStream = videoStreams[0];
  const audioStream = audioStreams[0];

  const haveVideoStream = !!videoStream;
  // const haveAudioStream = !!audioStream;

  const {
    codec_name: codecName,
    codec_long_name: codecLongName,
    profile,
    width,
    height,
    field_order: fieldOrder,
  } = videoStream ?? {};

  const fps = haveVideoStream ? getStreamFps(videoStream) : undefined;
  const thumbnail = isImage
    ? await renderThumbnailFromImage(file.filepath, thumbFromName(outPath))
    : await renderThumbnail(outPath, 3, thumbFromName(outPath));
  const mediaInfo: MediaInfo = {
    md5,
    filename: path.basename(outPath),
    original: {
      md5: hash,
      filename: original,
    },
    formatName: format.format_name,
    formatLongName: format.format_long_name,
    timecode,
    fps,
    duration,
    size: Number(format.size),
    streams: streams.length,
    video: videoStream?.index,
    audio: audioStream?.index,
    codecName,
    codecLongName,
    profile,
    width: Number(width),
    height: Number(height),
    fieldOrder,
    uploadTime: new Date().toISOString(),
    thumbnail: path.basename(thumbnail),
  };
  await insertMedia(mediaInfo);
  unlink && fs.unlinkSync(file.filepath);
  return mediaInfo;
};

/*
const parseNumber = (value: unknown): number | undefined => {
  if (value == null) return undefined;
  const res = Number(value);
  return Number.isNaN(res) ? undefined : res;
};
*/

const api = express.Router();

api.get('/media', (req, res, next) => {
  // const { skip, take } = req.query;
  getAllMedia().then(result => res.json(result), next);
});

api.get('/media/:id', (req, res, next) => {
  getMediaByMD5(req.params.id).then(result => {
    if (result) res.json(result);
    else res.sendStatus(404);
  }, next);
});

api.post('/media', (req, res, next) => {
  const form = formidable({
    uploadDir: mediaRoot,
    keepExtensions: true,
    multiples: true,
    hashAlgorithm: 'md5',
    maxFileSize: Number.MAX_SAFE_INTEGER,
    filename: (original, ext) => {
      let name = original;
      if (import.meta.env.PROD) {
        while (fs.existsSync(path.join(mediaRoot, `${name}${ext}`))) {
          name = incrementCounterString(name);
        }
      }
      return `${name}${ext}`;
    },
    filter: ({ mimetype, name }) =>
      (mimetype != null && (mimetype.startsWith('image/') || mimetype.startsWith('video/'))) ||
      (name != null && ['.mkv'].includes(path.extname(name))),
  });
  form.parse(req, async (err, fields, files) => {
    if (err) {
      next(err);
    } else {
      // debug(JSON.stringify(files));
      const loaded = (
        await pMap(
          Object.values(files).map(file => (Array.isArray(file) ? file[0] : file)),
          file =>
            loadMedia(file).catch(e =>
              debug(`error while loading ${file.originalFilename}: ${e.message}`),
            ),
          { concurrency: 1 },
        )
      ).filter(notEmpty);
      debug(`files uploaded: ${JSON.stringify(loaded)}`);
      getAllMedia().then(result => res.json(result), next);
    }
  });
});

api.delete('/media/:md5', async (req, res, next) => {
  const { md5 } = req.params;
  const media = await getMediaByMD5(md5);
  const filename = media && resolveMedia(media.filename);
  deleteMedia(md5).then(del => {
    del && debug(`${md5} removed`);
    try {
      const thumbnail = thumbFromName(filename);
      if (filename && fs.existsSync(filename)) {
        fs.unlinkSync(filename);
        debug(`${media.filename} deleted`);
      }
      if (thumbnail && fs.existsSync(thumbnail)) {
        fs.unlinkSync(thumbnail);
        debug(`${path.basename(thumbnail)} deleted`);
      }
    } catch (e: any) {
      debug(`error while deleting file ${filename}: ${e.message}`);
    }
    getAllMedia().then(result => res.json(result), next);
  }, next);
});

api.get('/playlist', (req, res, next) => {
  getPlaylists()
    .then(list =>
      Promise.all(
        list.map(playlist => getPlaylistItems(playlist.id).then(items => ({ ...playlist, items }))),
      ),
    )
    .then(result => res.json(result))
    .catch(next);
});

api.get('/playlist/:id', async (req, res, next) => {
  try {
    const id = +req.params.id;
    const playlist = await getPlaylist(id);
    if (!playlist) {
      return res.sendStatus(404);
    }
    const items = (await getPlaylistItems(id)) ?? [];
    return res.json({ ...playlist, items });
  } catch (err: any) {
    return next(err);
  }
});

api.delete('/playlist/:id', (req, res, next) => {
  deletePlaylist(+req.params.id).then(result => {
    if (result.changes > 0) res.sendStatus(204);
    else res.sendStatus(404);
  }, next);
});

api.post('/playlist', async (req, res, next) => {
  try {
    const data = await uniquePlaylistName(req.body as CreatePlaylist);
    const { lastID } = await insertPlaylist(data);
    const playlist = await getPlaylist(lastID);
    res.json({ ...playlist, items: [] });
  } catch (e) {
    next(e);
  }
});

api.put('/playlist', async (req, res, next) => {
  let transaction = false;
  try {
    transaction = await beginTransaction();
    const { items, ...props } = await uniquePlaylistName(req.body as Playlist);
    const { changes } = await updatePlaylist(props);
    if (changes === 0) {
      res.sendStatus(404);
      return;
    }
    const { id } = props;
    if (items && items.length > 0) {
      await Promise.all(
        items.map((item, index) =>
          updatePlaylistItem(id, index, item).then(
            ({ changes: count }) =>
              count > 0 || insertPlaylistItem(id, index, item, nanoid()).then(() => true),
          ),
        ),
      );
      await deleteExtraPlaylistItems(id, items.length);
    } else {
      await deleteAllPlaylistItems(id);
    }
    transaction = await commitTransaction();
    const playlist = await getPlaylist(id);
    const playlistItems = await getPlaylistItems(id);
    res.json({ ...playlist, items: playlistItems });
  } catch (e) {
    if (transaction) await rollback();
    next(e);
  }
});

api.patch('/playlist/:id', async (req, res, next) => {
  let transaction = false;
  try {
    const id = +req.params.id;
    const playlist = await getPlaylist(id);
    if (!playlist) {
      res.sendStatus(404);
      return;
    }
    if ('insert' in req.body) {
      const ids = req.body.insert as string[];
      transaction = await beginTransaction();
      const offset = ((await getLastPlaylistItemPos(id)) ?? -1) + 1;
      await Promise.all(
        ids.map((md5, index) => insertPlaylistItem(id, offset + index, { md5 }, nanoid())),
      );
      transaction = await commitTransaction();
    } else if ('remove' in req.body) {
      const itemId = req.body.remove as string;
      await deletePlaylistItemById(itemId);
      // const items = await getPlaylistItems(id);
      // if (items.splice(position, 1).length > 0) {
      //   transaction = await beginTransaction();
      //   if (items && items.length > 0) {
      //     await Promise.all(
      //       items.map((item, index) =>
      //         updatePlaylistItem(id, index, item).then(
      //           ({ changes: count }) =>
      //             count > 0 || insertPlaylistItem(id, index, item, nanoid()).then(() => true),
      //         ),
      //       ),
      //     );
      //     await deleteExtraPlaylistItems(id, items.length);
      //   } else {
      //     await deleteAllPlaylistItems(id);
      //   }
      //   transaction = await commitTransaction();
      // }
    }
    const items = await getPlaylistItems(id);
    res.json({ ...playlist, items });
  } catch (err) {
    if (transaction) await rollback();
    next(err);
  }
});

api.get('/screen', (req, res, next) => {
  getScreens()
    .then(screens =>
      Promise.all(
        screens.map(async screen => ({
          ...screen,
          addresses: await getAddressesForScreen(screen.id),
        })),
      ),
    )
    .then(results => res.json(results))
    .catch(next);
});

const loadScreen = async (id: number): Promise<Screen | undefined> => {
  const screen = await getScreen(id);
  if (!screen) return undefined;
  return {
    ...screen,
    addresses: await getAddressesForScreen(screen.id),
  };
};

api.get('/screen/:id', (req, res, next) => {
  debug('GET SCREENS');
  loadScreen(+req.params.id)
    .then(screen => {
      if (!screen) res.sendStatus(404);
      else res.json(screen);
    })
    .catch(next);
});

api.post('/screen', async (req, res, next) => {
  try {
    const { lastID } = await insertScreen(await uniqueScreenName(req.body));
    const screen = await loadScreen(lastID);
    res.json(screen);
    // await updateScreens();
  } catch (e) {
    next(e);
  }
});

api.delete('/screen/:id', (req, res, next) => {
  deleteScreen(+req.params.id)
    .then(({ changes }) => {
      if (changes > 0) res.sendStatus(204);
      else res.sendStatus(404);
      // return updateScreens();
    })
    .catch(next);
});

api.put('/screen', async (req, res, next) => {
  try {
    const { addresses, ...screen } = req.body as Screen;
    const { changes } = await updateScreen(await uniqueScreenName(screen));
    if (changes === 0) {
      res.sendStatus(404);
      return;
    }
    if (addresses && addresses.length > 0) {
      await Promise.all(
        addresses.map(async address => {
          if (!(await existsAddress(screen.id, address))) {
            await insertAddress(screen.id, address);
          }
        }),
      );
    }
    await deleteExtraAddresses(screen.id, addresses);
    // let ids: number[] | undefined;
    // if (players && players.length > 0) {
    //   ids = await Promise.all(
    //     players.map(async player => {
    //       const { changes: count } = await updatePlayer(screen.id, player);
    //       if (count === 0) {
    //         const { lastID } = await insertPlayer(screen.id, player);
    //         return lastID;
    //       }
    //       return player.id;
    //     }),
    //   );
    // }
    // await deleteExtraPlayers(screen.id, ids);
    res.json(await loadScreen(screen.id));
    // await updateScreens();
  } catch (e) {
    next(e);
  }
});

/*
api.patch('/screen/:id', (req, res, next) => {
  const id = +req.params.id;
  insertPlayer({})
    .then(() => loadScreen(id))
    .then(result => res.json(result))
    .catch(next);
});
*/

/*
api.delete('/screen/:screenId/player/:playerId', async (req, res, next) => {
  const screenId = +req.params.screenId;
  const playerId = +req.params.playerId;
  deletePlayer(playerId)
    .then(() => loadScreen(screenId))
    .then(screen => res.json(screen))
    .catch(next);
});
*/

api.get('/address', (req, res, next) => {
  getAddresses()
    .then(addresses => res.json(addresses))
    .catch(next);
});

api.get('/player', (req, res, next) => {
  getPlayers()
    .then(players => res.json(players))
    .catch(next);
});

api.get('/player/:id', (req, res, next) => {
  const id = +req.params.id;
  getPlayer(id)
    .then(player => {
      if (!player) res.sendStatus(404);
      else res.json(player);
    })
    .catch(next);
});

api.delete('/player/:id', (req, res, next) => {
  const id = +req.params.id;
  deletePlayer(id)
    .then(({ changes }) => {
      if (!changes) res.sendStatus(404);
      else res.sendStatus(204);
    })
    .catch(next);
});

api.post('/player', async (req, res, next) => {
  try {
    const { lastID } = await insertPlayer(await uniquePlayerName(req.body));
    const player = await getPlayer(lastID);
    res.json(player);
  } catch (e) {
    next(e);
  }
});

api.put('/player', async (req, res, next) => {
  try {
    const { changes } = await updatePlayer(await uniquePlayerName(req.body));
    if (!changes) res.sendStatus(404);
    else {
      const player = await getPlayer(req.body.id);
      if (!player) res.sendStatus(404);
      else {
        res.json(player);
        const win = playerWindows.get(player.id);
        if (win) win.setTitle(getPlayerTitle(player));
        updateMenu();
      }
    }
  } catch (e) {
    next(e);
  }
});

api.get('/display', (req, res) => {
  res.json(getAllDisplays());
});

export default api;
