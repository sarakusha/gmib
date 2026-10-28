import fs from 'node:fs/promises';

import { afterAll, beforeEach, expect, it, vi } from 'vitest';

import type { PlayerConfiguration } from '/@common/playerConfiguration';

const mocks = await vi.hoisted(async () => {
  const fsModule = await import('node:fs/promises');
  const osModule = await import('node:os');
  const pathModule = await import('node:path');
  return {
    root: await fsModule.mkdtemp(pathModule.join(osModule.tmpdir(), 'gmib-player-config-')),
  };
});
vi.mock('electron', () => ({ app: { getPath: () => mocks.root, on: vi.fn(), quit: vi.fn() } }));
vi.mock('electron-log', () => ({ default: { log: vi.fn() } }));

import {
  closeDatabase,
  dbReady,
  promisifyAll,
  promisifyRun,
  withIsolatedDatabaseTransaction,
} from '../src/db';
import { exportPlayerConfiguration, importPlayerConfiguration } from '../src/playerConfiguration';
import { getPlayerMappings, insertPlayerMapping } from '../src/playerMapping';
import { getPlayers, insertPlayer } from '../src/screen';

const fixture = (): PlayerConfiguration => ({
  format: 'gmib-player-configuration',
  version: 1,
  players: [
    {
      settings: {
        name: 'Player',
        width: 1920,
        height: 1080,
        autoPlay: true,
        disableFadeIn: true,
        disableFadeOut: true,
        playbackEngine: 'capture',
      },
      mappings: [
        {
          name: 'Output',
          left: -1920,
          top: 20,
          width: 800,
          height: 600,
          kiosk: true,
          transparent: true,
          alwaysOnTop: true,
          display: -2,
          objectFit: 'contain',
          shader: 'shader source',
          zIndex: 3,
        },
      ],
    },
    {
      settings: { name: 'Player' },
      mappings: [{ name: 'Output', left: 0, top: 0, kiosk: false, display: 0 }],
    },
  ],
});

beforeEach(async () => {
  await dbReady;
  await promisifyRun('DROP TRIGGER IF EXISTS reject_import_mapping')();
  await promisifyRun('DELETE FROM playerMapping')();
  await promisifyRun('DELETE FROM player')();
  await promisifyRun('DELETE FROM playlist')();
});

afterAll(async () => {
  await closeDatabase();
  await fs.rm(mocks.root, { recursive: true, force: true });
});

it('appends clones with fresh relationships and unique names, preserving existing data', async () => {
  await promisifyRun('INSERT INTO playlist (id, name) VALUES (9, ?)')('Existing playlist');
  const { lastID: existingId } = await insertPlayer({
    name: 'Player',
    playlistId: 9,
    current: 'item',
    hidden: true,
  });
  await insertPlayerMapping({ player: existingId, name: 'Output' });
  const before = await getPlayers();
  const mappingsBefore = await getPlayerMappings();
  const result = await importPlayerConfiguration(fixture());
  expect(result.mappingCount).toBe(2);
  expect(result.playerIds).toHaveLength(2);
  expect(result.playerIds).not.toContain(existingId);
  const players = await getPlayers();
  expect(players[0]).toEqual(before[0]);
  expect(players.slice(1).map(player => player.name)).toEqual(['Player-1', 'Player-2']);
  expect(players[1]).toMatchObject({
    autoPlay: true,
    disableFadeIn: true,
    disableFadeOut: true,
    playbackEngine: 'capture',
    hidden: false,
  });
  expect(
    players
      .slice(1)
      .every(player => player.playlistId === undefined && player.current === undefined),
  ).toBe(true);
  const mappings = await getPlayerMappings();
  expect(mappings[0]).toEqual(mappingsBefore[0]);
  expect(mappings.slice(1).map(mapping => mapping.name)).toEqual(['Output-1', 'Output-2']);
  expect(mappings.slice(1).map(mapping => mapping.player)).toEqual(result.playerIds);
  expect(mappings[1]).toMatchObject({ ...fixture().players[0].mappings[0], name: 'Output-1' });
  expect(mappings[2].display).toBe(0);
});

it('exports fresh settings and portable displays without playlist or runtime state', async () => {
  const { lastID: player } = await insertPlayer({
    name: 'Player',
    hidden: true,
    current: 'playing',
    playbackEngine: 'capture',
  });
  await insertPlayerMapping({ player, name: 'Output', display: 1234, left: 1, top: 2 });
  await insertPlayerMapping({ player, name: 'Disconnected', display: 9876 });
  const document = await exportPlayerConfiguration([{ id: 1234, primary: true }]);
  expect(document.players[0].settings).toMatchObject({ name: 'Player', playbackEngine: 'capture' });
  for (const field of ['id', 'playlistId', 'current', 'hidden'])
    expect(document.players[0].settings).not.toHaveProperty(field);
  expect(document.players[0].mappings[0].display).toBe(-1);
  expect(document.players[0].mappings[1]).not.toHaveProperty('display');
  expect(document.warnings).toHaveLength(1);
  await promisifyRun('UPDATE player SET name = ? WHERE id = ?')('Updated', player);
  expect((await exportPlayerConfiguration([])).players[0].settings.name).toBe('Updated');
});

it('validates the entire document before creating any rows', async () => {
  const invalid = fixture();
  invalid.players[1].mappings[0].display = 12345;
  expect(() => importPlayerConfiguration(invalid)).toThrow();
  expect(await getPlayers()).toEqual([]);
  expect(await getPlayerMappings()).toEqual([]);
});

it('rolls back all imported players and mappings when a later insert fails', async () => {
  const { lastID } = await insertPlayer({ name: 'Unchanged' });
  const document = fixture();
  document.players[1].mappings[0].name = 'Reject';
  await promisifyRun(`CREATE TRIGGER reject_import_mapping BEFORE INSERT ON playerMapping
    WHEN NEW.name = 'Reject' BEGIN SELECT RAISE(ABORT, 'injected import failure'); END`)();
  await expect(importPlayerConfiguration(document)).rejects.toThrow('injected import failure');
  expect((await getPlayers()).map(player => player.id)).toEqual([lastID]);
  expect(await getPlayerMappings()).toEqual([]);
});

it('serializes simultaneous imports so names remain unique', async () => {
  const [first, second] = await Promise.all([
    importPlayerConfiguration(fixture()),
    importPlayerConfiguration(fixture()),
  ]);
  expect(new Set([...first.playerIds, ...second.playerIds]).size).toBe(4);
  expect(new Set((await getPlayers()).map(player => player.name)).size).toBe(4);
  expect(new Set((await getPlayerMappings()).map(mapping => mapping.name)).size).toBe(4);
});

it('makes progress for duplicate names ending in integers above the safe numeric range', async () => {
  const document = fixture();
  document.players[0].settings.name = 'Player-9007199254740992';
  document.players[1].settings.name = 'Player-9007199254740992';
  document.players[0].mappings[0].name = 'Output-9007199254740992';
  document.players[1].mappings[0].name = 'Output-9007199254740992';
  await importPlayerConfiguration(document);
  expect((await getPlayers()).map(player => player.name)).toEqual([
    'Player-9007199254740992',
    'Player-9007199254740992-1',
  ]);
  expect((await getPlayerMappings()).map(mapping => mapping.name)).toEqual([
    'Output-9007199254740992',
    'Output-9007199254740992-1',
  ]);
});

it('cannot roll back an unrelated write on the shared connection', async () => {
  let release!: () => void;
  let entered!: () => void;
  const hold = new Promise<void>(resolve => {
    release = resolve;
  });
  const started = new Promise<void>(resolve => {
    entered = resolve;
  });
  const isolated = withIsolatedDatabaseTransaction('IMMEDIATE', async connection => {
    await new Promise<void>((resolve, reject) =>
      connection.run('INSERT INTO player (name) VALUES (?)', 'Temporary', error =>
        error ? reject(error) : resolve(),
      ),
    );
    entered();
    await hold;
    throw new Error('rollback isolated import');
  });
  await started;
  const observedFailure = expect(isolated).rejects.toThrow('rollback isolated import');
  const unrelated = insertPlayer({ name: 'Unrelated' });
  release();
  await Promise.all([observedFailure, unrelated]);
  expect((await getPlayers()).map(player => player.name)).toEqual(['Unrelated']);
  const violations = await promisifyAll('PRAGMA foreign_key_check', () => [])();
  expect(violations).toEqual([]);
});
