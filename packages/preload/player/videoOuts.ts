/* Entry and consumer state intentionally retain identity for asynchronous browser callbacks. */
/* eslint-disable no-param-reassign */
import { ipcRenderer } from 'electron';
import debugFactory from 'debug';
import isEqual from 'lodash/isEqual';

import type { PlayerMapping } from '/@common/video';
import type { OutputHealthProbe, PlayerOutputHealth } from '/@common/outputHealth';
import { attachStreamToVideo, detachStreamFromVideo, getOutputPlaybackState } from './mediaStream';
import OutputRecovery from './outputRecovery';

const sourceId = +(new URLSearchParams(window.location.search).get('source_id') ?? 1);
const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:videoOut`);
const toOutputQuery = (mapping: PlayerMapping): string => {
  const query = new URLSearchParams();
  Object.entries(mapping).forEach(([name, value]) => {
    if (value == null || value === '') return;
    query.set(name, typeof value === 'string' ? value : Number(value).toString());
  });
  return query.toString();
};

type Consumer = {
  video: HTMLVideoElement;
  callback?: number;
  frameCount?: number;
  lastFrame?: number;
};
type Entry = {
  window: Window;
  port: MessagePort;
  transferPort: MessagePort;
  mapping: PlayerMapping;
  loaded: boolean;
  disposed: boolean;
  consumers: Consumer[];
};
const videoOuts = new Map<number, Entry>();
const ladders = new Map<number, OutputRecovery>();
const lastCreated = new Map<number, number>();
let mappings: PlayerMapping[] = [];
let disposed = false;
let probe: OutputHealthProbe = { requestId: 0, hidden: false, unavailableOutputIds: [] };
let pendingUpdate: Promise<void> | undefined;
let pendingCheck: Promise<void> | undefined;
let queuedProbe: OutputHealthProbe | undefined;

const dispose = (entry: Entry, close = true): void => {
  if (entry.disposed) return;
  entry.disposed = true;
  entry.consumers.forEach(({ video, callback }) => {
    if (callback !== undefined) video.cancelVideoFrameCallback?.(callback);
    detachStreamFromVideo(video);
  });
  entry.consumers = [];
  entry.port.close();
  entry.transferPort.close();
  if (videoOuts.get(entry.mapping.id) === entry) videoOuts.delete(entry.mapping.id);
  if (close && !entry.window.closed) entry.window.close();
};

const attach = (entry: Entry): void => {
  if (entry.disposed || !entry.loaded || entry.window.closed) return;
  const videos = Array.from(entry.window.document.querySelectorAll('video'));
  entry.consumers = entry.consumers.filter(consumer => {
    if (videos.includes(consumer.video)) return true;
    if (consumer.callback !== undefined)
      consumer.video.cancelVideoFrameCallback?.(consumer.callback);
    detachStreamFromVideo(consumer.video);
    return false;
  });
  videos.forEach(video => {
    if (entry.consumers.some(consumer => consumer.video === video)) return;
    const consumer: Consumer = { video };
    entry.consumers.push(consumer);
    video.muted = true;
    attachStreamToVideo(video);
    if (typeof video.requestVideoFrameCallback === 'function') {
      const onFrame: VideoFrameRequestCallback = (_, metadata) => {
        if (entry.disposed) return;
        if (metadata.presentedFrames !== consumer.frameCount) consumer.lastFrame = Date.now();
        consumer.frameCount = metadata.presentedFrames;
        consumer.callback = video.requestVideoFrameCallback(onFrame);
      };
      consumer.callback = video.requestVideoFrameCallback(onFrame);
    }
  });
};

const createVideoOut = (mapping: PlayerMapping): void => {
  const now = Date.now();
  const previous = lastCreated.get(mapping.id);
  if (previous !== undefined && now - previous < 30_000) return;
  lastCreated.set(mapping.id, now);
  const { port1, port2 } = new MessageChannel();
  const win = window.open(`/output/index.html?${toOutputQuery(mapping)}`, '_blank');
  if (!win) {
    port1.close();
    port2.close();
    return;
  }
  const entry: Entry = {
    window: win,
    port: port1,
    transferPort: port2,
    mapping,
    loaded: false,
    disposed: false,
    consumers: [],
  };
  videoOuts.set(mapping.id, entry);
  win.addEventListener(
    'load',
    () => {
      if (entry.disposed) return;
      entry.loaded = true;
      try {
        win.postMessage('provide-channel', '*', [port2]);
        attach(entry);
      } catch (error) {
        debug(`output ${mapping.id} load: ${String(error)}`);
      }
    },
    { once: true },
  );
  win.addEventListener('beforeunload', () => dispose(entry, false));
};

export const update = (): Promise<void> => {
  if (pendingUpdate) return pendingUpdate;
  pendingUpdate = (async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const next = await Promise.race<PlayerMapping[]>([
        ipcRenderer.invoke('getPlayerMappings', sourceId),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Output mapping lookup timed out')), 5_000);
        }),
      ]);
      if (disposed) return;
      mappings = next;
      const ids = new Set(next.map(({ id }) => id));
      videoOuts.forEach(entry => {
        if (!ids.has(entry.mapping.id) || entry.window.closed) dispose(entry);
      });
      ladders.forEach((_, id) => {
        if (!ids.has(id)) {
          ladders.delete(id);
          lastCreated.delete(id);
        }
      });
      next.forEach(mapping => {
        const entry = videoOuts.get(mapping.id);
        if (entry && !isEqual(entry.mapping, mapping)) {
          dispose(entry);
          lastCreated.delete(mapping.id);
        }
        if (
          !videoOuts.has(mapping.id) &&
          !probe.hidden &&
          !probe.unavailableOutputIds.includes(mapping.id)
        )
          createVideoOut(mapping);
      });
    } catch (error) {
      debug(String(error));
    } finally {
      clearTimeout(timer);
    }
  })().finally(() => {
    pendingUpdate = undefined;
  });
  return pendingUpdate;
};

const check = async (request: OutputHealthProbe): Promise<void> => {
  probe = request;
  await update();
  if (disposed) return;
  const playback = getOutputPlaybackState();
  const now = Date.now();
  const recovery: string[] = [];
  const outputs: PlayerOutputHealth['outputs'] = mappings.map(mapping => {
    const unavailable = request.unavailableOutputIds.includes(mapping.id);
    const active =
      playback.playbackState === 'playing' && playback.playable && !request.hidden && !unavailable;
    const ladder = ladders.get(mapping.id) ?? new OutputRecovery();
    ladders.set(mapping.id, ladder);
    let entry = videoOuts.get(mapping.id);
    if (entry) {
      try {
        attach(entry);
      } catch (error) {
        debug(String(error));
      }
      entry.consumers.forEach(consumer => {
        const { video } = consumer;
        if (typeof video.requestVideoFrameCallback === 'function') return;
        const quality = video.getVideoPlaybackQuality?.();
        const count = quality && quality.totalVideoFrames - quality.droppedVideoFrames;
        if (count !== undefined && consumer.frameCount !== undefined && count > consumer.frameCount)
          consumer.lastFrame = now;
        consumer.frameCount = count;
      });
    }
    const frames =
      entry?.consumers.map(({ video, lastFrame }) => {
        const stream = video.srcObject as MediaStream | null;
        return stream
          ?.getVideoTracks?.()
          .some(track => track.readyState === 'live' && track.enabled)
          ? lastFrame
          : undefined;
      }) ?? [];
    let lastFrame =
      frames.length && frames.every(frame => frame !== undefined) ? Math.min(...frames) : undefined;
    if (
      entry?.mapping.shader &&
      entry.window.document.documentElement.classList.contains('shader-enabled')
    ) {
      const canvas = entry.window.document.querySelector('canvas');
      const drawn = Number(canvas?.dataset.outputFrameAt);
      lastFrame =
        lastFrame !== undefined && Number.isFinite(drawn) && drawn > 0
          ? Math.min(lastFrame, drawn)
          : undefined;
    }
    const action = ladder.observe(active, lastFrame, now);
    if (action === 'reattach') {
      entry?.consumers.forEach(({ video }) => {
        detachStreamFromVideo(video);
        attachStreamToVideo(video);
      });
      recovery.push(`output ${mapping.id}: reattach`);
    } else if (action === 'recreate') {
      if (entry) dispose(entry);
      createVideoOut(mapping);
      entry = videoOuts.get(mapping.id);
      recovery.push(`output ${mapping.id}: recreate`);
    }
    const state = unavailable
      ? 'unavailable'
      : request.hidden
        ? 'hidden'
        : action === 'exhausted'
          ? 'stalled'
          : !entry
            ? 'missing'
            : active && lastFrame !== undefined && now - lastFrame < 10_000
              ? 'showing'
              : 'starting';
    return {
      id: mapping.id,
      state,
      lastFrameAgeMs: lastFrame === undefined ? undefined : now - lastFrame,
    };
  });
  ipcRenderer.send('player-output:health', {
    requestId: request.requestId,
    ...playback,
    outputs,
    recovery: recovery.length ? recovery.join('; ') : undefined,
  } satisfies PlayerOutputHealth);
};

ipcRenderer.on('updateVideoOuts', () => {
  void update();
});
ipcRenderer.on('player-output:check', (_, request: OutputHealthProbe) => {
  queuedProbe = request;
  if (pendingCheck) return;
  pendingCheck = (async () => {
    while (queuedProbe && !disposed) {
      const next = queuedProbe;
      queuedProbe = undefined;
      await check(next);
    }
  })()
    .catch(error => debug(String(error)))
    .finally(() => {
      pendingCheck = undefined;
    });
});
void update();
window.addEventListener('beforeunload', () => {
  disposed = true;
  videoOuts.forEach(entry => dispose(entry));
  ladders.clear();
});
export default videoOuts;
