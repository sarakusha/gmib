export declare namespace MP4Box {
  type Nalu = {
    length: number;
    nalu: Uint8Array;
  };

  interface AVCC {
    configurationVersion: number;
    AVCProfileIndication: number;
    profile_compatibility: number;
    AVCLevelIndication: number;
    lengthSizeMinusOne: number;
    nb_SPS_nalus: number;
    SPS: Nalu[];
    nb_PPS_nalus: number;
    PPS: Nalu[];
    ext?: Uint8Array;
    write(stream: DataStream): void;
  }

  interface Track {
    id: number;
    created: Date;
    modified: Date;
    movie_duration: number;
    movie_timescale: number;
    layer: number;
    alternate_group: number;
    volume: number;
    track_width: number;
    track_height: number;
    timescale: number;
    duration: number;
    bitrate: number;
    codec: string;
    kind: unknown;
    language: string;
    nb_samples: number;
    size: number;
    matrix: unknown;
    cts_shift: unknown;
    samples_duration: unknown;
    mime: string;
  }

  interface VideoTrack extends Track {
    video: {
      width: number;
      height: number;
    };
    type: 'video';
  }

  interface AudioTrack extends Track {
    audio: {
      sample_rate: number;
      channel_count: number;
      sample_size: number;
    };
    type: 'audio';
  }

  interface SubtitleTrack extends Track {
    type: 'subtitles';
  }

  interface MetadataTrack extends Track {
    type: 'metadata';
  }

  interface Info {
    hasMoove: boolean;
    duration: number;
    timescale: number;
    isFragmented: boolean;
    isProgressive: boolean;
    hasIOD: boolean;
    brands: string[];
    created: Date;
    modified: Date;
    tracks: Track[];
    audioTracks: AudioTrack[];
    videoTracks: VideoTrack[];
    subtitleTracks: SubtitleTrack[];
  }

  type ArrayBufferEx = ArrayBuffer & { fileStart: number };

  type Options = {
    /**
     * representing the number of samples per callback call. If not enough data is received to extract the number of samples, the samples received so far are kept. If not provided, the default is 1000.
     */
    nbSamples?: number;
    /**
     * indicating if sample arrays should start with a RAP. If not provided, the default is true.
     */
    rapAlignement?: boolean;
  };

  type Segmentation = {
    /**
     * the track id
     */
    id: number;
    /**
     * the caller of the segmentation for this track, as given in setSegmentOptions
     */
    user: unknown;
    /**
     * the initialization segment for this track
     */
    buffer: ArrayBuffer;
    /**
     * sample number of the last sample in the segment, plus 1
     */
    sampleNumber: number;
  };

  interface Sample {
    track_id: number;
    description: { avcC?: AVCC; [string]: any };
    is_rap: boolean;
    timescale: number;
    dts: number;
    cts: number;
    duration: number;
    size: number;
    data: ArrayBuffer;
    is_sync: boolean;
    is_leading: number;
  }

  interface ISOFile {
    onError?: ((reason: string) => void) | null;

    onReady?: (info: Info) => void;

    onSamples?: (trackId: number, user: unknown, samples: Sample[]) => void;

    appendBuffer(data: ArrayBufferEx, last?: boolean): void;

    start(): void;

    stop(): void;

    flush(): void;

    onSegment: (
      id: number,
      user: unknown,
      buffer: ArrayBufferEx,
      sampleNumber?: number,
      last?: boolean,
    ) => void;

    setSegmentOptions(trackId: number, user?: unknown, options?: Options): void;

    unsetSegmentOptions(trackId: number): void;

    initializeSegmentation(): Segmentation[];

    setExtractionOptions(trackId: number, user?: unknown, options?: Options): void;

    unsetExtractionOptions(trackId: number): void;

    moov?: any;

    stream: { isEos(): boolean };
  }

  interface Log {
    readonly LOG_LEVEL_ERROR: 4;
    readonly LOG_LEVEL_WARNING: 3;
    readonly LOG_LEVEL_INFO: 2;
    readonly LOG_LEVEL_DEBUG: 1;

    setLogLevel(level: number): void;
    debug: (log: string) => void;
  }
}

export declare class DataStream {
  static BIG_ENDIAN = false;

  static LITTLE_ENDIAN = true;

  constructor(length?: number, byteOffset?: number, endianness?: boolean);
  constructor(arrayBuffer: ArrayBuffer, byteOffset?: number, endianness?: boolean);

  endianness: boolean;

  readonly byteLength: number;

  buffer: ArrayBuffer;

  dataView: DataView;
}

export declare function createFile(): MP4Box.ISOFile;

export declare const Log: MP4Box.Log;
