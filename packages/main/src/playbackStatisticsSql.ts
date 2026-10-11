import type { PlaybackOutputResult, PlaybackOutputState } from '/@common/playbackOutput';
import { PLAYBACK_HISTORY_MAX_OFFSET } from '/@common/playbackStatistics';
import type {
  PlaybackHistory,
  PlaybackHistoryEntry,
  PlaybackHistoryQuery,
  PlaybackStatistics,
  PlaybackStatisticsMetrics,
  PlaybackStatisticsQuery,
} from '/@common/playbackStatistics';
import { localDate, PlaybackStatisticsQueryError, statisticsPeriod } from './playbackStatistics';
import type { PlaybackSqlValue, PlaybackStatisticsStore } from './playbackStatisticsStore';
import { dailyFacts, daysQuery } from './playbackStatisticsDailySql';

const emptyMetrics = (): PlaybackStatisticsMetrics => ({
  starts: 0,
  completed: 0,
  confirmed: 0,
  partial: 0,
  unconfirmed: 0,
  playedMs: 0,
  errors: 0,
  skipped: 0,
  interrupted: 0,
  successfulMs: 0,
});
const iso = (at: number): string => new Date(at).toISOString();
const metrics = (row: PlaybackStatisticsMetrics): PlaybackStatisticsMetrics => ({
  starts: row.starts ?? 0,
  completed: row.completed ?? 0,
  confirmed: row.confirmed ?? 0,
  partial: row.partial ?? 0,
  unconfirmed: row.unconfirmed ?? 0,
  playedMs: Math.round(row.playedMs ?? 0),
  errors: row.errors ?? 0,
  skipped: row.skipped ?? 0,
  interrupted: row.interrupted ?? 0,
  successfulMs: Math.round(row.successfulMs ?? 0),
});

type Day = { date: string; from: number; to: number };
const calendarDays = (from: number, to: number): Day[] => {
  const days: Day[] = [];
  const first = new Date(from);
  for (
    let day = new Date(first.getFullYear(), first.getMonth(), first.getDate());
    day.getTime() <= to;
    day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
  ) {
    days.push({
      date: localDate(day),
      from: day.getTime(),
      to: new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime(),
    });
  }
  return days;
};

/**
 * Общая цепочка CTE для сводки и истории; это части одного SQL, а не отдельные запросы.
 * Из SQLite возвращаются итоговые строки, а не весь журнал для обработки в JS.
 * MATERIALIZED сохраняет переиспользуемую выборку только на время этого запроса:
 * это не постоянный кэш. Остальной физический план выбирает SQLite.
 * Схема зависимостей и порядок обращений: docs/ru/playback-statistics-sql.md.
 */
const facts = (pageOnly = false) => `
-- Грубый отбор попыток по плееру, ролику и пересечению границ сохранившихся фактов.
-- now фиксирован для всего вызова. При откате часов скрываем будущие исходы;
-- last_at нужен только истории: восстанавливаем его по seen_events.
-- Сводка переносит между временными таблицами только используемые поля.
own AS MATERIALIZED (
  SELECT a.id,${pageOnly ? 'a.player_id,' : ''}a.media_id,a.filename,a.filename_at,a.first_at,
    ${
      pageOnly
        ? `CASE WHEN a.last_at<=b.now THEN a.last_at ELSE COALESCE((
      SELECT MAX(at) FROM seen_events WHERE attempt_id=a.id AND at<=b.now),a.first_at) END AS last_at,
    `
        : ''
    }
    CASE WHEN a.started_at<=b.now THEN a.started_at END AS started_at,
    CASE WHEN a.declared_started_at<=b.now THEN a.declared_started_at END AS declared_started_at,
    CASE WHEN a.terminal_at<=b.now THEN a.terminal_at END AS terminal_at,
    CASE WHEN a.completed_at<=b.now THEN a.completed_at END AS completed_at,
    ${
      pageOnly
        ? `CASE WHEN a.error_at<=b.now THEN a.error_at END AS error_at,
    CASE WHEN a.skipped_at<=b.now THEN a.skipped_at END AS skipped_at,
    CASE WHEN a.interrupted_at<=b.now THEN a.interrupted_at END AS interrupted_at,`
        : ''
    }
    CASE WHEN a.terminal_at<=b.now THEN a.terminal END AS terminal,
    ${
      pageOnly
        ? `CASE WHEN a.terminal_at<=b.now THEN a.result_status END AS result_status,
    CASE WHEN a.terminal_at<=b.now THEN a.result_reasons END AS result_reasons,`
        : ''
    }
    CASE WHEN a.completed_at<=b.now THEN a.completed_status END AS completed_status
  FROM attempts a,bounds b WHERE a.player_id=b.player AND a.first_at<=b.now
    AND a.first_at<=b.hi AND a.last_at>=b.lo
    AND (b.media IS NULL OR a.media_id=b.media)
),
-- Старые сегменты нужны только для сохранения состава истории и снимков выходов.
-- played_ms больше не читаем: длительность определяется границами попытки.
observed_segments AS MATERIALIZED (
  SELECT s.id,s.attempt_id,s.start_at,s.end_at
  FROM own a CROSS JOIN segments s ON a.id=s.attempt_id CROSS JOIN bounds b
  WHERE s.end_at<=b.now
),
-- События точечные: hi включён (верхняя учтённая граница), finish исключён
-- (начало суток после выбранной конечной даты). Прогресс хранится в segments.
selected_events AS MATERIALIZED (
  SELECT e.attempt_id,e.at,e.type,e.output FROM ${pageOnly ? 'events e JOIN own a ON a.id=e.attempt_id, bounds b' : 'own a CROSS JOIN events e ON a.id=e.attempt_id CROSS JOIN bounds b'}
  WHERE e.at>=b.lo AND e.at<=b.hi AND e.at<b.finish AND e.at<=b.now
),
-- Пересечения first_at/last_at мало: между фактами могли быть паузы.
-- Оставляем попытки с событием, концом сегмента или активным временем в периоде.
-- UNION убирает дубли попыток; он не складывает число событий.
${
  pageOnly
    ? `relevant AS (
  SELECT a.id AS attempt_id FROM own a,bounds b
  WHERE (a.terminal_at>COALESCE(a.started_at,a.declared_started_at)
    AND a.terminal_at>b.lo AND COALESCE(a.started_at,a.declared_started_at)<b.hi)
  OR EXISTS(SELECT 1 FROM events e WHERE e.attempt_id=a.id
    AND e.at>=b.lo AND e.at<=b.hi AND e.at<b.finish AND e.at<=b.now)
  OR EXISTS(SELECT 1 FROM segments s WHERE s.attempt_id=a.id AND s.end_at<=b.now
    AND ((s.end_at>=b.lo AND s.end_at<=b.hi AND s.end_at<b.finish)
      OR (s.start_at<b.hi AND s.end_at>b.lo)))
),`
    : `relevant AS (
  SELECT attempt_id FROM selected_events UNION
  SELECT a.id FROM own a,bounds b
  WHERE a.terminal_at>COALESCE(a.started_at,a.declared_started_at)
    AND a.terminal_at>b.lo AND COALESCE(a.started_at,a.declared_started_at)<b.hi UNION
  SELECT s.attempt_id FROM observed_segments s,bounds b
  WHERE (s.end_at>=b.lo AND s.end_at<=b.hi AND s.end_at<b.finish)
     OR (s.start_at<b.hi AND s.end_at>b.lo)
),`
}

-- Выход мог встретиться в снимке события, в прогрессе или только в результате.
-- Эти наблюдения задают состав выходов отчёта и дату для их исторического имени.
observed_outputs AS MATERIALIZED (
  SELECT output_id,MAX(at) AS at FROM (
  SELECT CAST(json_extract(j.value,'$.id') AS INTEGER) AS output_id,e.at
  FROM selected_events e,json_each(e.output,'$.outputs') j UNION ALL
  SELECT so.output_id,s.end_at FROM observed_segments s
  ${pageOnly ? 'JOIN segments_output so ON so.segment_id=s.id,bounds b' : 'CROSS JOIN segments_output so ON so.segment_id=s.id CROSS JOIN bounds b'}
  WHERE (s.end_at>=b.lo AND s.end_at<=b.hi AND s.end_at<b.finish)
     OR (s.start_at<b.hi AND s.end_at>b.lo) UNION ALL
  SELECT ao.output_id,a.completed_at FROM ${pageOnly ? 'attempt_outputs ao JOIN own a ON a.id=ao.attempt_id,bounds b' : 'own a CROSS JOIN attempt_outputs ao ON a.id=ao.attempt_id CROSS JOIN bounds b'}
  WHERE a.completed_at>=b.lo AND a.completed_at<=b.hi AND a.completed_at<b.finish
    AND ao.completed_status IS NOT NULL UNION ALL
  -- Попытка может пересекать весь период без единого события внутри него.
  SELECT ao.output_id,MIN(a.terminal_at,b.hi) FROM own a
  CROSS JOIN attempt_outputs ao ON ao.attempt_id=a.id CROSS JOIN bounds b
  WHERE a.terminal_at>COALESCE(a.started_at,a.declared_started_at)
    AND a.terminal_at>b.lo AND COALESCE(a.started_at,a.declared_started_at)<b.hi
    AND (ao.metadata_at<=b.now OR EXISTS (SELECT 1 FROM output_observations o
      WHERE o.player_id=b.player AND o.output_id=ao.output_id AND o.at<=b.now))
  ) GROUP BY output_id
),
-- selected — запрошенный срез (все выходы вместе либо один output_id).
-- В сводке добавляем отдельный срез для каждого выхода; история их не запрашивает.
-- Срезы нельзя суммировать между собой: одна попытка намеренно входит в несколько.
${
  pageOnly
    ? `scopes AS (SELECT 'selected' AS scope,b.output_id FROM bounds b),`
    : `scopes AS (
  SELECT 'selected' AS scope,b.output_id FROM bounds b UNION ALL
  SELECT CAST(o.output_id AS TEXT),o.output_id FROM observed_outputs o,bounds b
    WHERE b.include_outputs GROUP BY o.output_id
),`
}

-- Привязываем попытку к срезу. Для конкретного выхода проверяем его присутствие.
-- Если последнее metadata_at оказалось в будущем, нужны более ранние свидетельства,
-- иначе перевод часов назад мог бы добавить ещё не наблюдавшийся выход.
scoped_attempts AS MATERIALIZED (
  SELECT a.*,s.scope,s.output_id FROM own a JOIN relevant r ON r.attempt_id=a.id CROSS JOIN scopes s,bounds b
  WHERE s.output_id IS NULL OR EXISTS (
    SELECT 1 FROM attempt_outputs ao WHERE ao.attempt_id=a.id AND ao.output_id=s.output_id
      AND (ao.metadata_at<=b.now OR EXISTS (
        SELECT 1 FROM segments os JOIN segments_output so ON so.segment_id=os.id
          WHERE os.attempt_id=a.id AND so.output_id=s.output_id AND os.end_at<=b.now) OR EXISTS (
        SELECT 1 FROM events ev,json_each(ev.output,'$.outputs') j WHERE ev.attempt_id=a.id
          AND ev.at<=b.now AND CAST(json_extract(j.value,'$.id') AS INTEGER)=s.output_id)))
),
-- Каждый тип события даёт не больше единицы на попытку В ВЫБРАННОМ ПЕРИОДЕ.
-- MIN нужен также для отнесения счётчика к дню; поля attempts.*_at описывают
-- всю попытку и не заменяют поиск события внутри запрошенного периода.
metric_times AS (
  SELECT attempt_id,
    MIN(CASE WHEN type='started' THEN at END) AS starts_at,
    MIN(CASE WHEN type='completed' THEN at END) AS completed_at,
    MIN(CASE WHEN type='error' THEN at END) AS errors_at,
    MIN(CASE WHEN type='skipped' THEN at END) AS skipped_at,
    MIN(CASE WHEN type='interrupted' THEN at END) AS interrupted_at
  FROM selected_events GROUP BY attempt_id
),
-- Одна попытка даёт один интервал: первый принятый кадр → первый исход.
-- Паузы, ожидание кадров и перемотки не вычитаем. Незавершённую попытку
-- не достраиваем до now; отсутствие начала и обратный ход часов дают ноль.
-- first_at ограничивает восстановленный startedAt границей хранения.
scoped_intervals AS MATERIALIZED (
  SELECT a.scope,a.id AS attempt_id,
    MAX(COALESCE(a.started_at,a.declared_started_at),a.first_at,b.lo) AS lo,
    MIN(a.terminal_at,b.hi) AS hi,
    a.terminal='completed' AND CASE WHEN a.output_id IS NULL THEN a.completed_status
      ELSE (SELECT completed_status FROM attempt_outputs ao
        WHERE ao.attempt_id=a.id AND ao.output_id=a.output_id) END='confirmed' AS healthy
  FROM ${pageOnly ? 'history_page' : 'scoped_attempts'} a,bounds b
  WHERE MIN(a.terminal_at,b.hi)>MAX(COALESCE(a.started_at,a.declared_started_at),a.first_at,b.lo)
),
-- Никакого анализа кадров, дробных весов и оконной сортировки сегментов.
-- Исправное время — весь интервал только полностью подтверждённого завершения.
durations AS (
  SELECT scope,attempt_id,hi-lo AS playedMs,
    CASE WHEN healthy THEN hi-lo ELSE 0 END AS successfulMs FROM scoped_intervals
),
-- Одна строка на пару (попытка, срез): счётчики, длительности и результат завершения.
-- completed_status отвечает за качество completed, terminal — за первый исход
-- попытки в истории. Это разные факты, даже если обычно они совпадают.
-- incomplete — отсутствие исхода либо completed без корректной пары начало/конец.
attempt_metrics AS MATERIALIZED (
  SELECT ${pageOnly ? 'a.*' : 'a.scope,a.id,a.media_id,a.filename,a.filename_at'},COALESCE(d.playedMs,0) AS playedMs,COALESCE(d.successfulMs,0) AS successfulMs,
    m.starts_at IS NOT NULL AS starts,m.completed_at IS NOT NULL AS completed,
    m.errors_at IS NOT NULL AS errors,m.skipped_at IS NOT NULL AS skipped,
    m.interrupted_at IS NOT NULL AS interrupted,
    CASE WHEN a.output_id IS NULL THEN COALESCE(a.completed_status,'unconfirmed')
      ELSE COALESCE((SELECT completed_status FROM attempt_outputs ao
        WHERE ao.attempt_id=a.id AND ao.output_id=a.output_id),'unconfirmed') END AS status,
    (a.terminal IS NULL OR (a.terminal='completed' AND
      (COALESCE(a.started_at,a.declared_started_at) IS NULL OR
       a.terminal_at<COALESCE(a.started_at,a.declared_started_at)))) AS incomplete
  FROM scoped_attempts a LEFT JOIN metric_times m ON m.attempt_id=a.id
  LEFT JOIN durations d ON d.attempt_id=a.id AND d.scope=a.scope
)
`;
const metricSum = `SUM(starts) AS starts,SUM(completed) AS completed,SUM(errors) AS errors,
SUM(skipped) AS skipped,SUM(interrupted) AS interrupted,SUM(playedMs) AS playedMs,
SUM(successfulMs) AS successfulMs,
SUM(completed AND status='confirmed') AS confirmed,SUM(completed AND status='partial') AS partial,
SUM(completed AND status='unconfirmed') AS unconfirmed`;

type ScopeMetrics = PlaybackStatisticsMetrics & { scope: string; incomplete: number };
type SqlOutput = {
  id: number;
  name: string;
  display: number | null;
  resolved_display_id: number | null;
};
type SqlResultOutput = SqlOutput & {
  attempt_id: string;
  state: PlaybackOutputState;
  status: PlaybackOutputResult['status'];
  reasons: string;
};
const outputIdentity = (output: SqlOutput) => ({
  id: output.id,
  name: output.name,
  display: output.display ?? undefined,
  resolvedDisplayId: output.resolved_display_id ?? undefined,
});

const metricNames = Object.keys(emptyMetrics());
type ReportParts = {
  total: ScopeMetrics;
  media: PlaybackStatisticsMetrics & { mediaId: string; filename: string };
  day: PlaybackStatisticsMetrics & { date: string; hasRecords: number };
  output: SqlOutput;
  reason: { output_id: number; reason: PlaybackOutputState; count: number };
};

// UNION ALL помечает строки полем kind: пять разделов делят одну цепочку facts.
// Оставляем нативные числовые столбцы: JSON-форматирование SQLite теряет точность
// больших системных ID дисплеев. Пропуски в общей форме строки заполняются NULL.
// Имена столбцов заданы кодом; значения пользователя передаются только параметрами.
const reportColumns = [
  'scope',
  'incomplete',
  'mediaId',
  'filename',
  'date',
  'hasRecords',
  'id',
  'name',
  'display',
  'resolved_display_id',
  'output_id',
  'reason',
  'count',
  'reasonOrderAt',
  'reasonOrderIndex',
  ...metricNames,
];
type ReportRow = { [K in keyof ReportParts]: ReportParts[K] & { kind: K } }[keyof ReportParts];
const reportPart = (kind: keyof ReportParts, columns: string[], query: string): string =>
  `SELECT '${kind}' AS kind,${reportColumns.map(column => (columns.includes(column) ? column : `NULL AS ${column}`)).join(',')}
   FROM (${query})`;

const totalsQuery = `SELECT scope,${metricSum},SUM(incomplete) AS incomplete FROM attempt_metrics GROUP BY scope`;
// Последнее имя среди вошедших в отчёт попыток выбираем одним ранжированием.
// Это исключает повторное сканирование для каждого ролика; id разрешает равенство дат.
const mediaQuery = `SELECT media_id AS mediaId,
        MAX(CASE WHEN filename_rank=1 THEN filename END) AS filename,${metricSum}
        FROM (SELECT *,ROW_NUMBER() OVER (
          PARTITION BY media_id ORDER BY filename_at DESC,id DESC) AS filename_rank
          FROM attempt_metrics WHERE scope='selected') GROUP BY media_id`;

// Имя и назначение выхода берём на дату последнего наблюдения в выбранном периоде,
// чтобы последующее переименование не переписало исторический отчёт.
const outputsQuery = `SELECT o.output_id AS id,o.name,o.display,o.resolved_display_id
        FROM output_observations o JOIN (
          SELECT output_id,MAX(at) AS at FROM observed_outputs GROUP BY output_id
        ) chosen ON chosen.output_id=o.output_id,bounds b
        WHERE o.player_id=b.player AND o.at=COALESCE((SELECT MAX(p.at) FROM output_observations p
          WHERE p.player_id=o.player_id AND p.output_id=o.output_id AND p.at<=chosen.at),
          (SELECT MIN(p.at) FROM output_observations p
          WHERE p.player_id=o.player_id AND p.output_id=o.output_id AND p.at<=b.now))`;
// Считаем причины completed по попыткам, а не по числу повторений в JSON-массиве.
const reasonsQuery = `SELECT ao.output_id,j.value AS reason,COUNT(DISTINCT ao.attempt_id) AS count,
        MIN(a.first_at) AS reasonOrderAt,MIN(CAST(j.key AS INTEGER)) AS reasonOrderIndex
        FROM attempt_outputs ao JOIN scoped_attempts a ON a.id=ao.attempt_id
          AND a.scope=CAST(ao.output_id AS TEXT),
          bounds b,json_each(COALESCE(ao.completed_reasons,'["unknown"]')) j
        WHERE a.completed_at>=b.lo AND a.completed_at<=b.hi AND a.completed_at<b.finish
        GROUP BY ao.output_id,j.value`;

export class PlaybackStatisticsSqlReader {
  constructor(
    private readonly store: Pick<PlaybackStatisticsStore, 'read'>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async statistics(query: PlaybackStatisticsQuery): Promise<PlaybackStatistics> {
    // Валидация не занимает очередь. Сам now фиксируем после получения снимка,
    // чтобы ожидание предыдущего отчёта не превращало свежие факты в «будущие».
    statisticsPeriod(query, this.now());
    return this.store.read(async sql => {
      const now = this.now();
      const period = statisticsPeriod(query, now);
      // Запрос 1: доступный диапазон для плеера (не только запрошенного выхода).
      // По нему ограничиваем период и формируем available/effective/clipped.
      let coverage = await sql.get<{ first: number | null; last: number | null }>(
        'SELECT MIN(first_at) AS first,MAX(last_at) AS last FROM attempts WHERE player_id=? AND first_at<=?',
        [query.playerId, now.getTime()],
      );
      // Редкий дополнительный запрос при откате часов: ищем реальные факты <= now.
      // Простое MIN(last_at, now) выдумало бы наблюдение в текущую секунду.
      if (coverage?.last != null && coverage.last > now.getTime()) {
        coverage = await sql.get(
          `SELECT MIN(first) AS first,MAX(last) AS last FROM (
            SELECT MIN(e.at) AS first,MAX(e.at) AS last FROM events e
              JOIN attempts a ON a.id=e.attempt_id WHERE a.player_id=? AND e.at<=?
            UNION ALL SELECT MIN(s.start_at),MAX(s.end_at) FROM segments s
              JOIN attempts a ON a.id=s.attempt_id WHERE a.player_id=? AND s.end_at<=?
            UNION ALL SELECT MIN(MAX(a.first_at,COALESCE(a.started_at,a.declared_started_at))),MAX(a.terminal_at)
              FROM attempts a WHERE a.player_id=? AND a.terminal_at<=?
              AND a.terminal_at>=COALESCE(a.started_at,a.declared_started_at))`,
          [
            query.playerId,
            now.getTime(),
            query.playerId,
            now.getTime(),
            query.playerId,
            now.getTime(),
          ],
        );
      }
      const first = coverage?.first;
      const last = coverage?.last;
      const lower = Math.max(first ?? Infinity, period.from);
      const upper = Math.min(last ?? -Infinity, period.to);
      const available = first != null && last != null ? { from: iso(first), to: iso(last) } : null;
      const effective =
        available && lower <= upper && lower < period.to && upper >= period.from
          ? { from: iso(lower), to: iso(upper) }
          : null;
      const result: PlaybackStatistics = {
        durationBasis: 'wall-clock',
        playerId: query.playerId,
        outputId: query.outputId,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        today: period.today,
        generatedAt: now.toISOString(),
        requestedDates: period.dates,
        requested: { from: iso(period.from), to: iso(period.to) },
        available,
        effective,
        clipped: !effective || lower > period.from || upper < period.to,
        totals: emptyMetrics(),
        rows: [],
        outputs: [],
        days: [],
        quality: {
          ignoredLegacyRecords: 0,
          invalidRecords: 0,
          unreadableFiles: 0,
          incompleteAttempts: 0,
        },
      };
      // Если период не пересекается с доступной историей, тяжёлый SQL не выполняем.
      if (!effective) return result;
      const days = calendarDays(lower, upper).filter(day => day.from < period.to);
      const params: PlaybackSqlValue[] = [
        query.playerId,
        lower,
        upper,
        period.to,
        now.getTime(),
        query.outputId ?? null,
        null,
        1,
      ];
      const cte = `WITH bounds(player,lo,hi,finish,now,output_id,media,include_outputs) AS (VALUES(?,?,?,?,?,?,?,?)),${facts()}`;
      // Запрос 2: все разделы одной сводки. CTE внутри не добавляют обращений к БД.
      // ORDER BY снаружи задаёт порядок дней/выходов/причин для последующей сборки.
      const parts = await sql.all<ReportRow>(
        `${cte},${dailyFacts}
        ${reportPart('total', ['scope', 'incomplete', ...metricNames], totalsQuery)}
        UNION ALL ${reportPart('media', ['mediaId', 'filename', ...metricNames], mediaQuery)}
        UNION ALL ${reportPart('day', ['date', 'hasRecords', ...metricNames], daysQuery)}
        UNION ALL ${reportPart('output', ['id', 'name', 'display', 'resolved_display_id'], outputsQuery)}
        UNION ALL ${reportPart('reason', ['output_id', 'reason', 'count', 'reasonOrderAt', 'reasonOrderIndex'], reasonsQuery)}
        ORDER BY kind,date,id,output_id,reasonOrderAt,reasonOrderIndex`,
        [...params, JSON.stringify(days)],
      );
      const rows = <K extends ReportRow['kind']>(kind: K) =>
        parts.filter((part): part is Extract<ReportRow, { kind: K }> => part.kind === kind);
      const totals = rows('total');
      const selected = totals.find(row => row.scope === 'selected');
      if (selected) {
        result.totals = metrics(selected);
        result.quality.incompleteAttempts = selected.incomplete;
      }
      result.rows = rows('media')
        .map(row => ({ mediaId: row.mediaId, filename: row.filename, ...metrics(row) }))
        .sort((a, b) => b.successfulMs - a.successfulMs || a.filename.localeCompare(b.filename));
      result.days = rows('day').map(row => ({
        date: row.date,
        hasRecords: Boolean(row.hasRecords),
        ...metrics(row),
      }));
      const reasons = rows('reason');
      result.outputs = rows('output').flatMap(output => {
        const part = totals.find(row => row.scope === String(output.id));
        if (!part) return [];
        return [
          {
            ...outputIdentity(output),
            ...metrics(part),
            reasons: reasons
              .filter(reason => reason.output_id === output.id)
              .map(({ reason, count }) => ({ reason, count })),
          },
        ];
      });
      return result;
    });
  }

  async history(query: PlaybackHistoryQuery): Promise<PlaybackHistory> {
    statisticsPeriod(query, this.now());
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 50;
    if (
      !query.mediaId ||
      query.mediaId.length > 512 ||
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      offset > PLAYBACK_HISTORY_MAX_OFFSET ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      throw new PlaybackStatisticsQueryError('Invalid history pagination or mediaId');
    return this.store.read(async sql => {
      const now = this.now();
      const period = statisticsPeriod(query, now);
      const params: PlaybackSqlValue[] = [
        query.playerId,
        period.from,
        period.to,
        period.to,
        now.getTime(),
        query.outputId ?? null,
        query.mediaId,
        0,
      ];
      // Истории нужны попытки и длительности, но не сводные счётчики и срезы всех выходов.
      // Сначала выбираем страницу; длительности вычисляем только для её попыток.
      const cte = `WITH bounds(player,lo,hi,finish,now,output_id,media,include_outputs) AS (VALUES(?,?,?,?,?,?,?,?)),${facts(true)},
        candidates AS MATERIALIZED (SELECT * FROM scoped_attempts WHERE scope='selected'),
        history_page AS MATERIALIZED (
          SELECT * FROM candidates ORDER BY COALESCE(terminal_at,last_at) DESC,id LIMIT ? OFFSET ?)`;
      type Candidate = {
        id: string;
        filename: string;
        started_at: number | null;
        declared_started_at: number | null;
        terminal: PlaybackHistoryEntry['outcome'] | null;
        terminal_at: number | null;
        last_at: number;
        result_status: PlaybackOutputResult['status'] | null;
        result_reasons: string | null;
        playedMs: number;
        successfulMs: number;
        skipped_at: number | null;
      };
      // Запрос 1 истории: total и страница используют одну выборку candidates.
      // LEFT JOIN сохраняет total даже при offset за концом истории (page.id = NULL).
      const page = await sql.all<Candidate & { count: number }>(
        `${cte} SELECT totals.count,page.*,COALESCE(d.playedMs,0) AS playedMs,
          COALESCE(d.successfulMs,0) AS successfulMs
        FROM (SELECT COUNT(*) AS count FROM candidates) totals
        LEFT JOIN history_page page ON 1
        LEFT JOIN durations d ON d.attempt_id=page.id AND d.scope=page.scope
        ORDER BY COALESCE(page.terminal_at,page.last_at) DESC,page.id`,
        [...params, limit, offset],
      );
      const total = page[0]?.count ?? 0;
      const selected = page.filter(row => row.id != null);
      const entries: PlaybackHistoryEntry[] = selected.map(row => ({
        playbackId: row.id,
        mediaId: query.mediaId,
        filename: row.filename,
        startedAt:
          row.started_at != null
            ? iso(row.started_at)
            : row.declared_started_at != null
              ? iso(row.declared_started_at)
              : undefined,
        timestamp: iso(row.terminal_at ?? row.last_at),
        outcome: row.terminal ?? 'pending',
        playedMs: Math.round(row.playedMs),
        successfulMs: Math.round(row.successfulMs),
        outputResult: {
          status:
            query.outputId === undefined ? (row.result_status ?? 'unconfirmed') : 'unconfirmed',
          outputs: [],
          reasons:
            query.outputId === undefined
              ? (JSON.parse(row.result_reasons ?? '["unknown"]') as PlaybackOutputState[])
              : ['unknown'],
        },
        skipped: row.skipped_at != null,
        events: [],
      }));
      if (!entries.length) return { entries, total, offset, limit };
      const ids = entries.map(entry => entry.playbackId);
      const placeholders = ids.map(() => '?').join(',');
      // Запрос 2 истории: результаты выходов только выбранных попыток.
      // Назначение дисплея восстанавливаем на дату terminal, не из текущих настроек.
      const outputs = await sql.all<SqlResultOutput>(
        `SELECT ao.attempt_id,ao.output_id AS id,COALESCE(o.name,ao.name) AS name,
          CASE WHEN o.at IS NULL THEN ao.display ELSE o.display END AS display,
          CASE WHEN o.at IS NULL THEN ao.resolved_display_id ELSE o.resolved_display_id END AS resolved_display_id,
          ao.result_state AS state,ao.result_status AS status,ao.result_reasons AS reasons
        FROM attempt_outputs ao JOIN attempts a ON a.id=ao.attempt_id LEFT JOIN output_observations o
          ON o.player_id=a.player_id AND o.output_id=ao.output_id AND o.at=(
            SELECT MAX(p.at) FROM output_observations p WHERE p.player_id=a.player_id AND p.output_id=ao.output_id AND p.at<=a.terminal_at)
        WHERE ao.attempt_id IN (${placeholders}) AND ao.result_status IS NOT NULL AND a.terminal_at<=?
          ${query.outputId === undefined ? '' : 'AND ao.output_id=?'} ORDER BY ao.output_id`,
        query.outputId === undefined
          ? [...ids, now.getTime()]
          : [...ids, now.getTime(), query.outputId],
      );
      for (const entry of entries) {
        const own = outputs
          .filter(output => output.attempt_id === entry.playbackId)
          .map(output => ({
            ...outputIdentity(output),
            state: output.state,
            status: output.status,
            reasons: JSON.parse(output.reasons) as PlaybackOutputState[],
          }));
        entry.outputResult!.outputs = own;
        if (query.outputId !== undefined && own.length) {
          entry.outputResult!.status = own[0].status;
          entry.outputResult!.reasons = own[0].reasons;
        }
      }
      // Запрос 3 истории: последние 1000 событий КАЖДОЙ попытки страницы.
      // COUNT считает все события до ограничения rank; в ответе сохраняем число
      // опущенных событий и возвращаем отобранные детали в хронологическом порядке.
      const details = await sql.all<{
        attempt_id: string;
        at: number;
        type: string;
        error: string | null;
        reason: string | null;
        output: string | null;
        count: number;
      }>(
        `WITH details AS (SELECT e.*,ROW_NUMBER() OVER(PARTITION BY attempt_id ORDER BY at DESC,e.rowid DESC) AS rank,
          COUNT(*) OVER(PARTITION BY attempt_id) AS count FROM events e WHERE attempt_id IN (${placeholders}) AND at<=?)
        SELECT * FROM details WHERE rank<=1000 ORDER BY at,rank DESC`,
        [...ids, now.getTime()],
      );
      const byId = new Map(entries.map(entry => [entry.playbackId, entry]));
      const counts = new Map<string, number>();
      for (const detail of details) {
        counts.set(detail.attempt_id, detail.count);
        byId.get(detail.attempt_id)!.events.push({
          event: detail.type,
          timestamp: iso(detail.at),
          error: detail.error ?? undefined,
          reason: detail.reason ?? undefined,
          output:
            detail.output == null
              ? undefined
              : (JSON.parse(detail.output) as PlaybackHistoryEntry['events'][number]['output']),
        });
      }
      for (const entry of entries) {
        const omitted = (counts.get(entry.playbackId) ?? 0) - 1000;
        if (omitted > 0)
          entry.events.unshift({
            event: 'details-truncated',
            timestamp: entry.events[0].timestamp,
            reason: `Показаны последние 1000 событий; более ранних событий: ${omitted}.`,
          });
      }
      return { entries, total, offset, limit };
    });
  }
}
