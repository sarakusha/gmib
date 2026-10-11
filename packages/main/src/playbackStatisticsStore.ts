import fs from 'node:fs/promises';
import path from 'node:path';
import { Database, OPEN_READONLY } from 'sqlite3';
import { isPlaybackStatisticsEvent, type PlaybackStatisticsEvent } from '/@common/playback';
import type { PlaybackOutputSnapshot } from '/@common/playbackOutput';

export type PlaybackSqlValue = string | number | null;
export type PlaybackSqlDatabase = {
  all<T>(sql: string, params?: PlaybackSqlValue[]): Promise<T[]>;
  get<T>(sql: string, params?: PlaybackSqlValue[]): Promise<T | undefined>;
  run(sql: string, params?: PlaybackSqlValue[]): Promise<{ changes: number; lastID: number }>;
  exec(sql: string): Promise<void>;
};

export type PlaybackSqlReader = Pick<PlaybackSqlDatabase, 'all' | 'get'>;

// attempts — индекс попыток и их исходов; events и segments — исходные факты.
// Сегменты и результаты выходов вынесены из JSON в связанные таблицы для расчётов.
// seen_events отвечает за дедупликацию, output_observations — за исторические подписи.
// Схема связей и последовательность записи: docs/ru/playback-statistics-sql.md.
const schema = `
CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY, player_id INTEGER NOT NULL, media_id TEXT NOT NULL,
  attempt INTEGER NOT NULL, playlist_id INTEGER, item_id TEXT, engine TEXT,
  filename TEXT NOT NULL, filename_at INTEGER NOT NULL,
  first_at INTEGER NOT NULL, last_at INTEGER NOT NULL,
  started_at INTEGER, declared_started_at INTEGER, completed_at INTEGER,
  error_at INTEGER, skipped_at INTEGER, interrupted_at INTEGER,
  terminal TEXT, terminal_at INTEGER, result_status TEXT, result_reasons TEXT,
  completed_status TEXT, completed_reasons TEXT
);
CREATE TABLE IF NOT EXISTS seen_events (
  id TEXT PRIMARY KEY, at INTEGER NOT NULL,
  attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS segments (
  id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  start_at INTEGER NOT NULL, end_at INTEGER NOT NULL, played_ms REAL NOT NULL,
  all_showing INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS segments_output (
  segment_id TEXT NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  output_id INTEGER NOT NULL, showing INTEGER NOT NULL,
  PRIMARY KEY(segment_id, output_id)
);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  at INTEGER NOT NULL, type TEXT NOT NULL, error TEXT, reason TEXT, output TEXT,
  position REAL, previous_position REAL, quarantined INTEGER
);
CREATE TABLE IF NOT EXISTS attempt_outputs (
  attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  output_id INTEGER NOT NULL, name TEXT NOT NULL, display REAL, resolved_display_id REAL,
  metadata_at INTEGER NOT NULL, result_status TEXT, result_reasons TEXT, result_state TEXT,
  completed_status TEXT, completed_reasons TEXT, completed_state TEXT,
  PRIMARY KEY(attempt_id, output_id)
);
CREATE TABLE IF NOT EXISTS output_observations (
  player_id INTEGER NOT NULL, output_id INTEGER NOT NULL, at INTEGER NOT NULL,
  name TEXT NOT NULL, display REAL, resolved_display_id REAL,
  PRIMARY KEY(player_id, output_id, at)
);
CREATE INDEX IF NOT EXISTS attempts_player_media_last ON attempts(player_id, media_id, last_at);
CREATE INDEX IF NOT EXISTS attempts_player_period ON attempts(player_id, first_at, last_at);
CREATE INDEX IF NOT EXISTS segments_attempt_start ON segments(attempt_id, start_at);
CREATE INDEX IF NOT EXISTS segments_end ON segments(end_at);
CREATE INDEX IF NOT EXISTS events_attempt_at ON events(attempt_id, at);
CREATE INDEX IF NOT EXISTS events_at ON events(at);
CREATE INDEX IF NOT EXISTS output_observations_at ON output_observations(player_id, output_id, at);
CREATE INDEX IF NOT EXISTS seen_events_at ON seen_events(at);
CREATE INDEX IF NOT EXISTS seen_events_attempt_at ON seen_events(attempt_id, at);
`;

// Читаем строку целиком в той же BEGIN IMMEDIATE, где затем её записываем.
// Это позволяет слить обновления attempts без потери событий при конкуренции писателей.
type AttemptRow = {
  id: string;
  player_id: number;
  media_id: string;
  attempt: number;
  playlist_id: number | null;
  item_id: string | null;
  engine: string | null;
  filename: string;
  filename_at: number;
  first_at: number;
  last_at: number;
  started_at: number | null;
  declared_started_at: number | null;
  completed_at: number | null;
  error_at: number | null;
  skipped_at: number | null;
  interrupted_at: number | null;
  terminal: string | null;
  terminal_at: number | null;
  result_status: string | null;
  result_reasons: string | null;
  completed_status: string | null;
  completed_reasons: string | null;
};
const attemptColumns = [
  'id',
  'player_id',
  'media_id',
  'attempt',
  'playlist_id',
  'item_id',
  'engine',
  'filename',
  'filename_at',
  'first_at',
  'last_at',
  'started_at',
  'declared_started_at',
  'completed_at',
  'error_at',
  'skipped_at',
  'interrupted_at',
  'terminal',
  'terminal_at',
  'result_status',
  'result_reasons',
  'completed_status',
  'completed_reasons',
] as const satisfies readonly (keyof AttemptRow)[];
// Имена столбцов заданы кодом, значения события всегда передаются параметрами.
const upsertAttempt = `INSERT INTO attempts(${attemptColumns.join(',')})
  VALUES(${attemptColumns.map(() => '?').join(',')}) ON CONFLICT(id) DO UPDATE SET
  ${attemptColumns
    .filter(column => column !== 'id')
    .map(column => `${column}=excluded.${column}`)
    .join(',')}`;
const reasons = (value: string[] | undefined): string => JSON.stringify(value ?? ['unknown']);
const earliest = (previous: number | null, next: number): number =>
  previous === null ? next : Math.min(previous, next);

/** Отдельная база фактов; файловые отчёты читают снимок WAL в своей очереди. */
export class PlaybackStatisticsStore {
  readonly ready: Promise<void>;
  private database?: Database;
  private readerDatabase?: Database;
  private sql?: PlaybackSqlDatabase;
  private readerSql?: PlaybackSqlDatabase;
  private queue: Promise<unknown> = Promise.resolve();
  private readerQueue: Promise<unknown> = Promise.resolve();
  private pendingReads = 0;
  private readonly maxPendingReads: number;
  private readonly inMemory: boolean;
  private closing = false;
  private closePromise?: Promise<void>;
  private lastCleanupDate?: string;
  private readonly now: () => Date;
  private readonly retentionDays: () => number;

  constructor(
    filename: string,
    options: { now?: () => Date; retentionDays?: () => number; maxPendingReads?: number } = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.retentionDays = options.retentionDays ?? (() => 30);
    this.inMemory = filename === ':memory:';
    this.maxPendingReads = Number.isFinite(options.maxPendingReads)
      ? Math.max(1, Math.floor(options.maxPendingReads!))
      : 64;
    this.ready = this.initialize(filename);
    // Callers can await readiness; an unused failed store must not create an unhandled rejection.
    void this.ready.catch(() => undefined);
  }

  private async open(filename: string, mode?: number): Promise<Database> {
    return new Promise<Database>((resolve, reject) => {
      const complete = (error: Error | null) => (error ? reject(error) : resolve(connection));
      const connection =
        mode === undefined
          ? new Database(filename, complete)
          : new Database(filename, mode, complete);
    });
  }

  private wrap(database: Database): PlaybackSqlDatabase {
    return {
      all: <T>(statement: string, params: PlaybackSqlValue[] = []) =>
        new Promise<T[]>((resolve, reject) =>
          database.all(statement, params, (error, rows) =>
            error ? reject(error) : resolve(rows as T[]),
          ),
        ),
      get: <T>(statement: string, params: PlaybackSqlValue[] = []) =>
        new Promise<T | undefined>((resolve, reject) =>
          database.get(statement, params, (error, row) =>
            error ? reject(error) : resolve(row as T | undefined),
          ),
        ),
      run: (statement, params = []) =>
        new Promise((resolve, reject) => {
          database.run(statement, params, function complete(error) {
            if (error) reject(error);
            else resolve({ changes: this.changes, lastID: this.lastID });
          });
        }),
      exec: statement =>
        new Promise<void>((resolve, reject) =>
          database.exec(statement, error => (error ? reject(error) : resolve())),
        ),
    };
  }

  private async initialize(filename: string): Promise<void> {
    try {
      if (!this.inMemory) await fs.mkdir(path.dirname(filename), { recursive: true });
      this.database = await this.open(filename);
      const sql = this.wrap(this.database);
      this.sql = sql;
      await sql.exec(
        'PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;',
      );
      await sql.exec(schema);
      await this.cleanupDirect(sql);
      if (!this.inMemory) {
        this.readerDatabase = await this.open(filename, OPEN_READONLY);
        this.readerSql = this.wrap(this.readerDatabase);
        await this.readerSql.exec('PRAGMA query_only=ON; PRAGMA busy_timeout=5000;');
      }
    } catch (error) {
      await this.closeNative().catch(() => undefined);
      throw error;
    }
  }

  private enqueue<T>(operation: (sql: PlaybackSqlDatabase) => Promise<T>): Promise<T> {
    // Очередь писателя удерживает целиком append/cleanup/write, включая транзакцию.
    if (this.closing) return Promise.reject(new Error('Playback statistics database is closing'));
    const next = this.queue.then(async () => {
      await this.ready;
      return operation(this.sql!);
    });
    this.queue = next.catch(() => undefined);
    return next;
  }

  private scope(sql: PlaybackSqlDatabase, readOnly: boolean) {
    let active = true;
    const pending: Promise<unknown>[] = [];
    const guard = <R>(work: () => Promise<R>, mutating = false): Promise<R> => {
      if (!active) return Promise.reject(new Error('Playback statistics callback has finished'));
      if (readOnly && mutating)
        return Promise.reject(new Error('Playback statistics read is read-only; use write()'));
      const next = work();
      pending.push(next);
      // Даже забытый await не оставит необработанное отклонение или команду вне снимка.
      void next.catch(() => undefined);
      return next;
    };
    const query = <R>(statement: string, work: () => Promise<R>): Promise<R> => {
      // Запрещаем BEGIN/COMMIT и PRAGMA через get/all: callback не управляет снимком
      // и не может отключить query_only. WITH с записью дополнительно блокирует SQLite.
      if (
        readOnly &&
        !/^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*(?:SELECT|WITH|EXPLAIN)\b/i.test(statement)
      )
        return guard(() =>
          Promise.reject(new Error('Playback statistics read is read-only; use write()')),
        );
      return guard(work);
    };
    const scoped: PlaybackSqlDatabase = {
      all: (statement, params) => query(statement, () => sql.all(statement, params)),
      get: (statement, params) => query(statement, () => sql.get(statement, params)),
      run: (statement, params) => guard(() => sql.run(statement, params), true),
      exec: statement => guard(() => sql.exec(statement), true),
    };
    return {
      sql: scoped,
      finish: async () => {
        active = false;
        // Дожидаемся всех уже выданных команд до COMMIT/ROLLBACK и следующего callback.
        const results = await Promise.allSettled(pending);
        const failure = results.find(result => result.status === 'rejected');
        if (failure?.status === 'rejected') throw failure.reason;
      },
    };
  }

  read<T>(callback: (sql: PlaybackSqlReader) => Promise<T>): Promise<T> {
    if (this.closing) return Promise.reject(new Error('Playback statistics database is closing'));
    if (this.pendingReads >= this.maxPendingReads)
      return Promise.reject(new Error('Playback statistics read queue is full'));
    this.pendingReads += 1;
    const read = async (sql: PlaybackSqlDatabase): Promise<T> => {
      // BEGIN сам по себе не фиксирует снимок: первый SELECT делает это до callback.
      // :memory: не поддерживает WAL; тестовая база использует общую очередь писателя.
      if (this.inMemory) await sql.exec('PRAGMA query_only=ON');
      try {
        await sql.exec('BEGIN');
        try {
          await sql.get('SELECT id FROM attempts LIMIT 1');
          const scoped = this.scope(sql, true);
          let result: T;
          try {
            result = await callback(scoped.sql);
          } finally {
            await scoped.finish();
          }
          await sql.exec('COMMIT');
          return result;
        } catch (error) {
          await sql.exec('ROLLBACK').catch(() => undefined);
          throw error;
        }
      } finally {
        if (this.inMemory) await sql.exec('PRAGMA query_only=OFF');
      }
    };
    let next: Promise<T>;
    if (this.inMemory) next = this.enqueue(read);
    else {
      // Ждём записи, принятые до read(). Последующие записи не ждут этот отчёт.
      const acceptedWrites = this.queue;
      next = this.readerQueue.then(async () => {
        await this.ready;
        await acceptedWrites;
        return read(this.readerSql!);
      });
    }
    const result = next.finally(() => {
      this.pendingReads -= 1;
    });
    this.readerQueue = result.catch(() => undefined);
    return result;
  }

  /** Служебные изменения выполняются в очереди писателя и одной транзакции. */
  write<T>(callback: (sql: PlaybackSqlDatabase) => Promise<T>): Promise<T> {
    return this.enqueue(sql =>
      this.transaction(sql, async () => {
        const scoped = this.scope(sql, false);
        let result: T;
        try {
          result = await callback(scoped.sql);
        } finally {
          await scoped.finish();
        }
        return result;
      }),
    );
  }

  append(event: PlaybackStatisticsEvent): Promise<void> {
    return this.enqueue(async sql => {
      if (!isPlaybackStatisticsEvent(event)) throw new Error('Invalid playback statistics event');
      const now = this.now();
      const cutoff = this.cutoff(now);
      const at = Date.parse(event.timestamp);
      if (at < cutoff || at > now.getTime()) return;
      if (this.lastCleanupDate !== now.toISOString().slice(0, 10)) await this.cleanupDirect(sql);
      // Одно событие — одна транзакция, число команд зависит от его типа и выходов.
      // Сначала проверка eventId/идентичности попытки, затем индекс attempts и факты.
      // При ошибке откатывается и seen_events: повторная доставка сможет записать событие.
      await this.transaction(sql, async () => {
        // Дедупликация имеет приоритет над проверкой payload: повтор eventId — no-op,
        // даже если повторная доставка содержит другую идентичность попытки.
        const existing = await sql.get<AttemptRow & { duplicate: number }>(
          `SELECT a.*,EXISTS(SELECT 1 FROM seen_events WHERE id=?) AS duplicate
          FROM (SELECT 1) LEFT JOIN attempts a ON a.id=?`,
          [event.eventId, event.playbackId],
        );
        if (existing?.duplicate) return;
        const attempt = existing?.id == null ? undefined : existing;
        if (attempt && (attempt.player_id !== event.playerId || attempt.media_id !== event.mediaId))
          throw new Error('Playback attempt identity changed');
        const segmentStart =
          event.event === 'progress' ? Math.max(cutoff, Date.parse(event.segmentStartedAt!)) : at;
        const row: AttemptRow = attempt
          ? { ...attempt }
          : {
              id: event.playbackId,
              player_id: event.playerId,
              media_id: event.mediaId,
              attempt: event.attempt,
              playlist_id: null,
              item_id: null,
              engine: null,
              filename: event.filename || event.mediaId,
              filename_at: Number.MIN_SAFE_INTEGER,
              first_at: segmentStart,
              last_at: at,
              started_at: null,
              declared_started_at: null,
              completed_at: null,
              error_at: null,
              skipped_at: null,
              interrupted_at: null,
              terminal: null,
              terminal_at: null,
              result_status: null,
              result_reasons: null,
              completed_status: null,
              completed_reasons: null,
            };
        row.playlist_id ??= event.playlistId ?? null;
        row.item_id ??= event.itemId ?? null;
        row.engine ??= event.engine ?? null;
        row.first_at = Math.min(row.first_at, segmentStart);
        row.last_at = Math.max(row.last_at, at);
        if (event.filename && at >= row.filename_at) {
          row.filename = event.filename;
          row.filename_at = at;
        }
        if (event.startedAt !== undefined) {
          const declared = Date.parse(event.startedAt);
          row.declared_started_at = earliest(row.declared_started_at, declared);
          const start = row.started_at ?? declared;
          if (row.terminal_at !== null && row.terminal_at >= start)
            row.first_at = Math.min(row.first_at, Math.max(cutoff, start));
        }
        const timestampColumn = {
          started: 'started_at',
          completed: 'completed_at',
          error: 'error_at',
          skipped: 'skipped_at',
          interrupted: 'interrupted_at',
        } as const;
        if (event.event in timestampColumn) {
          const column = timestampColumn[event.event as keyof typeof timestampColumn];
          row[column] = earliest(row[column], at);
        }
        // Флаги считаем по состоянию ДО события: первый исход и первое completed
        // независимы. При равных timestamp сохраняется уже принятый результат.
        const terminal =
          ['completed', 'error', 'interrupted'].includes(event.event) &&
          (attempt?.terminal_at == null || at < attempt.terminal_at);
        const completed =
          event.event === 'completed' &&
          (attempt?.completed_at == null || at < attempt.completed_at);
        if (terminal) {
          row.terminal = event.event;
          row.terminal_at = at;
          row.result_status = event.outputResult?.status ?? 'unconfirmed';
          row.result_reasons = reasons(event.outputResult?.reasons);
          const start = row.started_at ?? row.declared_started_at;
          if (start !== null && at >= start)
            row.first_at = Math.min(row.first_at, Math.max(cutoff, start));
        }
        if (completed) {
          row.completed_status = event.outputResult?.status ?? 'unconfirmed';
          row.completed_reasons = reasons(event.outputResult?.reasons);
        }
        // Вместо UPSERT и нескольких UPDATE — одна запись уже объединённой строки.
        // Блокировка писателя удерживается с чтения existing до COMMIT.
        await sql.run(
          upsertAttempt,
          attemptColumns.map(column => row[column]),
        );
        await sql.run('INSERT INTO seen_events(id,at,attempt_id) VALUES(?,?,?)', [
          event.eventId,
          at,
          event.playbackId,
        ]);
        await this.recordOutputs(sql, event, at, terminal, completed);
        // progress хранится только как числовой сегмент + состояния его выходов.
        // Остальные события попадают в events; обе ветки уже отмечены в seen_events.
        if (event.event === 'progress') {
          const start = Date.parse(event.segmentStartedAt!);
          const played = at > start ? (event.playedMs! * (at - segmentStart)) / (at - start) : 0;
          const outputs = event.output?.outputs ?? [];
          await sql.run(
            'INSERT INTO segments(id,attempt_id,start_at,end_at,played_ms,all_showing) VALUES(?,?,?,?,?,?)',
            [
              event.eventId,
              event.playbackId,
              segmentStart,
              at,
              played,
              outputs.length > 0 && outputs.every(output => output.state === 'showing') ? 1 : 0,
            ],
          );
          for (const output of outputs)
            await sql.run(
              'INSERT INTO segments_output(segment_id,output_id,showing) VALUES(?,?,?)',
              [event.eventId, output.id, output.state === 'showing' ? 1 : 0],
            );
        } else {
          await sql.run(
            'INSERT INTO events(id,attempt_id,at,type,error,reason,output,position,previous_position,quarantined) VALUES(?,?,?,?,?,?,?,?,?,?)',
            [
              event.eventId,
              event.playbackId,
              at,
              event.event,
              event.error ?? null,
              event.reason ?? null,
              event.output ? JSON.stringify(event.output) : null,
              event.position ?? null,
              event.previousPosition ?? null,
              event.quarantined === undefined ? null : Number(event.quarantined),
            ],
          );
        }
      });
    });
  }

  private async recordOutputs(
    sql: PlaybackSqlDatabase,
    event: PlaybackStatisticsEvent,
    at: number,
    terminal: boolean,
    completed: boolean,
  ): Promise<void> {
    const outputs = new Map<number, PlaybackOutputSnapshot>();
    for (const output of [...(event.output?.outputs ?? []), ...(event.outputResult?.outputs ?? [])])
      outputs.set(output.id, output);
    // При более раннем исходе заменяем результаты целиком: старые выходы не должны
    // унаследовать подтверждение от вытесненного, более позднего terminal/completed.
    const reset = [
      ...(terminal ? ['result_status', 'result_reasons', 'result_state'] : []),
      ...(completed ? ['completed_status', 'completed_reasons', 'completed_state'] : []),
    ];
    if (reset.length)
      await sql.run(
        `UPDATE attempt_outputs SET ${reset.map(column => `${column}=NULL`).join(',')} WHERE attempt_id=?`,
        [event.playbackId],
      );
    for (const output of outputs.values()) {
      const result = event.outputResult?.outputs.find(item => item.id === output.id);
      await sql.run(
        `INSERT INTO attempt_outputs(attempt_id,output_id,name,display,resolved_display_id,metadata_at,
          result_status,result_reasons,result_state,completed_status,completed_reasons,completed_state)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(attempt_id,output_id) DO UPDATE SET
        name=CASE WHEN excluded.metadata_at >= metadata_at THEN excluded.name ELSE name END,
        display=CASE WHEN excluded.metadata_at >= metadata_at THEN excluded.display ELSE display END,
        resolved_display_id=CASE WHEN excluded.metadata_at >= metadata_at THEN excluded.resolved_display_id ELSE resolved_display_id END,
        metadata_at=MAX(metadata_at,excluded.metadata_at),
        result_status=COALESCE(excluded.result_status,result_status),
        result_reasons=COALESCE(excluded.result_reasons,result_reasons),
        result_state=COALESCE(excluded.result_state,result_state),
        completed_status=COALESCE(excluded.completed_status,completed_status),
        completed_reasons=COALESCE(excluded.completed_reasons,completed_reasons),
        completed_state=COALESCE(excluded.completed_state,completed_state)`,
        [
          event.playbackId,
          output.id,
          output.name,
          output.display ?? null,
          output.resolvedDisplayId ?? null,
          at,
          terminal && result ? result.status : null,
          terminal && result ? reasons(result.reasons) : null,
          terminal && result ? result.state : null,
          completed && result ? result.status : null,
          completed && result ? reasons(result.reasons) : null,
          completed && result ? result.state : null,
        ],
      );
      // Проверка последнего исторического имени и условная запись — одна команда.
      // IS сравнивает nullable назначения так же, как прежняя проверка в JS.
      // Неизменившееся описание не создаёт строку и не раздувает историю выходов.
      await sql.run(
        `INSERT INTO output_observations(player_id,output_id,at,name,display,resolved_display_id)
        SELECT ?,?,?,?,?,? WHERE NOT EXISTS (
          SELECT 1 FROM (SELECT name,display,resolved_display_id FROM output_observations
            WHERE player_id=? AND output_id=? AND at<=? ORDER BY at DESC LIMIT 1) previous
          WHERE previous.name=? AND previous.display IS ? AND previous.resolved_display_id IS ?)
        ON CONFLICT(player_id,output_id,at) DO UPDATE SET
          name=excluded.name,display=excluded.display,resolved_display_id=excluded.resolved_display_id`,
        [
          event.playerId,
          output.id,
          at,
          output.name,
          output.display ?? null,
          output.resolvedDisplayId ?? null,
          event.playerId,
          output.id,
          at,
          output.name,
          output.display ?? null,
          output.resolvedDisplayId ?? null,
        ],
      );
    }
  }

  private cutoff(now: Date): number {
    const date = new Date(now);
    const configured = this.retentionDays();
    const days = Number.isFinite(configured) ? Math.max(1, Math.floor(configured)) : 30;
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - days + 1);
    return date.getTime();
  }

  cleanup(): Promise<void> {
    return this.enqueue(sql => this.cleanupDirect(sql));
  }

  private async cleanupDirect(sql: PlaybackSqlDatabase): Promise<void> {
    const now = this.now();
    const cutoff = this.cutoff(now);
    // Очистка использует границу суток UTC; отчёт группирует по локальным суткам хоста.
    // Пересекающий границу сегмент укорачиваем пропорционально, затем пересчитываем
    // first_at/last_at по оставшимся фактам. Связанные строки удаляются каскадно.
    await this.transaction(sql, async () => {
      await sql.run('DELETE FROM events WHERE at < ?', [cutoff]);
      await sql.run('DELETE FROM segments WHERE end_at < ?', [cutoff]);
      await sql.run(
        `UPDATE segments SET played_ms=CASE WHEN end_at>start_at THEN
        played_ms*(end_at-?)/(end_at-start_at) ELSE 0 END,start_at=? WHERE start_at<?`,
        [cutoff, cutoff, cutoff],
      );
      await sql.run('DELETE FROM seen_events WHERE at < ?', [cutoff]);
      await sql.exec(`DELETE FROM attempts WHERE NOT EXISTS(SELECT 1 FROM events WHERE attempt_id=attempts.id)
        AND NOT EXISTS(SELECT 1 FROM segments WHERE attempt_id=attempts.id);
        UPDATE attempts SET first_at=(SELECT MIN(at) FROM (
          SELECT at FROM events WHERE attempt_id=attempts.id UNION ALL
          SELECT start_at AS at FROM segments WHERE attempt_id=attempts.id)),
        last_at=(SELECT MAX(at) FROM (
          SELECT at FROM events WHERE attempt_id=attempts.id UNION ALL
          SELECT end_at AS at FROM segments WHERE attempt_id=attempts.id));`);
      // startedAt в сохранившемся исходе восстанавливает начало длинного показа,
      // но никогда не возвращает время за пределами срока хранения.
      await sql.run(
        `UPDATE attempts SET first_at=MIN(first_at,MAX(?,COALESCE(started_at,declared_started_at)))
        WHERE terminal_at>=COALESCE(started_at,declared_started_at) AND terminal_at>=?`,
        [cutoff, cutoff],
      );
      // Оставляем последнее старое имя/назначение для сегментов на границе хранения.
      await sql.run(
        `DELETE FROM output_observations WHERE at < ? AND at < (
        SELECT MAX(newer.at) FROM output_observations newer
        WHERE newer.player_id=output_observations.player_id AND newer.output_id=output_observations.output_id AND newer.at<?)`,
        [cutoff, cutoff],
      );
      await sql.exec(`DELETE FROM output_observations WHERE NOT EXISTS (
        SELECT 1 FROM attempt_outputs ao JOIN attempts a ON a.id=ao.attempt_id
        WHERE a.player_id=output_observations.player_id AND ao.output_id=output_observations.output_id);`);
    });
    this.lastCleanupDate = now.toISOString().slice(0, 10);
  }

  private async transaction<T>(sql: PlaybackSqlDatabase, work: () => Promise<T>): Promise<T> {
    await sql.exec('BEGIN IMMEDIATE');
    try {
      const result = await work();
      await sql.exec('COMMIT');
      return result;
    } catch (error) {
      await sql.exec('ROLLBACK').catch(() => undefined);
      throw error;
    }
  }

  private async closeNative(): Promise<void> {
    // Закрываем оба соединения даже при ошибке одного из них.
    const results = await Promise.allSettled(
      [this.readerDatabase, this.database]
        .filter((db): db is Database => Boolean(db))
        .map(
          db =>
            new Promise<void>((resolve, reject) =>
              db.close(error => (error ? reject(error) : resolve())),
            ),
        ),
    );
    this.readerDatabase = undefined;
    this.database = undefined;
    this.readerSql = undefined;
    this.sql = undefined;
    const failure = results.find(result => result.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
  }

  close(): Promise<void> {
    // Сначала запрещаем новые операции, затем дожидаемся обеих принятых очередей.
    this.closing = true;
    this.closePromise ??= Promise.all([this.queue, this.readerQueue]).then(async () => {
      await this.ready.catch(() => undefined);
      await this.closeNative();
    });
    return this.closePromise;
  }
}
