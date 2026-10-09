import { beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});
it('keeps confirmation and in-flight probes for repeated visibility intent, invalidating actual changes only', async () => {
  const state = await import('../src/playbackOutputState');
  const visibility = await import('../src/outputVisibility');
  state.setPlaybackOutputs(1, [{ id: 2, name: 'Main', state: 'showing' }]);
  const invalidated = vi.fn();
  state.onPlaybackOutputsInvalidated(invalidated);
  visibility.setPlayerOutputHidden(false, 1);
  expect(invalidated).not.toHaveBeenCalled();
  expect(state.getPlaybackOutputs(1)[0]?.state).toBe('showing');
  visibility.setPlayerOutputHidden(true, 1);
  expect(invalidated).toHaveBeenCalledTimes(1);
  expect(state.getPlaybackOutputs(1)[0]?.state).toBe('hidden');
  visibility.setPlayerOutputHidden(true, 1);
  expect(invalidated).toHaveBeenCalledTimes(1);
  visibility.setPlayerOutputHidden(false, 1);
  expect(invalidated).toHaveBeenCalledTimes(2);
  expect(state.getPlaybackOutputs(1)[0]?.state).toBe('unknown');
});
it('does not invalidate an already hidden player when global visibility changes', async () => {
  const state = await import('../src/playbackOutputState');
  const visibility = await import('../src/outputVisibility');
  state.setPlaybackOutputs(1, [{ id: 2, name: 'Main', state: 'showing' }]);
  visibility.setPlayerOutputHidden(true, 1);
  const invalidated = vi.fn();
  state.onPlaybackOutputsInvalidated(invalidated);
  visibility.setOutputHidden(true);
  visibility.setOutputHidden(true);
  visibility.setOutputHidden(false);
  expect(invalidated).not.toHaveBeenCalled();
  expect(state.getPlaybackOutputs(1)[0]?.state).toBe('hidden');
});
