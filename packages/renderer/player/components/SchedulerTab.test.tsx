import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import type { SchedulerTabProps } from '../../common/SchedulerTab';
import type {
  PlayerSchedulerAction,
  PlayerSchedulerJob,
  PlayerSchedulerJobInput,
} from '/@common/scheduler';
import type { Playlist } from '/@common/playlist';

const state = vi.hoisted((): { version: string; remote: boolean; kind: 'cron' | 'once' } => ({
  version: '5.7.7',
  remote: true,
  kind: 'cron',
}));
vi.mock('/@common/remote', () => ({
  get version() {
    return state.version;
  },
  get isRemoteSession() {
    return state.remote;
  },
}));
vi.mock('../utils', () => ({ sourceId: 1 }));
vi.mock('../api/playlists', () => ({ useGetPlaylists: () => ({ data: [] }) }));
vi.mock('../api/scheduler', () => ({
  useGetSchedulerJobsQuery: () => ({ data: [] }),
  useCreateSchedulerJobMutation: () => [vi.fn()],
  useUpdateSchedulerJobMutation: () => [vi.fn()],
  useDeleteSchedulerJobMutation: () => [vi.fn()],
  useRunSchedulerJobMutation: () => [vi.fn(), {}],
}));
vi.mock('../../common/SchedulerTab', () => ({
  default: (
    props: SchedulerTabProps<
      PlayerSchedulerJob,
      PlayerSchedulerJobInput,
      PlayerSchedulerAction,
      Playlist[]
    >,
  ) =>
    props.renderActionFields({
      values: props.createInitialValues(state.kind),
      setValues: vi.fn(),
      kind: state.kind,
      related: [],
    }),
}));
import SchedulerTab from './SchedulerTab';
beforeEach(() => {
  state.version = '5.7.7';
  state.remote = true;
  state.kind = 'cron';
});
it.each([
  ['5.7.6', false],
  ['5.7.7', true],
  ['5.8.0', true],
])('gates expiry controls on remote %s', (version, supported) => {
  state.version = version;
  const html = renderToStaticMarkup(<SchedulerTab />);
  expect(html.includes('Действует до')).toBe(supported);
  expect(html.includes('Остановить воспроизведение по окончании')).toBe(supported);
});
it('keeps local expiry controls available before release versioning', () => {
  state.version = '5.7.6';
  state.remote = false;
  expect(renderToStaticMarkup(<SchedulerTab />)).toContain('Действует до');
});
it('does not offer expiry for single-occurrence tasks', () => {
  state.kind = 'once';
  expect(renderToStaticMarkup(<SchedulerTab />)).not.toContain('Действует до');
});
