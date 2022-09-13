type ISODate = string;

export type MediaInfo = {
  md5: string;
  filename: string;
  original: {
    md5: string;
    filename: string;
  };
  formatName?: string;
  formatLongName?: string;
  timecode?: number;
  fps?: number;
  duration: number;
  size: number;
  streams: number;
  video?: number;
  audio?: number;
  codecName?: string;
  codecLongName?: string;
  profile?: string;
  width: number;
  height: number;
  fieldOrder?: string;
  uploadTime?: ISODate;
  thumbnail?: string;
};
