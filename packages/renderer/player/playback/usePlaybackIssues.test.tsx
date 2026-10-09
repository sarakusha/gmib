import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePlaybackFeatureAvailable, useRetryPlayback } from './usePlaybackIssues';

const mocks = vi.hoisted(() => ({
  version: '5.5.0',
  remote: true,
  status: vi.fn(),
  retry: vi.fn(),
  snackbar: vi.fn(),
}));
vi.mock('/@common/remote', () => ({
  get version() {
    return mocks.version;
  },
  get isRemoteSession() {
    return mocks.remote;
  },
}));
vi.mock('../api/playback', () => ({
  useGetPlaybackStatusQuery: mocks.status,
  useRetryPlaybackMutation: () => [mocks.retry],
}));
vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: mocks.snackbar }) }));

let retry: (mediaId: string) => void;
function Probe() {
  const available = usePlaybackFeatureAvailable();
  retry = useRetryPlayback();
  return <span>{available ? 'available' : 'unsupported'}</span>;
}

describe('playback diagnostics compatibility', () => {
  beforeEach(() => {
    mocks.status.mockReset().mockReturnValue({ isSuccess: true });
    mocks.retry.mockReset().mockReturnValue({ unwrap: () => Promise.resolve() });
    mocks.remote = true;
  });

  it.each([
    ['5.5.0', false],
    ['5.6.0', true],
    ['5.6.3', true],
  ])('gates status, settings availability and retry for remote %s', (version, supported) => {
    mocks.version = version;
    expect(renderToStaticMarkup(<Probe />)).toContain(supported ? 'available' : 'unsupported');
    expect(mocks.status).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ skip: !supported }),
    );
    retry('clip');
    expect(mocks.retry).toHaveBeenCalledTimes(supported ? 1 : 0);
  });
  it('keeps local diagnostics enabled', () => {
    mocks.version = '5.5.0';
    mocks.remote = false;
    expect(renderToStaticMarkup(<Probe />)).toContain('available');
    retry('clip');
    expect(mocks.retry).toHaveBeenCalledOnce();
  });
});
