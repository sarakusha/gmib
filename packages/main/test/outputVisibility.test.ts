import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/playbackOutputState', () => ({
  getPlaybackOutputPlayerIds: () => [1, 2],
  invalidatePlaybackOutputs: vi.fn(),
}));
import {
  clearScreenOutputVisibility,
  isOutputHidden,
  isPlayerOutputHidden,
  isScreenOutputHidden,
  revealPlayerOutput,
  setOutputHidden,
  setPlayerOutputHidden,
  setScreenOutputHidden,
} from '../src/outputVisibility';
beforeEach(() => {
  setOutputHidden(false);
  setPlayerOutputHidden(false);
});
describe('explicit plugin output visibility', () => {
  it('shows only the selected screen through a global hide without changing other outputs', () => {
    setOutputHidden(true);
    setScreenOutputHidden(1, false);
    expect(isScreenOutputHidden(1)).toBe(false);
    expect(isScreenOutputHidden(2)).toBe(true);
    expect(isOutputHidden()).toBe(true);
    clearScreenOutputVisibility(1);
    expect(isScreenOutputHidden(1)).toBe(true);
  });
  it('the next global hide takes precedence over explicit plugin shows', () => {
    setOutputHidden(true);
    setScreenOutputHidden(1, false);
    revealPlayerOutput(1);
    setPlayerOutputHidden(false, 1);
    expect(isPlayerOutputHidden(1)).toBe(false);
    expect(isPlayerOutputHidden(2)).toBe(true);
    setOutputHidden(true);
    expect(isScreenOutputHidden(1)).toBe(true);
    expect(isPlayerOutputHidden(1)).toBe(true);
  });
  it('a later per-player hide cancels the explicit show', () => {
    setOutputHidden(true);
    revealPlayerOutput(1);
    setPlayerOutputHidden(false, 1);
    expect(isPlayerOutputHidden(1)).toBe(false);
    setPlayerOutputHidden(true, 1);
    expect(isPlayerOutputHidden(1)).toBe(true);
    setOutputHidden(false);
    expect(isPlayerOutputHidden(1)).toBe(true);
  });
});
