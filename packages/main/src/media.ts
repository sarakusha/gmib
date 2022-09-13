import type { NullableOptional } from '/@common/helpers';
import type { MediaInfo } from '/@common/mediaInfo';

import { formatDate, parseDate, promisifyAll, promisifyGet, promisifyRun, removeNull } from './db';

const toMediaInfo = (res: NullableOptional): MediaInfo => {
  const {
    md5,
    filename,
    original_md5: originalMD5,
    original,
    format_name: formatName,
    format_long_name: formatLongName,
    timecode,
    fps,
    duration,
    size,
    streams,
    video,
    audio,
    codec_name: codecName,
    codec_long_name: codecLongName,
    profile,
    width,
    height,
    field_order: fieldOrder,
    upload_time: uploadTime,
    thumbnail,
  } = removeNull(res);
  return {
    md5,
    filename,
    original: {
      md5: originalMD5,
      filename: original,
    },
    formatName,
    formatLongName,
    timecode,
    fps,
    duration,
    size,
    streams,
    video,
    audio,
    codecName,
    codecLongName,
    profile,
    width,
    height,
    fieldOrder,
    uploadTime: parseDate(uploadTime),
    thumbnail,
  } as MediaInfo;
};

export const getMediaByMD5 = promisifyGet(
  'SELECT * from media WHERE md5 = ? LIMIT 1',
  (md5: string) => md5,
  toMediaInfo,
);

export const getMediaByOriginalMD5 = promisifyGet(
  'SELECT * from media WHERE original_md5 = ? LIMIT 1',
  (originalMD5: string) => originalMD5,
  toMediaInfo,
);

export const insertMedia = promisifyRun(
  `INSERT INTO media (md5,
                      filename,
                      original_md5,
                      original,
                      format_name,
                      format_long_name,
                      timecode,
                      fps,
                      duration,
                      size,
                      streams,
                      video,
                      audio,
                      codec_name,
                      codec_long_name,
                      profile,
                      width,
                      height,
                      field_order,
                      upload_time,
                      thumbnail)
   VALUES ($md5,
           $filename,
           $original_md5,
           $original,
           $format_name,
           $format_long_name,
           $timecode,
           $fps,
           $duration,
           $size,
           $streams,
           $video,
           $audio,
           $codec_name,
           $codec_long_name,
           $profile,
           $width,
           $height,
           $field_order,
           $upload_time,
           $thumbnail)`,
  (mediaInfo: MediaInfo) => ({
    $md5: mediaInfo.md5,
    $filename: mediaInfo.filename,
    $original_md5: mediaInfo.original.md5,
    $original: mediaInfo.original.filename,
    $format_name: mediaInfo.formatName,
    $format_long_name: mediaInfo.formatLongName,
    $timecode: mediaInfo.timecode,
    $fps: mediaInfo.fps,
    $duration: mediaInfo.duration,
    $size: mediaInfo.size,
    $streams: mediaInfo.streams,
    $video: mediaInfo.video,
    $audio: mediaInfo.audio,
    $codec_name: mediaInfo.codecName,
    $codec_long_name: mediaInfo.codecLongName,
    $profile: mediaInfo.profile,
    $width: mediaInfo.width,
    $height: mediaInfo.height,
    $field_order: mediaInfo.fieldOrder,
    $upload_time: formatDate(mediaInfo.uploadTime),
    $thumbnail: mediaInfo.thumbnail,
  }),
);

export const deleteMedia = promisifyRun('DELETE FROM media WHERE md5 = ?', (md5: string) => md5);

export const getAllMedia = promisifyAll(
  'SELECT * from media ORDER BY upload_time DESC',
  () => {},
  toMediaInfo,
);
