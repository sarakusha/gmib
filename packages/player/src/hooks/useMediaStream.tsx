import React from 'react';

import { notEmpty } from '/@common/helpers';
import Deferred from '/@common/Deferred';

import VideoSource from '../VideoSource';
import { selectMediaById, useGetMediaQuery } from '../api/media';
import { usePlayer } from '../api/player';
import { useGetPlaylistById } from '../api/playlists';
import updatePlayer from '../api/updatePlayer';
import { useDispatch, useSelector } from '../store';
import { setDuration, setPosition } from '../store/currentSlice';
import { selectPlaybackState } from '../store/selectors';
import { getMediaUri, sourceId } from '../utils';

import { mergeStreams } from '@sarakusha/ebml';
import type { MergeableStream } from '@sarakusha/ebml';

const Context = React.createContext<MediaStream | null>(null);

const useMediaStream = () => React.useContext(Context);

const toOutputQuery = ({ display, ...opts }: OutputQuery): string => {
  const query = new URLSearchParams();
  if (display === true) query.set('display', 'primary');
  if (typeof display === 'number') query.set('display', display.toString());
  Object.entries(opts).forEach(([name, value]) => {
    query.set(name, Number(value).toString());
  });
  return query.toString();
};

type OutputQuery = {
  left?: number;
  top?: number;
  width: number;
  height: number;
  display?: number | boolean;
  kiosk?: boolean;
  transparent?: boolean;
  output_id: number;
};

const outputs: OutputQuery[] = [
  /*   {
    output_id: 1,
    width: 1920 / 2,
    height: 1080 / 2,
    left: 0,
    top: 0,
    display: 2026412505,
    // display: 2779098405,
    kiosk: true,
    // transparent: true,
  }, */
  {
    output_id: 2,
    width: 800,
    height: 600,
    display: false, // 2528732444,
    // display: 458621703,
    // kiosk: true,
  },
];

const createRemotes = (): { window: Window; port: MessagePort; ready: Promise<void> }[] =>
  outputs
    .map(opts => {
      const url = `/output/index.html?${toOutputQuery(opts)}`;
      const { port1, port2 } = new MessageChannel();
      // originAgentCluster
      // crossOriginEmbedderPolicy
      // crossOriginOpenerPolicy
      const win = window.open(url, '_blank');
      // console.log('OPEN', { url, win });
      if (!win) return undefined;
      const deferred = new Deferred();
      win.addEventListener(
        'load',
        () => {
          // console.log('LOADED', url);
          win.postMessage('provide-channel', '*', [port2]);
          deferred.resolve();
        },
        { once: true },
      );
      win.onerror = (ev, source, lineno, colno, error) => {
        deferred.reject(error ?? new Error());
        // console.error(`error while open ${url}`, error);
      };
      return { window: win, port: port1, ready: deferred.promise };
    })
    .filter(notEmpty);

export const VideoProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { data: player } = usePlayer(sourceId);
  const { data: playlist } = useGetPlaylistById(player?.playlistId);
  const { data: mediaData } = useGetMediaQuery();
  const playbackState = useSelector(selectPlaybackState);
  const refStop = React.useRef(false);
  const dispatch = useDispatch();
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const refVideoStream = React.useRef<MergeableStream<VideoFrame>>();
  const refCurrentSource = React.useRef<VideoSource>();
  const refNextSource = React.useRef<VideoSource>();
  const initialize = React.useCallback((mediaStream: MediaStream) => {
    // console.log('INITIALIZE');
    refNextSource.current?.close();
    refNextSource.current = undefined;
    refCurrentSource.current?.close();
    refCurrentSource.current = undefined;
    mediaStream.getTracks().forEach(track => {
      mediaStream.removeTrack(track);
      track.stop();
    });
    const videoStream = mergeStreams<VideoFrame>();
    const trackGenerator = new MediaStreamTrackGenerator({ kind: 'video' });
    videoStream.pipeTo(trackGenerator.writable);
    mediaStream.addTrack(trackGenerator);
    refVideoStream.current = videoStream;
    // trackGenerator.addEventListener('mute', e => {
    //   console.log('MUTED', e);
    // });
    // trackGenerator.addEventListener('unmute', e => {
    //   console.log('UNMUTED', e);
    // });
  }, []);
  React.useEffect(() => {
    // eslint-disable-next-line prefer-const
    let remotes: ReturnType<typeof createRemotes> = [];
    const timer = setTimeout(() => {
      const mediaStream = new MediaStream();
      // console.log('UPDATE STREAM');
      setStream(mediaStream);
      initialize(mediaStream);
      function updateRemote(win: Window) {
        const list = win.document.querySelectorAll('video');
        list.forEach(elem => {
          // eslint-disable-next-line no-param-reassign
          elem.srcObject = mediaStream;
        });
      }
      // remotes = createRemotes();
      remotes.forEach(remote => {
        remote.ready.then(() => updateRemote(remote.window));
      });
    }, 100);
    return () => {
      clearTimeout(timer);
      remotes.forEach(remote => remote.window.close());
    };
  }, [initialize]);
  const { current: videoStream } = refVideoStream;
  const enabled = Boolean(playlist?.items.length) && playbackState !== 'none';
  React.useEffect(() => {
    refStop.current = !enabled;
    stream?.getTracks().forEach(track => {
      // eslint-disable-next-line no-param-reassign
      track.enabled = enabled;
      // console.log(track.muted, track.readyState);
    });
  }, [stream, enabled]);
  if (player && playlist && playlist.items.length && mediaData && videoStream) {
    const { current: currentSource } = refCurrentSource;
    // eslint-disable-next-line no-inner-declarations
    function messageHandler(this: VideoSource, { data }: MessageEvent) {
      // eslint-disable-next-line react/no-this-in-sfc
      const { closed, paused, duration } = this;
      if (typeof data !== 'object' || closed || paused) return;
      if ('timer' in data) {
        dispatch(setPosition(data.timer));
        dispatch(setDuration(duration));
      }
    }
    if (
      !currentSource?.closed &&
      (player.current !== currentSource?.options.index || refStop.current)
    ) {
      refStop.current = false;
      const currentIndex = player.current >= playlist.items.length ? 0 : player.current;
      if (refNextSource.current && refNextSource.current.options.index === currentIndex) {
        currentSource?.close();
      } else {
        refNextSource.current?.close();
        refNextSource.current = undefined;

        const currentItem = playlist.items[currentIndex];
        const uri = getMediaUri(selectMediaById(mediaData, currentItem.md5)?.filename);
        if (uri) {
          const videoSource = new VideoSource(uri, {
            index: currentIndex,
            autoplay: playbackState === 'playing',
            onMessage: messageHandler,
            fade: {
              disableIn: player.disableFadeIn,
              disableOut: player.disableFadeOut,
            },
          });
          if (currentSource && !currentSource.closed) {
            refNextSource.current = videoSource;
            currentSource.close();
          } else {
            refCurrentSource.current = videoSource;
            const updateCurrent = () => {
              const { current: nextSource } = refNextSource;
              if (nextSource) {
                // console.log(new Date().toLocaleTimeString(), nextSource.uri);
                nextSource.play();
                refCurrentSource.current = nextSource;
                refNextSource.current = undefined;
                dispatch(
                  updatePlayer(sourceId, props => ({
                    ...props,
                    current: nextSource.options.index ?? 0,
                  })),
                );
                dispatch(setDuration(nextSource.duration));
                dispatch(setPosition(0));
                videoStream.add(nextSource.readable).then(updateCurrent);
              }
            };
            videoStream.add(videoSource.readable).then(updateCurrent);
          }
        }
      }
    }
    if (!refNextSource.current || refNextSource.current.closed) {
      let nextIndex = player.current + 1;
      if (nextIndex >= playlist.items.length) nextIndex = 0;
      const nextItem = playlist.items[nextIndex];
      const uri = getMediaUri(selectMediaById(mediaData, nextItem.md5)?.filename);
      if (uri) {
        refNextSource.current = new VideoSource(uri, {
          index: nextIndex,
          delay: 1000,
          onMessage: messageHandler,
          fade: {
            disableIn: player.disableFadeIn,
            disableOut: player.disableFadeOut,
          },
        });
      }
    }
    if (
      refCurrentSource.current &&
      (playbackState !== 'playing') !== refCurrentSource.current.paused
    ) {
      if (playbackState === 'playing') refCurrentSource.current.play();
      else refCurrentSource.current.pause();
    }
  } else {
    // if (stream)
    //   stream.getTracks().forEach(track => {
    //     // eslint-disable-next-line no-param-reassign
    //     track.enabled = false;
    //   });
    setTimeout(() => {
      refNextSource.current?.close();
      refNextSource.current = undefined;
      refCurrentSource.current?.close();
      refCurrentSource.current = undefined;
    }, 0);
  }

  return <Context.Provider value={stream}>{children}</Context.Provider>;
};

export default useMediaStream;
