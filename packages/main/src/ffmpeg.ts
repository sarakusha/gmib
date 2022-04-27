/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

/**
 * https://github.com/mifi/lossless-cut/blob/master/src/ffmpeg.js
 */

import debugFactory from 'debug';
import isDev from 'electron-is-dev';
import { ExecaChildProcess, ExecaReturnValue, execa } from 'execa';
import { FileTypeResult } from 'file-type/core';
import path from 'path';
import readline from 'readline';
import { fileTypeFromFile } from 'file-type';
import { arch, isMac, isWindows, platform } from '../util/helpers';

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
  profile?: number;
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

const debug = debugFactory('gmib:ffmpeg');

export const getFfCommandLine = (cmd: string, args: string[]): string => {
  const mapArg = (arg: string): string => (/[^0-9a-zA-Z-_]/.test(arg) ? `'${arg}'` : arg);
  return `${cmd} ${args.map(mapArg).join(' ')}`;
};

function getFfPath(cmd: string): string {
  const exeName = isWindows ? `${cmd}.exe` : cmd;

  if (isDev) return path.join('ffmpeg', `${platform}-${arch}`, exeName);
  return path.join(process.resourcesPath, exeName);
}

export const getFfmpegPath = (): string => getFfPath('ffmpeg');
export const getFfprobePath = (): string => getFfPath('ffprobe');

export async function runFfprobe(
  args: string[],
  timeout: number = isDev ? 10000 : 30000
): Promise<ExecaReturnValue> {
  const ffprobePath = getFfprobePath();
  debug(getFfCommandLine('ffprobe', args));
  const ps = execa(ffprobePath, args);
  const timer = setTimeout(() => {
    debug('WARN: killing timed out ffprobe');
    ps.kill();
  }, timeout);
  try {
    return await ps;
  } finally {
    clearTimeout(timer);
  }
}

export function runFfmpeg(args: string[]): ExecaChildProcess {
  const ffmpegPath = getFfmpegPath();
  debug(getFfCommandLine('ffmpeg', args));
  return execa(ffmpegPath, args);
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
  onProgress: (percent: number) => void
): void {
  if (!process.stderr) return;
  onProgress(0);

  const rl = readline.createInterface({ input: process.stderr });
  rl.on('line', line => {
    try {
      // Video: "frame=  839 fps=159 q=-1.0 Lsize=     391kB time=00:00:34.83 bitrate=
      // 92.0kbits/s speed=6.58x"
      let match = line.match(
        /frame=\s*[^\s]+\s+fps=\s*[^\s]+\s+q=\s*[^\s]+\s+(?:size|Lsize)=\s*[^\s]+\s+time=\s*(\d+):(\d+):(\d+\.\d+)\s+/
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
    `Making HTML5 friendly version. filePath: ${filePath}, outPath: ${outPath}, video: ${video}`
  );

  let videoArgs;
  // let audioArgs;

  // h264/aac_at: No licensing when using HW encoder (Video/Audio Toolbox on Mac)
  // https://github.com/mifi/lossless-cut/issues/372#issuecomment-810766512

  const targetHeight = 400;

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
          `scale=-2:${targetHeight},format=yuv420p`,
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
          `scale=-2:${targetHeight},format=yuv420p`,
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
  filePath: string
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

export const getHtml5ifiedPath = (outDir: string, filePath: string): string => {
  const ext = isMac ? 'mp4' : 'mkv';
  return path.join(outDir, `${getFileBaseName(filePath)}.${ext}`);
};

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

export const isStreamThumbnail = (stream: FfprobeStream): boolean =>
  stream?.disposition?.attached_pic === 1;

export const getRealVideoStreams = (streams: FfprobeStream[]): FfprobeStream[] =>
  streams.filter(stream => stream.codec_type === 'video' && !isStreamThumbnail(stream));

// With these codecs, the player will not give a playback error, but instead only play audio
export const doesPlayerSupportFile = (streams: FfprobeStream[]): boolean => {
  const realVideoStreams = getRealVideoStreams(streams);
  // Don't check audio formats, assume all is OK
  if (realVideoStreams.length === 0) return true;
  // If we have at least one video that is NOT of the unsupported formats, assume the player will
  // be able to play it natively https://github.com/mifi/lossless-cut/issues/595
  // https://github.com/mifi/lossless-cut/issues/975 But cover art / thumbnail streams don't count
  // e.g. hevc with a png stream (disposition.attached_pic=1)
  return realVideoStreams.some(
    s => s.codec_name && !['hevc', 'prores', 'mpeg4', 'tscc2'].includes(s.codec_name)
  );
};

const determineOutputFormat = (
  ffprobeFormats: string[],
  fileTypeResponse: FileTypeResult | undefined
): string | undefined =>
  fileTypeResponse?.ext && ffprobeFormats.includes(fileTypeResponse.ext)
    ? fileTypeResponse.ext
    : ffprobeFormats[0];

export async function getSmarterOutFormat(
  filePath: string,
  format: FfprobeFormat
): Promise<string | undefined> {
  const formatsStr = format.format_name ?? '';
  debug(`formats: ${formatsStr}`);
  const formats = formatsStr.split(',');

  // ffprobe sometimes returns a list of formats, try to be a bit smarter about it.
  // const bytes = await readChunk(filePath, { startPosition: 0, length: 4100 });
  const fileTypeResponse = await fileTypeFromFile(filePath);
  debug(`fileType detected format ${JSON.stringify(fileTypeResponse)}`);
  return determineOutputFormat(formats, fileTypeResponse);
}
