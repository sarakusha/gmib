import type { Database } from 'sqlite3';

import type { NullableOptional } from '/@common/helpers';
import {
  createPlayerConfiguration,
  MAX_PLAYER_CONFIGURATION_BYTES,
  parsePlayerConfiguration,
  type PlayerConfiguration,
} from '/@common/playerConfiguration';

import { incrementCounterString, withIsolatedDatabaseTransaction } from './db';
import { insertPlayerSql, playerEncoder, toPlayer } from './screen';
import { insertPlayerMappingSql, playerMappingEncoder, toPlayerMapping } from './playerMapping';

const all = (connection: Database, sql: string): Promise<NullableOptional[]> =>
  new Promise((resolve, reject) => {
    connection.all<NullableOptional>(sql, (error, rows) => (error ? reject(error) : resolve(rows)));
  });

const insert = (
  connection: Database,
  sql: string,
  parameters: Record<string, unknown>,
): Promise<number> =>
  new Promise((resolve, reject) => {
    connection.run(sql, parameters, function inserted(error) {
      if (error) reject(error);
      else resolve(this.lastID);
    });
  });

const reserveName = (original: string | undefined, names: Set<string>): string | undefined => {
  if (original === undefined) return undefined;
  let name = original;
  while (names.has(name)) {
    const incremented = incrementCounterString(name);
    // Numeric suffixes above Number.MAX_SAFE_INTEGER may stop incrementing.
    name = incremented === name ? `${name}-1` : incremented;
  }
  names.add(name);
  return name;
};

export const exportPlayerConfiguration = (
  displays: Parameters<typeof createPlayerConfiguration>[2],
): Promise<PlayerConfiguration> =>
  withIsolatedDatabaseTransaction('DEFERRED', async connection => {
    // Both reads belong to the same SQLite snapshot, including concurrent edits.
    const players = (await all(connection, 'SELECT * FROM player ORDER BY id')).map(toPlayer);
    const mappings = (await all(connection, 'SELECT * FROM playerMapping ORDER BY id')).map(
      toPlayerMapping,
    );
    const document = createPlayerConfiguration(players, mappings, displays);
    if (Buffer.byteLength(JSON.stringify(document), 'utf8') > MAX_PLAYER_CONFIGURATION_BYTES)
      throw new Error('Конфигурация плееров превышает допустимый размер 5 МиБ');
    return document;
  });

export type ImportPlayerConfigurationResult = { playerIds: number[]; mappingCount: number };

export const importPlayerConfiguration = (
  value: unknown,
): Promise<ImportPlayerConfigurationResult> => {
  // Validate the complete document before acquiring a write lock or creating rows.
  const document = parsePlayerConfiguration(value);
  return withIsolatedDatabaseTransaction('IMMEDIATE', async connection => {
    const playerNames = new Set(
      (await all(connection, 'SELECT name FROM player'))
        .map(row => row.name as string | null)
        .filter((name): name is string => name !== null),
    );
    const mappingNames = new Set(
      (await all(connection, 'SELECT name FROM playerMapping')).map(row => row.name as string),
    );
    const playerIds: number[] = [];
    let mappingCount = 0;
    for (const { settings, mappings } of document.players) {
      const player = {
        ...settings,
        name: reserveName(settings.name, playerNames),
        playlistId: undefined,
        current: undefined,
        hidden: false,
      };
      const playerId = await insert(connection, insertPlayerSql, playerEncoder(player));
      playerIds.push(playerId);
      for (const mapping of mappings) {
        await insert(
          connection,
          insertPlayerMappingSql,
          playerMappingEncoder({
            ...mapping,
            player: playerId,
            name: reserveName(mapping.name, mappingNames),
          }),
        );
        mappingCount += 1;
      }
    }
    return { playerIds, mappingCount };
  });
};
