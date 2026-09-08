import { describe, expect, it } from 'vitest';

import type { Player } from '../../common/video';
import { getBackgroundAutoplayPlayers } from '../src/playerStartup';

const player = (id: number, overrides: Partial<Player> = {}): Player => ({
  id,
  name: `Player ${id}`,
  playlistId: id,
  autoPlay: true,
  ...overrides,
});

describe('getBackgroundAutoplayPlayers', () => {
  it('starts autoplay players that were not restored as visible tabs', () => {
    const players = [player(1), player(2, { name: 'Борода' })];

    expect(getBackgroundAutoplayPlayers(players, [1]).map(({ id }) => id)).toEqual([2]);
  });

  it('starts every eligible autoplay player when no tabs were persisted', () => {
    expect(getBackgroundAutoplayPlayers([player(1), player(2)], []).map(({ id }) => id)).toEqual([
      1, 2,
    ]);
  });

  it('ignores players without autoplay or a playlist', () => {
    const players = [
      player(1, { autoPlay: false }),
      player(2, { playlistId: undefined }),
      player(3),
    ];

    expect(getBackgroundAutoplayPlayers(players).map(({ id }) => id)).toEqual([3]);
  });
});
