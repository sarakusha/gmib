/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'crypto';
import type { Display } from 'electron';
import { BrowserWindow, app as electronApp, screen } from 'electron';
import fs from 'fs';
import os from 'node:os';
import path from 'path';

import type { SRPServerSessionStep1 } from '@sarakusha/tssrp6a';
import { SRPParameters, SRPRoutines, SRPServerSession } from '@sarakusha/tssrp6a';
import debugFactory from 'debug';
import express from 'express';
import type { File } from 'formidable';
import formidable from 'formidable';
import { nanoid } from 'nanoid';

import type { MediaInfo } from '/@common/mediaInfo';
import { asyncSerial, findById, notEmpty, replaceNull } from '/@common/helpers';
import type { CreatePlaylist, Playlist } from '/@common/playlist';

import auth from './auth';
import { port } from './config';
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
import getAnnounce from './getAnnounce';
import localConfig from './localConfig';
import machineId from './machineId';
import updateMenu from './mainMenu';
import { createTestWindow } from './mainWindow';
import {
  deleteMedia,
  getAllMedia,
  getMediaByMD5,
  getMediaByOriginalMD5,
  insertMedia,
} from './media';
import {
  deletePage,
  getPage,
  getPageByRowID,
  getPages,
  insertPage,
  uniquePageTitle,
  updatePage,
} from './page';
import {
  deletePlayerMapping,
  getPlayerMappingById,
  getPlayerMappings,
  insertPlayerMapping,
  uniquePlayerMappingName,
  updatePlayerMapping,
} from './playerMapping';
import { getPlayerTitle } from './playerWindow';
import {
  deleteAllPlaylistItems,
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
} from './playlist';
import proxyMiddleware from './proxyMiddleware';
import relaunch from './relaunch';
import {
  deleteExtraAddresses,
  deletePlayer,
  deleteScreen,
  existsAddress,
  getAddresses,
  getAddressesForScreen,
  getPlayer,
  getPlayers,
  getPlaylistPlayers,
  getScreens,
  insertAddress,
  insertPlayer,
  insertScreen,
  loadScreen,
  uniquePlayerName,
  uniqueScreenName,
  updatePlayer,
  updateScreen,
} from './screen';

import type { Screen } from '/@common/video';
import { DefaultDisplays } from '/@common/video';

import { setIncomingSecret } from './secret';
import { broadcast } from './server';
import { checkForUpdatesNoInteractive, updateAndRestart } from './updater';
import {
  createSearchParams,
  findPlayerParams,
  findPlayerWindow,
  findScreenParams,
  findScreenWindow,
  isEqualOptions,
  registerScreen,
} from './windowStore';
import './novastarApi';
import { getSensors } from './history';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:api`);

// const peers = new Map<
//   number,
//   // RTCPeerConnection
//   { pc: RTCPeerConnection; candidate: Promise<RTCIceCandidateInit> }
// >();

const sessions = new Map<string, SRPServerSessionStep1>();

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

const noop = (): void => { };

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

const updateTest = async (scr: Screen) => {
  const primary = screen.getPrimaryDisplay();
  const displays = screen.getAllDisplays();
  // debug(`updateTest: ${scr.display}, ${typeof scr.display} ${typeof primary.id}`);

  const { id } = scr;
  const prev = findScreenParams(id);
  const win = prev && BrowserWindow.fromId(prev.id);
  let display: Display | undefined;
  if (!scr.width || !scr.height) {
    if (win) {
      win.close();
    }
    return;
  }
  switch (scr.display) {
    case DefaultDisplays.Primary:
      display = primary;
      break;
    case DefaultDisplays.Secondary:
      display = displays.find(item => item.id !== primary.id);
      break;
    default:
      if (typeof scr.display === 'number') {
        display = findById(displays, scr.display);
      }
      break;
  }
  const page = scr.test ? await getPage(scr.test) : undefined;
  if (!display || !page) {
    win?.hide();
    return;
  }

  const needReload = !win || !prev || !isEqualOptions(scr, prev);
  const params = createSearchParams(scr);
  params.append('port', port.toString());
  const url = (page.permanent ? `${page.url}?${params}` : page.url)?.replaceAll(
    // eslint-disable-next-line no-template-curly-in-string
    '${resources}',
    process.resourcesPath,
  );
  const testWindow =
    win ??
    createTestWindow(
      scr.width,
      scr.height,
      scr.left + display.bounds.x,
      scr.top + display.bounds.y,
    );
  registerScreen(testWindow, scr);
  // screenWindows.set(id, [testWindow, scr]);
  const contents = testWindow.webContents;
  contents.on('did-fail-load', (event, errorCode, errorDescription) => {
    debug(
      `Loading error. url: ${url}, errorCode: ${errorCode}, errorDescription: ${errorDescription}`,
    );
    setTimeout(() => contents.reload(), 5000).unref();
  });
  testWindow.setPosition(scr.left + display.bounds.x, scr.top + display.bounds.y);
  testWindow.setSize(scr.width, scr.height);
  if (page.userAgent && !contents.userAgent.includes(page.userAgent))
    machineId.then(mid => {
      contents.userAgent = `${contents.userAgent} ${page.userAgent} machineid/${mid}`;
    });
  needReload && url && testWindow.loadURL(url);
  testWindow.show();
  // debug(`test: ${url}`);
};

electronApp.whenReady().then(async () => {
  const screens = await getScreens();
  await Promise.all(screens.map(updateTest));
});

const api = express.Router();

if (!localConfig.get('unsafeMode')) {
  api.use(
    auth.unless({
      path: [
        /\/api\/login\/.*/,
        /\/api\/handshake\/.*/,
        '/api/identifier',
        '/api/novastar/subscribe',
      ],
    }),
  );
}

getAnnounce().then(announce => {
  if (announce && typeof announce === 'object' && 'useProxy' in announce) {
    api.use(proxyMiddleware);
    import(import.meta.env.VITE_ANNOUNCE_PROXY).then(({ default: API }) => {
      api.use(import.meta.env.VITE_ANNOUNCE_PATH, API);
    });
  }
});

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
        await asyncSerial(
          Object.values(files).map(file => (Array.isArray(file) ? file[0] : file)),
          file =>
            loadMedia(file).catch(e =>
              debug(`error while loading ${file.originalFilename}: ${e.message}`),
            ),
        )
      ).filter(notEmpty);
      debug(`files uploaded: ${JSON.stringify(loaded)}`);
      getAllMedia().then(result => res.json(result), next);
      broadcast({ event: 'media', remote: req.ip });
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
    broadcast({ event: 'media', remote: req.ip });
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
  const id = +req.params.id;
  deletePlaylist(id).then(result => {
    res.sendStatus(result.changes ? 204 : 404);
    broadcast({ event: 'playlist', remote: req.ip });
  }, next);
});

api.post('/playlist', async (req, res, next) => {
  try {
    const data = await uniquePlaylistName(req.body as CreatePlaylist);
    const { lastID } = await insertPlaylist(data);
    const playlist = await getPlaylist(lastID);
    res.json({ ...playlist, items: [] });
    broadcast({ event: 'playlist', remote: req.ip });
  } catch (e) {
    next(e);
  }
});

const revalidatePlaylist = async (playlist: Playlist): Promise<void> => {
  const players = await getPlaylistPlayers(playlist.id);
  players.forEach(player => {
    const params = findPlayerParams(player.id);
    const win = params && BrowserWindow.fromId(params.id);
    if (win) {
      win.webContents.send('updatePlaylist', playlist);
    }
  });
};

api.put('/playlist', async (req, res, next) => {
  let transaction = false;
  try {
    transaction = await beginTransaction();
    const { items, ...props } = await uniquePlaylistName(req.body as Playlist);
    const { changes } = await updatePlaylist(props);
    if (changes === 0) {
      transaction = await commitTransaction();
      res.sendStatus(404);
      return;
    }
    const { id } = props;
    await deleteAllPlaylistItems(id);
    await asyncSerial(items, (item, index) => insertPlaylistItem(id, index, item));
    transaction = await commitTransaction();
    const playlist = await getPlaylist(id);
    const playlistItems = await getPlaylistItems(id);
    const fullPlaylist = { ...playlist, items: playlistItems };
    res.json(fullPlaylist);
    if (playlist) {
      revalidatePlaylist(fullPlaylist as Playlist).catch(err =>
        debug(`error while revalidate playlist ${id}: ${(err as Error).message}`),
      );
    }
    broadcast({ event: 'playlist', remote: req.ip });
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
    let removeId: string | undefined;
    if ('insert' in req.body) {
      const ids = req.body.insert as string[];
      transaction = await beginTransaction();
      const offset = ((await getLastPlaylistItemPos(id)) ?? -1) + 1;
      await Promise.all(
        ids.map((md5, index) => insertPlaylistItem(id, offset + index, { md5, id: nanoid() })),
      );
      transaction = await commitTransaction();
    } else if ('remove' in req.body) {
      removeId = req.body.remove as string;
      await deletePlaylistItemById(removeId);
    }
    const items = await getPlaylistItems(id);
    const fullPlaylist = { ...playlist, items };
    res.json(fullPlaylist);
    revalidatePlaylist(fullPlaylist).catch(err =>
      debug(`error while revalidate playlist ${id}: ${(err as Error).message}`),
    );
    broadcast({ event: 'playlist', remote: req.ip });
  } catch (err) {
    if (transaction) await rollback();
    next(err);
  }
});

api.get('/screen', (req, res, next) => {
  getScreens()
    .then(screens =>
      Promise.all(
        screens.map(async props => ({
          ...props,
          addresses: await getAddressesForScreen(props.id),
        })),
      ),
    )
    .then(results => res.json(results))
    .catch(next);
});

api.get('/screen/:id', (req, res, next) => {
  loadScreen(+req.params.id)
    .then(props => {
      if (!props) res.sendStatus(404);
      else res.json(props);
    })
    .catch(next);
});

api.post('/screen', async (req, res, next) => {
  try {
    const { lastID } = await insertScreen(await uniqueScreenName(req.body));
    const scr = await loadScreen(lastID);
    scr && updateTest(scr);
    res.json(scr);
    broadcast({ event: 'screen', remote: req.ip });
  } catch (e) {
    next(e);
  }
});

api.delete('/screen/:id', (req, res, next) => {
  const id = +req.params.id;
  const win = findScreenWindow(id);
  if (win) {
    win.close();
  }
  deleteScreen(id)
    .then(({ changes }) => {
      res.sendStatus(changes ? 204 : 404);
      broadcast({ event: 'screen', remote: req.ip });
    })
    .catch(next);
});

api.put('/screen', async (req, res, next) => {
  try {
    const { addresses, ...props } = req.body as Screen;
    const { changes } = await updateScreen(await uniqueScreenName(props));
    if (changes === 0) {
      res.sendStatus(404);
      return;
    }
    if (addresses && addresses.length > 0) {
      await Promise.all(
        addresses.map(async address => {
          if (!(await existsAddress(props.id, address))) {
            await insertAddress(props.id, address);
          }
        }),
      );
    }
    await deleteExtraAddresses(props.id, addresses);
    const result = await loadScreen(props.id);
    result && updateTest(result);
    res.json(result);
    broadcast({ event: 'screen', remote: req.ip });
  } catch (e) {
    debug(`error while update screen: ${e}`);
    next(e);
  }
});

api.get('/address', (req, res, next) => {
  getAddresses()
    .then(addresses => res.json([...new Set(addresses)]))
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
      res.sendStatus(changes ? 204 : 404);
      broadcast({ event: 'player', remote: req.ip });
    })
    .catch(next);
});

api.post('/player', async (req, res, next) => {
  try {
    const { lastID } = await insertPlayer(await uniquePlayerName(req.body));
    const player = await getPlayer(lastID);
    res.json(player);
    broadcast({ event: 'player', remote: req.ip });
  } catch (e) {
    next(e);
  }
});

api.put('/player', async (req, res, next) => {
  try {
    const { changes } = await updatePlayer(await uniquePlayerName(req.body));
    if (!changes) res.sendStatus(404);
    else {
      const { id } = req.body;
      if (!id || typeof id !== 'number') {
        res.sendStatus(400);
        return;
      }
      const player = await getPlayer(id);
      if (!player) res.sendStatus(404);
      else {
        res.json(player);
        broadcast({ event: 'player', remote: req.ip });
        const params = findPlayerParams(player.id);
        const win = params && BrowserWindow.fromId(params.id);
        if (win) {
          win.setTitle(getPlayerTitle(player));
          win.webContents.send('player', player);
        }
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

api.get('/mapping', async (req, res) => res.json(await getPlayerMappings()));

api.post('/mapping', async (req, res, next) => {
  try {
    const data = await uniquePlayerMappingName(req.body);
    const { lastID } = await insertPlayerMapping(data);
    const mapping = await getPlayerMappingById(lastID);
    const win = mapping && findPlayerWindow(mapping.player);
    if (win) win.webContents.send('updateVideoOuts');
    res.json(mapping);
    broadcast({ event: 'mapping', remote: req.ip });
  } catch (e) {
    next(e);
  }
});

api.put('/mapping', async (req, res, next) => {
  try {
    const { id, ...props } = await uniquePlayerMappingName(req.body);
    const { changes } = await updatePlayerMapping(id, props);
    if (!changes) {
      res.sendStatus(404);
      return;
    }
    const mapping = await getPlayerMappingById(id);
    const win = mapping && findPlayerWindow(mapping.player);
    if (win) win.webContents.send('updateVideoOuts');
    res.json(mapping);
    broadcast({ event: 'mapping', remote: req.ip });
  } catch (e) {
    next(e);
  }
});

api.delete('/mapping/:id', async (req, res) => {
  const id = +req.params.id;
  const mapping = await getPlayerMappingById(id);
  if (!mapping) {
    res.sendStatus(404);
  } else {
    await deletePlayerMapping(id);
    broadcast({ event: 'mapping', remote: req.ip });
    const win = mapping && findPlayerWindow(mapping.player);
    if (win) win.webContents.send('updateVideoOuts');
    res.sendStatus(204);
  }
});

api.put('/player/:id/stop', (req, res) => {
  const win = findPlayerWindow(+req.params.id);
  if (win) win.webContents.send('stop', +req.params.id);
  res.end();
});

api.get('/handshake/:id', async (req, res) => {
  const server = new SRPServerSession(new SRPRoutines(new SRPParameters()));
  const salt = localConfig.get('salt');
  const verifier = localConfig.get('verifier');
  if (!salt || !verifier) return res.sendStatus(501);
  const { id } = req.params;
  try {
    const handshake = await server.step1('gmib', BigInt(salt), BigInt(verifier));
    sessions.set(id, handshake);
    setTimeout(() => {
      sessions.delete(id);
    }, 10000).unref();
    return res.json({
      id,
      salt,
      B: `0x${handshake.B.toString(16)}`,
    });
  } catch (e) {
    return res.status(500).send((e as Error).message);
  }
});

api.post('/login/:id', async (req, res) => {
  const { id } = req.params;
  const handshake = sessions.get(id);
  if (!handshake) return res.sendStatus(404);
  const { salt, verifier } = req.body;
  try {
    const A = BigInt(req.body.A);
    const M1 = BigInt(req.body.M1);
    const M2 = await handshake.step2(A, M1);
    if (salt && verifier) {
      localConfig.set('salt', salt);
      localConfig.set('verifier', verifier);
    }
    const apiSecret = await handshake.sessionKey(A);
    await setIncomingSecret(id, apiSecret);
    return res.json({ M2: `0x${M2.toString(16)}` });
  } catch (e) {
    return res.status(401).send(JSON.stringify(e));
  }
});

api.get('/identifier', (req, res) => {
  res.send(localConfig.get('identifier'));
});

api.get('/announce', async (req, res) => {
  const announce = localConfig.get('announce');
  const iv = localConfig.get('iv');
  res.json({
    announce,
    iv,
    key: await machineId,
    autostart: localConfig.get('autostart'),
    info: {
      name: os.hostname().replace(/\.local\.?$/, ''),
      version: import.meta.env.VITE_APP_VERSION,
      platform: os.platform(),
      arch: os.arch(),
    },
  });
});

api.post('/activate', async (req, res) => {
  const { key, name } = req.body;
  const data = {
    key,
    name,
    deviceId: await machineId,
    version: import.meta.env.VITE_APP_VERSION,
    os: os.version(),
  };
  // debug(`activate: ${JSON.stringify(data)}`);
  try {
    const result = await fetch(`${import.meta.env.VITE_LICENSE_SERVER}/api/licenses`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (result.ok) {
      localConfig.store = {
        ...localConfig.store,
        ...replaceNull(await result.json()),
      };
      res.end();
      relaunch();
    } else {
      const message = await result.text();
      const errMsg = `${result.statusText} - ${message} (${import.meta.env.VITE_LICENSE_SERVER})`;
      debug(`ERROR: ${errMsg}`);
      res.status(result.status).send(errMsg);
    }
  } catch (error) {
    const { message } = error as Error;
    res.status(500).send(message);
    debug(`ERROR: ${message}`);
  }
});

api.post('/checkForUpdates', (req, res) => {
  checkForUpdatesNoInteractive().then(
    info => {
      debug(`CHECK: ${JSON.stringify(info)}`);
      res.json(info ?? '');
    },
    err => {
      res.status(500).send((err as Error).message);
    },
  );
});

api.post('/update', (req, res) => {
  updateAndRestart().then(
    () => res.end(),
    err => {
      res.status(500).send((err as Error).message);
    },
  );
});

api.post('/autostart', (req, res) => {
  const { value } = req.body;
  localConfig.set('autostart', !!value);
  res.end();
});

api.post('/relaunch', (req, res) => {
  res.end();
  relaunch();
});

// api.get('/health', (req, res) => {
//   res.json(localConfig)
// })

api.get('/pages', (req, res, next) => {
  getPages().then(pages => res.json(pages), next);
});

api.post('/pages', async (req, res, next) => {
  try {
    const { lastID } = await insertPage(await uniquePageTitle(req.body));
    const page = await getPageByRowID(lastID);
    res.json(page);
    broadcast({ event: 'page', remote: req.ip });
  } catch (e) {
    next(e);
  }
});

api.put('/pages/:id', async (req, res, next) => {
  try {
    const { changes } = await updatePage(await uniquePageTitle({ ...req.body, id: req.params.id }));
    if (!changes) res.sendStatus(404);
    else {
      res.json(await getPage(req.params.id));
      broadcast({ event: 'page', remote: req.ip });
    }
  } catch (e) {
    next(e);
  }
});

api.delete('/pages/:id', async (req, res, next) => {
  try {
    const { changes } = await deletePage(req.params.id);
    res.sendStatus(changes ? 204 : 404);
    broadcast({ event: 'page', remote: req.ip });
  } catch (err) {
    next(err);
  }
});

api.get('/sensors', (req, res, next) => {
  const { after } = req.query;
  const arg = typeof after === 'string' && parseInt(after, 10);
  getSensors(arg || Date.now() - 1000 * 60 * 60 * 24).then(data => res.json(data), next);
});

export default api;
