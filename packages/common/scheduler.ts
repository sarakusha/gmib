export type ScheduleKind = 'once' | 'cron';
export type PlayerSchedulerAction =
  | 'load-playlist'
  | 'toggle-play'
  | 'play'
  | 'stop'
  | 'hide-output'
  | 'show-output'
  | 'next'
  | 'play-item';
export type GmibSchedulerAction =
  'show-test' | 'hide-test' | 'set-brightness' | 'set-autobrightness' | 'set-overheat-protection';
export type CronMode = 'all' | 'every' | 'select';
export type SimpleCronMode = 'all' | 'select';
export type SchedulerStatus = 'idle' | 'success' | 'error';

export type CronPart = {
  mode: CronMode;
  every: number;
  selected: number[];
};

export type SimpleCronPart = {
  mode: SimpleCronMode;
  selected: number[];
};

export type CronSchedule = {
  seconds: CronPart;
  minutes: CronPart;
  hours: CronPart;
  days: SimpleCronPart;
  months: SimpleCronPart;
  weekdays: SimpleCronPart;
};

export type SchedulerJobBase = {
  id: string;
  kind: ScheduleKind;
  name: string;
  runAt?: string;
  cron?: CronSchedule;
  enabled: boolean;
  priority: number;
  lastRunAt?: string;
  lastRunKey?: string;
  lastStatus?: SchedulerStatus;
  lastMessage?: string;
  nextRunAt?: string;
  action?: PlayerSchedulerAction | GmibSchedulerAction;
};

export type PlayerSchedulerJob = SchedulerJobBase & {
  playerId: number;
  action: PlayerSchedulerAction;
  playlistId?: number;
  itemNumber?: number;
  hideOutputOnStop?: boolean;
  outputAll?: boolean;
};

export type PlayerSchedulerJobInput = Omit<
  PlayerSchedulerJob,
  'id' | 'lastRunAt' | 'lastRunKey' | 'lastStatus' | 'lastMessage' | 'nextRunAt'
> & {
  id?: string;
};

export type GmibSchedulerJob = SchedulerJobBase & {
  action: GmibSchedulerAction;
  screenId?: number;
  testId?: string;
  brightness?: number;
  enabledValue?: boolean;
};

export type GmibSchedulerJobInput = Omit<
  GmibSchedulerJob,
  'id' | 'lastRunAt' | 'lastRunKey' | 'lastStatus' | 'lastMessage' | 'nextRunAt'
> & {
  id?: string;
};

export const normalizeSelected = (selected: number[]): number[] =>
  Array.from(new Set(selected)).sort((a, b) => a - b);

export const defaultCron = (): CronSchedule => ({
  seconds: { mode: 'select', every: 1, selected: [0] },
  minutes: { mode: 'every', every: 10, selected: [] },
  hours: { mode: 'all', every: 1, selected: [] },
  days: { mode: 'all', selected: [] },
  months: { mode: 'all', selected: [] },
  weekdays: { mode: 'all', selected: [] },
});

export const normalizeCronSchedule = (cron?: Partial<CronSchedule>): CronSchedule => ({
  ...defaultCron(),
  ...cron,
  seconds: cron?.seconds ?? defaultCron().seconds,
});

export const partToCron = (part: CronPart): string => {
  if (part.mode === 'all') return '*';
  if (part.mode === 'every') return `*/${part.every}`;
  return normalizeSelected(part.selected).join(',') || '*';
};

export const simplePartToCron = (part: SimpleCronPart): string =>
  part.mode === 'all' ? '*' : normalizeSelected(part.selected).join(',') || '*';

export const cronToString = (cron: CronSchedule): string =>
  [
    partToCron(cron.seconds),
    partToCron(cron.minutes),
    partToCron(cron.hours),
    simplePartToCron(cron.days),
    simplePartToCron(cron.months),
    simplePartToCron(cron.weekdays),
  ].join(' ');

const matchesPart = (part: CronPart, value: number): boolean => {
  if (part.mode === 'all') return true;
  if (part.mode === 'every') return value % part.every === 0;
  return part.selected.includes(value);
};

const matchesSimplePart = (part: SimpleCronPart, value: number): boolean =>
  part.mode === 'all' || part.selected.includes(value);

export const matchesCron = (cron: CronSchedule, date: Date): boolean =>
  matchesPart(cron.seconds, date.getSeconds()) &&
  matchesPart(cron.minutes, date.getMinutes()) &&
  matchesPart(cron.hours, date.getHours()) &&
  matchesSimplePart(cron.days, date.getDate()) &&
  matchesSimplePart(cron.months, date.getMonth() + 1) &&
  matchesSimplePart(cron.weekdays, date.getDay());

const matchesCronMinute = (cron: CronSchedule, date: Date): boolean =>
  matchesPart(cron.minutes, date.getMinutes()) &&
  matchesPart(cron.hours, date.getHours()) &&
  matchesSimplePart(cron.days, date.getDate()) &&
  matchesSimplePart(cron.months, date.getMonth() + 1) &&
  matchesSimplePart(cron.weekdays, date.getDay());

export const getRunKey = (date: Date): string =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`;

export const describeCron = (cron: CronSchedule): string => {
  const seconds =
    cron.seconds.mode === 'all'
      ? 'каждую секунду'
      : cron.seconds.mode === 'every'
        ? `каждые ${cron.seconds.every} сек.`
        : `в ${normalizeSelected(cron.seconds.selected).join(', ')} сек.`;
  const minutes =
    cron.minutes.mode === 'all'
      ? 'каждую минуту'
      : cron.minutes.mode === 'every'
        ? `каждые ${cron.minutes.every} мин.`
        : `в ${normalizeSelected(cron.minutes.selected).join(', ')} мин.`;
  const hours =
    cron.hours.mode === 'all'
      ? 'ежечасно'
      : cron.hours.mode === 'every'
        ? `каждые ${cron.hours.every} ч.`
        : `в ${normalizeSelected(cron.hours.selected).join(', ')} ч.`;
  const days =
    cron.days.mode === 'all'
      ? ''
      : `, дни месяца: ${normalizeSelected(cron.days.selected).join(', ')}`;
  const months =
    cron.months.mode === 'all'
      ? ''
      : `, месяцы: ${normalizeSelected(cron.months.selected).join(', ')}`;
  const weekdays =
    cron.weekdays.mode === 'all'
      ? ''
      : `, дни недели: ${normalizeSelected(cron.weekdays.selected).join(', ')}`;
  return `Повторять ${seconds}, ${minutes}, ${hours}${days}${months}${weekdays}`;
};

export const getNextRunAt = (job: SchedulerJobBase, from = new Date()): string | undefined => {
  if (!job.enabled) return undefined;
  if (job.kind === 'once') {
    if (!job.runAt) return undefined;
    const runAt = new Date(job.runAt);
    return Number.isNaN(runAt.getTime()) ? undefined : runAt.toISOString();
  }
  if (!job.cron) return undefined;
  const next = new Date(from.getTime() + 1000);
  next.setMilliseconds(0);
  for (let i = 0; i < 60 * 24 * 366; i += 1) {
    const firstSecond = i === 0 ? next.getSeconds() : 0;
    if (matchesCronMinute(job.cron, next)) {
      for (let second = firstSecond; second < 60; second += 1) {
        next.setSeconds(second);
        if (matchesPart(job.cron.seconds, second)) return next.toISOString();
      }
    }
    next.setSeconds(0);
    next.setMinutes(next.getMinutes() + 1);
  }
  return undefined;
};
