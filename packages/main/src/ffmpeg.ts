/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * https://github.com/mifi/lossless-cut/blob/master/src/ffmpeg.js
 */
import os from 'os';
import path from 'path';
import readline from 'readline';

import debugFactory from 'debug';
import type { ExecaChildProcess, ExecaReturnValue } from 'execa';
import execa from 'execa';
import FileType from 'file-type';
import type { FileTypeResult } from 'file-type/core';
import type { FRAMERATE } from 'smpte-timecode';
import Timecode from 'smpte-timecode';
import { inspect } from "util";

export const platform = os.platform();
export const arch = os.arch();
export const isWindows = platform === 'win32';
export const isMac = platform === 'darwin';

export const outExt = 'mkv'; // isMac ? 'mp4' : 'mkv';

export interface FfprobeFormat {
  filename?: string;
  nb_streams?: number;
  nb_programs?: number;
  format_name?: string;
  format_long_name?: string;
  start_time?: string;
  duration?: string;
  size?: string;
  bit_rate?: string;
  probe_score?: number;
  tags?: Record<string, string | number>;

  [key: string]: any;
}

export interface FfprobeStreamDisposition {
  default?: number;
  dub?: number;
  original?: number;
  comment?: number;
  lyrics?: number;
  karaoke?: number;
  forced?: number;
  hearing_impaired?: number;
  visual_impaired?: number;
  clean_effects?: number;
  attached_pic?: number;
  timed_thumbnails?: number;

  [key: string]: any;
}

export interface FfprobeStream {
  index: number;
  codec_name?: string;
  codec_long_name?: string;
  profile?: string;
  codec_type?: string;
  codec_time_base?: string;
  codec_tag_string?: string;
  codec_tag?: string;
  width?: number;
  height?: number;
  coded_width?: number;
  coded_height?: number;
  has_b_frames?: number;
  sample_aspect_ratio?: string;
  display_aspect_ratio?: string;
  pix_fmt?: string;
  level?: number;
  color_range?: string;
  color_space?: string;
  color_transfer?: string;
  color_primaries?: string;
  chroma_location?: string;
  field_order?: string;
  timecode?: string;
  refs?: number;
  id?: string;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  time_base?: string;
  start_pts?: number;
  start_time?: string;
  duration_ts?: string;
  duration?: string;
  bit_rate?: string;
  max_bit_rate?: string;
  bits_per_raw_sample?: string;
  nb_frames?: string;
  nb_read_frames?: string;
  nb_read_packets?: string;
  sample_fmt?: string;
  sample_rate?: number;
  channels?: number;
  channel_layout?: string;
  bits_per_sample?: number;
  disposition?: FfprobeStreamDisposition;
  rotation?: string | number;

  [key: string]: any;
}

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:ffmpeg`);

function parseTimecode(str: string, frameRate?: number): number | undefined {
  // console.log(str, frameRate);
  const t = Timecode(str, frameRate ? (parseFloat(frameRate.toFixed(3)) as FRAMERATE) : undefined);
  if (!t) return undefined;
  const seconds = (t.hours * 60 + t.minutes) * 60 + t.seconds + t.frames / t.frameRate;
  return Number.isFinite(seconds) ? seconds : undefined;
}

export function getStreamFps(stream: FfprobeStream): number | undefined {
  const match =
    typeof stream.avg_frame_rate === 'string' &&
    stream.avg_frame_rate.match(/^([0-9]+)\/([0-9]+)$/);
  if (stream.codec_type === 'video' && match) {
    const num = parseInt(match[1], 10);
    const den = parseInt(match[2], 10);
    if (den > 0) return num / den;
  }
  return undefined;
}

export function getTimecodeFromStreams(streams: FfprobeStream[]): number | undefined {
  // debug('Trying to load timecode');
  let foundTimecode: number | undefined;
  streams.find(stream => {
    try {
      if (stream.tags && stream.tags.timecode) {
        const fps = getStreamFps(stream);
        foundTimecode = parseTimecode(stream.tags.timecode, fps);
        debug(`Loaded timecode ${stream.tags.timecode} from stream ${stream.index}`);
        return true;
      }
      return undefined;
    } catch (err) {
      // console.warn('Failed to parse timecode from file streams', err);
      return undefined;
    }
  });
  return foundTimecode;
}

export const getFfCommandLine = (cmd: string, args: string[]): string => {
  const mapArg = (arg: string): string => (/[^0-9a-zA-Z-_]/.test(arg) ? `'${arg}'` : arg);
  return `${cmd} ${args.map(mapArg).join(' ')}`;
};

function getFfPath(cmd: string): string {
  const exeName = isWindows ? `${cmd}.exe` : cmd;

  if (import.meta.env.DEV) return path.join('ffmpeg', `${platform}-${arch}`, exeName);
  return path.join(process.resourcesPath, exeName);
}

export const getFfmpegPath = (): string => getFfPath('ffmpeg');
export const getFfprobePath = (): string => getFfPath('ffprobe');

export async function runFfprobe(
  args: string[],
  timeout: number = import.meta.env.DEV ? 10000 : 30000,
): Promise<ExecaReturnValue> {
  const ffprobePath = getFfprobePath();
  // debug(getFfCommandLine('ffprobe', args));
  const ps = execa(ffprobePath, args);
  const timer = setTimeout(() => {
    debug('WARN: killing timed out ffprobe');
    ps.kill();
  }, timeout);
  try {
    return await (ps as Promise<ExecaReturnValue>);
  } finally {
    clearTimeout(timer);
  }
}

export function runFfmpeg(args: string[]): ExecaChildProcess {
  const ffmpegPath = getFfmpegPath();
  debug(getFfCommandLine('ffmpeg', args));
  return execa(ffmpegPath, args);
}

export async function renderThumbnailFromImage(
  filePath: string,
  thumbPath: string,
): Promise<string> {
  const args = ['-i', filePath, '-vf', 'scale=-2:100', thumbPath];
  const ffmpegPath = getFfmpegPath();
  await execa(ffmpegPath, args, { encoding: null });
  return thumbPath;
}

export async function renderThumbnail(
  filePath: string,
  timestamp: number,
  thumbPath: string,
): Promise<string> {
  const args = [
    '-ss',
    `${timestamp}`,
    '-i',
    filePath,
    '-vf',
    'scale=-2:100',
    '-f',
    'image2',
    '-vframes',
    '1',
    '-q:v',
    '10',
    thumbPath,
  ];

  const ffmpegPath = getFfmpegPath();
  await execa(ffmpegPath, args, { encoding: null });
  return thumbPath;
}

async function readFormatData(filePath: string): Promise<FfprobeFormat> {
  // debug(`readFormatData ${filePath}`);

  const { stdout } = await runFfprobe([
    '-of',
    'json',
    '-show_format',
    '-i',
    filePath,
    '-hide_banner',
  ]);
  return JSON.parse(stdout).format;
}

export async function getDuration(filePath: string): Promise<number> {
  return parseFloat((await readFormatData(filePath)).duration ?? '0');
}

function handleProgress(
  process: ExecaChildProcess,
  cutDuration: number,
  onProgress: (percent: number) => void,
): void {
  if (!process.stderr) return;
  onProgress(0);

  const rl = readline.createInterface({ input: process.stderr });
  rl.on('line', line => {
    try {
      // Video: "frame=  839 fps=159 q=-1.0 Lsize=     391kB time=00:00:34.83 bitrate=
      // 92.0kbits/s speed=6.58x"
      let match = line.match(
        /frame=\s*[^\s]+\s+fps=\s*[^\s]+\s+q=\s*[^\s]+\s+(?:size|Lsize)=\s*[^\s]+\s+time=\s*(\d+):(\d+):(\d+\.\d+)\s+/,
      );
      // Audio only looks like this: "line size=  233422kB time=01:45:50.68 bitrate= 301.1kbits/s
      // speed= 353x    "
      if (!match)
        match = line.match(/(?:size|Lsize)=\s*[^\s]+\s+time=\s*(\d+):(\d+):(\d+\.\d+)\s+/);
      if (!match) {
        return;
      }

      const hours = +match[1];
      const minutes = +match[2];
      const seconds = +match[3];
      const progressTime = hours * 3600 + minutes * 60 + seconds;
      const progress = cutDuration ? progressTime / cutDuration : 0;
      onProgress(progress);
    } catch (err) {
      debug('Failed to parse ffmpeg progress line', err);
    }
  });
}

type Opts = {
  outPath: string;
  filePath: string;
  speed?: 'slowest' | 'slow';
  onProgress: (percent: number) => void;
};

type ImgOpts = {
  outPath: string;
  filePath: string;
  duration?: number;
};

export async function generateFromImage({
  outPath,
  filePath,
  duration = 5,
}: ImgOpts): Promise<void> {
  debug(`Generate video from image. filePath: ${filePath}, outPath: ${outPath}`);
  const fps = 1 / duration;
  const videoArgs = [
    '-r',
    fps.toFixed(3),
    '-loop',
    '1',
    '-vcodec',
    'libx264',
    '-t',
    duration.toFixed(),
    '-pix_fmt',
    'yuv420p',
  ];
  const ffmpegArgs = ['-hide_banner', '-i', filePath, ...videoArgs, '-an', '-sn', '-y', outPath];

  const process = runFfmpeg(ffmpegArgs);

  const { stdout } = await process;
  debug(stdout);
}

export async function convertCopy(filePath: string, outPath: string): Promise<void> {
  const ffmpegArgs = [
    '-hide_banner',
    '-fflags',
    '+genpts',
    '-i',
    filePath,
    '-vcodec',
    'copy',
    '-an',
    '-sn',
    '-y',
    outPath,
  ];
  const process = runFfmpeg(ffmpegArgs);

  const { stdout } = await process;
  debug(stdout);
}

export async function html5ify({ outPath, filePath, speed, onProgress }: Opts): Promise<void> {
  // let audio;
  // if (hasAudio) {
  //   if (speed === 'slowest') audio = 'hq';
  //   else if (['slow-audio', 'fast-audio', 'fastest-audio'].includes(speed)) audio = 'lq';
  //   else if (['fast-audio-remux', 'fastest-audio-remux'].includes(speed)) audio = 'copy';
  // }

  let video;
  switch (speed) {
    case 'slow':
      video = 'lq';
      break;
    case 'slowest':
      video = 'hq';
      break;
    default:
      video = 'copy';
      break;
  }
  debug(
    `Making HTML5 friendly version. filePath: ${filePath}, outPath: ${outPath}, video: ${video}`,
  );

  let videoArgs;
  // let audioArgs;

  // h264/aac_at: No licensing when using HW encoder (Video/Audio Toolbox on Mac)
  // https://github.com/mifi/lossless-cut/issues/372#issuecomment-810766512

  // const targetHeight = 400;

  switch (video) {
    case 'hq': {
      if (isMac) {
        videoArgs = ['-vf', 'format=yuv420p', '-allow_sw', '1', '-vcodec', 'h264', '-b:v', '15M'];
      } else {
        // AV1 is very slow
        // videoArgs = ['-vf', 'format=yuv420p', '-sws_flags', 'neighbor', '-vcodec', 'libaom-av1',
        // '-crf', '30', '-cpu-used', '8']; Theora is a bit faster but not that much videoArgs =
        // ['-vf', '-c:v', 'libtheora', '-qscale:v', '1']; videoArgs = ['-vf', 'format=yuv420p',
        // '-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-row-mt', '1']; x264 can only be used
        // in GPL projects
        videoArgs = [
          '-vf',
          'format=yuv420p',
          '-c:v',
          'libx264',
          '-profile:v',
          'high',
          '-preset:v',
          'slow',
          '-crf',
          '17',
        ];
      }
      break;
    }
    case 'lq': {
      if (isMac) {
        videoArgs = [
          '-vf',
          // `scale=-2:${targetHeight},format=yuv420p`,
          'format=yuv420p',
          '-allow_sw',
          '1',
          '-sws_flags',
          'lanczos',
          '-vcodec',
          'h264',
          '-b:v',
          '1500k',
        ];
      } else {
        // videoArgs = ['-vf', `scale=-2:${targetHeight},format=yuv420p`, '-sws_flags', 'neighbor',
        // '-c:v', 'libtheora', '-qscale:v', '1']; x264 can only be used in GPL projects
        videoArgs = [
          '-vf',
          // `scale=-2:${targetHeight},format=yuv420p`,
          'format=yuv420p',
          '-sws_flags',
          'neighbor',
          '-c:v',
          'libx264',
          '-profile:v',
          'baseline',
          '-x264opts',
          'level=3.0',
          '-preset:v',
          'ultrafast',
          '-crf',
          '28',
        ];
      }
      break;
    }
    default: {
      videoArgs = ['-vcodec', 'copy'];
      break;
    }
  }

  const ffmpegArgs = ['-hide_banner', '-i', filePath, ...videoArgs, '-an', '-sn', '-y', outPath];

  const duration = await getDuration(filePath);
  const process = runFfmpeg(ffmpegArgs);
  if (duration) handleProgress(process, duration, onProgress);

  const { stdout } = await process;
  debug(stdout);
}

export async function readFileMeta(
  filePath: string,
): Promise<{ streams: FfprobeStream[]; format: FfprobeFormat }> {
  try {
    const { stdout } = await runFfprobe([
      '-of',
      'json',
      '-show_format',
      '-show_entries',
      'stream',
      '-i',
      filePath,
      '-hide_banner',
    ]);

    const { streams = [], format = {} } = JSON.parse(stdout);
    return {
      format,
      streams,
    };
  } catch (err: any) {
    // Windows will throw error with code ENOENT if format detection fails.
    if (err.exitCode === 1 || (isWindows && err.code === 'ENOENT')) {
      throw new Error(`Unsupported file: ${err.message}`);
    }
    throw err;
  }
}

const getFileBaseName = (filePath: string): string => path.parse(filePath).name;

export const getHtml5ifiedPath = (outDir: string, filePath: string): string =>
  path.join(outDir, `${getFileBaseName(filePath)}.${outExt}`);

export const isDurationValid = (duration: number) => Number.isFinite(duration) && duration > 0;

export const isStreamThumbnail = (stream: FfprobeStream): boolean =>
  stream?.disposition?.attached_pic === 1;

export const getAudioStreams = (streams: FfprobeStream[]): FfprobeStream[] =>
  streams.filter(stream => stream.codec_type === 'audio');

export const getRealVideoStreams = (streams: FfprobeStream[]): FfprobeStream[] =>
  streams.filter(stream => stream.codec_type === 'video' && !isStreamThumbnail(stream));

const html5Formats = [
  'av1',
  'h264',
  'h263',
  'mpeg4',
  'mpeg1video',
  'mpeg2video',
  'vp8',
  'vp9',
];

// With these codecs, the player will not give a playback error, but instead only play audio
export const doesPlayerSupportFile = (streams: FfprobeStream[]): boolean => {
  const realVideoStreams = getRealVideoStreams(streams);
  // Don't check audio formats, assume all is OK
  console.log('1', inspect(realVideoStreams, false, null));
  if (realVideoStreams.length === 0) return true;
  // If we have at least one video that is NOT of the unsupported formats, assume the player will
  // be able to play it natively https://github.com/mifi/lossless-cut/issues/595
  // https://github.com/mifi/lossless-cut/issues/975 But cover art / thumbnail streams don't count
  // e.g. hevc with a png stream (disposition.attached_pic=1)
  // return realVideoStreams.some(
  //   s => s.codec_name && !['hevc', 'prores', 'mpeg4', 'tscc2'].includes(s.codec_name),
  // );
  return realVideoStreams.some(s => s.codec_name && html5Formats.includes(s.codec_name));
};

const determineOutputFormat = (
  ffprobeFormats: string[],
  fileTypeResponse: FileTypeResult | undefined,
): string | undefined =>
  fileTypeResponse?.ext && ffprobeFormats.includes(fileTypeResponse.ext)
    ? fileTypeResponse.ext
    : ffprobeFormats[0];

export async function getSmarterOutFormat(
  filePath: string,
  format: FfprobeFormat,
): Promise<string | undefined> {
  const formatsStr = format.format_name ?? '';
  debug(`formats: ${formatsStr}`);
  const formats = formatsStr.split(',');

  // ffprobe sometimes returns a list of formats, try to be a bit smarter about it.
  // const bytes = await readChunk(filePath, { startPosition: 0, length: 4100 });
  const fileTypeResponse = await FileType.fromFile(filePath);
  debug(`fileType: ${JSON.stringify(fileTypeResponse)}`);
  // debug(`fileType detected format ${JSON.stringify(fileTypeResponse)}`);
  return determineOutputFormat(formats, fileTypeResponse);
}
