// JSON суток разбираем единожды. Их границы уже вычислены JS в местном часовом
// поясе, поэтому переход DST не подменяется фиксированной длительностью суток.
export const dailyFacts = `
days AS MATERIALIZED (
  SELECT json_extract(value,'$.date') AS date,json_extract(value,'$.from') AS lo,
    json_extract(value,'$.to') AS hi FROM json_each(?)
),
-- MIN каждого типа берётся из metric_times за весь выбранный период.
-- Группируем счётчики сразу: строк сегментов в этой ветке нет.
daily_event_counts AS MATERIALIZED (
  SELECT d.date,
    SUM(m.starts_at>=d.lo AND m.starts_at<d.hi) AS starts,
    SUM(m.completed_at>=d.lo AND m.completed_at<d.hi) AS completed,
    SUM(m.errors_at>=d.lo AND m.errors_at<d.hi) AS errors,
    SUM(m.skipped_at>=d.lo AND m.skipped_at<d.hi) AS skipped,
    SUM(m.interrupted_at>=d.lo AND m.interrupted_at<d.hi) AS interrupted,
    SUM((m.completed_at>=d.lo AND m.completed_at<d.hi) AND a.status='confirmed') AS confirmed,
    SUM((m.completed_at>=d.lo AND m.completed_at<d.hi) AND a.status='partial') AS partial,
    SUM((m.completed_at>=d.lo AND m.completed_at<d.hi) AND a.status='unconfirmed') AS unconfirmed
  FROM days d JOIN attempt_metrics a ON a.scope='selected'
  JOIN metric_times m ON m.attempt_id=a.id
  WHERE (m.starts_at>=d.lo AND m.starts_at<d.hi) OR (m.completed_at>=d.lo AND m.completed_at<d.hi)
    OR (m.errors_at>=d.lo AND m.errors_at<d.hi) OR (m.skipped_at>=d.lo AND m.skipped_at<d.hi)
    OR (m.interrupted_at>=d.lo AND m.interrupted_at<d.hi)
  GROUP BY d.date
),
-- Длительности складываются независимо от событий до соединения с суточными
-- счётчиками: второй GROUP BY над общей широкой UNION ALL больше не нужен.
daily_durations AS MATERIALIZED (
  SELECT d.date,
    SUM(MIN(s.hi,d.hi)-MAX(s.lo,d.lo)) AS playedMs,
    SUM(CASE WHEN s.healthy THEN MIN(s.hi,d.hi)-MAX(s.lo,d.lo) ELSE 0 END) AS successfulMs
  FROM scoped_intervals s JOIN days d ON MIN(s.hi,d.hi)>MAX(s.lo,d.lo)
  WHERE s.scope='selected'
  GROUP BY d.date
)`;

export const daysQuery = `
SELECT d.date,
  COALESCE(e.starts,0) AS starts,COALESCE(e.completed,0) AS completed,
  COALESCE(e.errors,0) AS errors,COALESCE(e.skipped,0) AS skipped,
  COALESCE(e.interrupted,0) AS interrupted,COALESCE(t.playedMs,0) AS playedMs,
  COALESCE(t.successfulMs,0) AS successfulMs,COALESCE(e.confirmed,0) AS confirmed,
  COALESCE(e.partial,0) AS partial,COALESCE(e.unconfirmed,0) AS unconfirmed,
  -- Наличие группы подтверждает факт даже при playedMs=0. Сырые записи ищем
  -- только в оставшихся днях: пауза или нулевой сегмент тоже делают день непустым.
  CASE WHEN e.date IS NOT NULL OR t.date IS NOT NULL THEN 1 ELSE
    EXISTS(SELECT 1 FROM selected_events ev JOIN scoped_attempts a
      ON a.id=ev.attempt_id AND a.scope='selected' WHERE ev.at>=d.lo AND ev.at<d.hi) OR
    EXISTS(SELECT 1 FROM observed_segments s JOIN scoped_attempts a
      ON a.id=s.attempt_id AND a.scope='selected',bounds b
      WHERE s.end_at>=b.lo AND s.end_at<=b.hi AND s.end_at<b.finish
        AND s.end_at>=d.lo AND s.end_at<d.hi)
  END AS hasRecords
FROM days d LEFT JOIN daily_event_counts e ON e.date=d.date
LEFT JOIN daily_durations t ON t.date=d.date`;
