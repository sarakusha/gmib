import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import debugFactory from 'debug';
import type { File } from 'formidable';

import { getImageImportError, MAX_IMAGE_PIXELS } from '/@common/imageImportLimits';
import type { MediaInfo } from '/@common/mediaInfo';

import { incrementCounterString } from './db';
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
import { getMediaByOriginalMD5, insertMedia } from './media';
import { inspectImageImport, removeImportFile } from './mediaImportSafety';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:mediaImport`);
const noop = (): void => {};

const getHash = (filepath: string): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const hashSum = crypto.createHash('md5');
    const stream = fs.createReadStream(filepath);
    stream.on('data', chunk => hashSum.update(chunk));
    stream.once('end', () => resolve(hashSum.digest('hex')));
    stream.once('error', err => reject(err));
  });

const importMedia = async (file: File, mediaRoot: string): Promise<MediaInfo> => {
  const resolveMedia = (filename: string) => path.resolve(mediaRoot, filename);
  const unusedOutputPath = (filename: string): string => {
    const parsed = path.parse(filename);
    let { name } = parsed;
    let candidate = resolveMedia(`${name}${parsed.ext}`);
    while (fs.existsSync(candidate) || fs.existsSync(`${candidate}.png`)) {
      name = incrementCounterString(name);
      candidate = resolveMedia(`${name}${parsed.ext}`);
    }
    return candidate;
  };
  let { hash } = file;
  if (!hash) hash = await getHash(file.filepath);
  const media = await getMediaByOriginalMD5(hash);
  if (media) {
    fs.unlinkSync(file.filepath);
    return media;
  }
  const imageDimensions = await inspectImageImport(file);
  let md5 = hash;
  let fileMeta = await readFileMeta(file.filepath, imageDimensions ? MAX_IMAGE_PIXELS : undefined);
  const fileFormatNew = await getSmarterOutFormat(file.filepath, fileMeta.format);
  debug(`fileFormatNew: ${fileFormatNew}`);
  if (!fileFormatNew) throw new Error('Unable to determine file format');
  let outPath: string;
  let duration = fileMeta.format.duration !== undefined && parseFloat(fileMeta.format.duration);
  const validDuration = duration && isDurationValid(duration);
  const isImage = imageDimensions !== undefined;
  if (isImage) {
    const video = fileMeta.streams.find(stream => stream.codec_type === 'video');
    const dimensionError = getImageImportError(video?.width, video?.height);
    if (dimensionError) throw new Error(dimensionError);
    if (video?.width !== imageDimensions.width || video?.height !== imageDimensions.height) {
      throw new Error(
        'Размеры изображения в заголовке и медиапотоке не совпадают. Сохраните изображение заново и повторите загрузку.',
      );
    }
  }
  if (!validDuration && !isImage) throw new Error('Unknown duration');
  const original = file.originalFilename ?? file.newFilename;
  let unlink = false;
  const artifacts: string[] = [];
  let committed = false;
  try {
    const isVideoJsSupported = ['matroska', 'webm'].includes(fileFormatNew);
    const isPlayerSupport = doesPlayerSupportFile(fileMeta.streams);
    if (!isPlayerSupport || !isVideoJsSupported || isImage) {
      debug(`convert ${file.originalFilename} ${file.newFilename}`);
      outPath = unusedOutputPath(`${path.parse(original).name}.${outExt}`);
      artifacts.push(outPath);
      if (isImage) {
        await generateFromImage({ outPath, filePath: file.filepath });
      } else if (!isPlayerSupport) {
        await html5ify({ outPath, filePath: file.filepath, speed: 'slowest', onProgress: noop });
      } else {
        await convertCopy(file.filepath, outPath);
      }
      fileMeta = await readFileMeta(outPath, imageDimensions ? MAX_IMAGE_PIXELS : undefined);
      md5 = await getHash(outPath);
      duration = fileMeta.format.duration !== undefined && parseFloat(fileMeta.format.duration);
      unlink = true;
    } else {
      // Supported media needs no conversion, but must leave the private upload directory.
      outPath = unusedOutputPath(original);
      await fs.promises.rename(file.filepath, outPath);
      artifacts.push(outPath);
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
    artifacts.push(`${outPath}.png`);
    const thumbnail = isImage
      ? await renderThumbnailFromImage(file.filepath, `${outPath}.png`)
      : await renderThumbnail(outPath, 3, `${outPath}.png`);
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
    committed = true;
    if (unlink) await removeImportFile(file.filepath);
    return mediaInfo;
  } finally {
    if (!committed) await Promise.all(artifacts.map(removeImportFile));
  }
};

// One queue for every HTTP request. A rejection must never poison subsequent uploads.
let importTail: Promise<unknown> = Promise.resolve();
export const loadMedia = (file: File, mediaRoot: string): Promise<MediaInfo> => {
  const result = importTail.then(() => importMedia(file, mediaRoot));
  importTail = result.catch(() => undefined);
  return result;
};
