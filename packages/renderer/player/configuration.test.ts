import { describe, expect, it } from 'vitest';

import { createPlayerConfiguration, parsePlayerConfiguration } from '/@common/playerConfiguration';
import type { DisplayType, Player, PlayerMapping } from '/@common/video';

const displays: DisplayType[] = [
  {
    id: 10,
    primary: true,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    displayFrequency: 60,
    internal: false,
  },
  {
    id: 11,
    bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
    workArea: { x: 1920, y: 0, width: 1920, height: 1040 },
    displayFrequency: 60,
    internal: false,
  },
  {
    id: 12,
    bounds: { x: 3840, y: 0, width: 1920, height: 1080 },
    workArea: { x: 3840, y: 0, width: 1920, height: 1040 },
    displayFrequency: 60,
    internal: false,
  },
];

const players: Player[] = [
  {
    id: 4,
    name: 'Main',
    playlistId: 98,
    current: 'runtime-item',
    width: 1280,
    height: 720,
    autoPlay: true,
    disableFadeIn: false,
    playbackEngine: 'capture',
    hidden: true,
  } as Player,
];
const mappings: PlayerMapping[] = [
  {
    id: 20,
    name: 'Primary output',
    player: 4,
    left: 0,
    top: 0,
    width: 1920,
    height: 1080,
    display: 10,
    kiosk: true,
    shader: 'return color;',
    objectFit: 'contain',
  },
  {
    id: 21,
    name: 'Secondary output',
    player: 4,
    left: 1920,
    top: 0,
    display: 11,
    kiosk: false,
    zIndex: 2,
  },
  { id: 22, name: 'Portable default', player: 4, left: 0, top: 1080, display: 0, kiosk: false },
  { id: 23, name: 'Third display', player: 4, left: 3840, top: 0, display: 12, kiosk: false },
];

describe('player configuration', () => {
  it('roundtrips whitelisted settings and maps primary and secondary displays portably', () => {
    const exported = createPlayerConfiguration(players, mappings, displays);
    expect(exported).toMatchObject({
      format: 'gmib-player-configuration',
      version: 1,
      players: [
        {
          settings: {
            name: 'Main',
            width: 1280,
            height: 720,
            autoPlay: true,
            disableFadeIn: false,
            playbackEngine: 'capture',
          },
          mappings: [
            { name: 'Primary output', display: -1, shader: 'return color;', objectFit: 'contain' },
            { name: 'Secondary output', display: -2, zIndex: 2, kiosk: false },
            { name: 'Portable default', display: 0, kiosk: false },
            { name: 'Third display', kiosk: false },
          ],
        },
      ],
      warnings: ['Привязки к дисплеям кроме основного и первого дополнительного сброшены (1)'],
    });
    expect(parsePlayerConfiguration(exported)).toEqual(exported);
  });

  it('does not export runtime identifiers, host display identifiers, or unlisted fields', () => {
    const exported = createPlayerConfiguration(players, mappings, displays);
    const serialized = JSON.stringify(exported);
    for (const value of [
      'playlistId',
      'current',
      'hidden',
      'runtime-item',
      '"id":20',
      '"player":4',
      '"display":10',
    ]) {
      expect(serialized).not.toContain(value);
    }
    expect(exported.players[0].mappings[3].display).toBeUndefined();
  });

  it('strips extra runtime and identity fields while parsing', () => {
    const parsed = parsePlayerConfiguration({
      format: 'gmib-player-configuration',
      version: 1,
      players: [
        {
          id: 88,
          playlistId: 77,
          current: 'secret-runtime',
          hidden: true,
          settings: {
            id: 88,
            playlistId: 77,
            current: 'secret-runtime',
            hidden: true,
            name: 'P',
            width: 640,
            height: 480,
            autoPlay: false,
            ignored: 'secret',
          },
          mappings: [
            {
              id: 2,
              player: 88,
              name: 'M',
              left: 0,
              top: 0,
              display: -1,
              kiosk: false,
              ignored: 'secret',
            },
          ],
        },
      ],
    });
    expect(parsed.players[0]).toEqual({
      settings: { name: 'P', width: 640, height: 480, autoPlay: false },
      mappings: [{ name: 'M', left: 0, top: 0, display: -1, kiosk: false }],
    });
    expect(JSON.stringify(parsed)).not.toContain('secret');
  });

  it.each([
    [null, /не является конфигурацией/],
    [{ format: 'wrong', version: 1, players: [] }, /не является конфигурацией/],
    [{ format: 'gmib-player-configuration', version: 2, players: [] }, /версия/],
    [{ format: 'gmib-player-configuration', version: 1, players: {} }, /массив/],
    [
      {
        format: 'gmib-player-configuration',
        version: 1,
        players: [{ settings: {}, mappings: [{ name: 'M', left: 0, top: 0, display: 9 }] }],
      },
      /display/,
    ],
    [
      {
        format: 'gmib-player-configuration',
        version: 1,
        players: [{ settings: { autoPlay: 'yes' }, mappings: [] }],
      },
      /логическое/,
    ],
    [
      {
        format: 'gmib-player-configuration',
        version: 1,
        players: [{ settings: { playbackEngine: 'unknown' }, mappings: [] }],
      },
      /режим/,
    ],
    [
      {
        format: 'gmib-player-configuration',
        version: 1,
        players: [{ settings: { width: 3, height: 480 }, mappings: [] }],
      },
      /чётным целым/,
    ],
    [
      {
        format: 'gmib-player-configuration',
        version: 1,
        players: [{ settings: {}, mappings: [{ name: 'M', left: Infinity, top: 0 }] }],
      },
      /конечное число/,
    ],
    [
      {
        format: 'gmib-player-configuration',
        version: 1,
        players: [{ settings: {}, mappings: [{ name: 'M', left: 0, top: 0, width: 0 }] }],
      },
      /больше нуля/,
    ],
    [
      {
        format: 'gmib-player-configuration',
        version: 1,
        players: [
          { settings: {}, mappings: [{ name: 'M', left: 0, top: 0, objectFit: 'stretch' }] },
        ],
      },
      /objectFit/,
    ],
  ])('rejects invalid configuration %#', (value, message) => {
    expect(() => parsePlayerConfiguration(value)).toThrow(message);
  });

  it('rejects exports that exceed player and mapping limits', () => {
    expect(() =>
      createPlayerConfiguration(
        Array.from({ length: 1001 }, (_, id) => ({ id })),
        [],
        [],
      ),
    ).toThrow(/1000/);
    expect(() =>
      createPlayerConfiguration(
        [],
        Array.from({ length: 10001 }, (_, id) => ({ id, player: 1 }) as PlayerMapping),
        [],
      ),
    ).toThrow(/10000/);
  });
});
