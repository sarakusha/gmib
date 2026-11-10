import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import type { SchedulerTabProps } from '../../common/SchedulerTab';
import type {
  GmibSchedulerAction,
  GmibSchedulerJob,
  GmibSchedulerJobInput,
} from '/@common/scheduler';
import type { Screen } from '/@common/video';
import type { Page } from '/@common/config';

const state = vi.hoisted((): { version: string; remote: boolean; kind: 'cron' | 'once' } => ({
  version: '5.7.8',
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
vi.mock('../api/config', () => ({ usePages: () => ({ pages: [] }) }));
vi.mock('../api/screens', () => ({ useScreens: () => ({ screens: [] }) }));
vi.mock('../providers/ToolbarProvider', () => ({ useToolbar: () => [null, vi.fn()] }));
vi.mock('../store/selectors', () => ({
  selectSessionVersion: () => state.version,
  selectCurrentTab: () => 'scheduler',
}));
vi.mock('../store', () => ({ useSelector: (selector: () => unknown) => selector() }));
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
      GmibSchedulerJob,
      GmibSchedulerJobInput,
      GmibSchedulerAction,
      { screens: Screen[]; pages: Page[] }
    >,
  ) =>
    props.renderActionFields({
      values: props.createInitialValues(state.kind),
      setValues: vi.fn(),
      kind: state.kind,
      related: { screens: [], pages: [] },
    }),
}));
import SchedulerTab from './SchedulerTab';
beforeEach(() => {
  state.version = '5.7.8';
  state.remote = true;
  state.kind = 'cron';
});
it.each([
  ['5.7.7', false],
  ['5.7.8', true],
  ['5.8.0', true],
])('gates expiry controls on remote %s', (version, supported) => {
  state.version = version;
  const html = renderToStaticMarkup(<SchedulerTab />);
  expect(html.includes('Действует до')).toBe(supported);
  expect(html).not.toContain('Остановить воспроизведение по окончании');
});
it('keeps local expiry controls available before release versioning', () => {
  state.version = '5.7.7';
  state.remote = false;
  expect(renderToStaticMarkup(<SchedulerTab />)).toContain('Действует до');
});
it('does not offer expiry for single-occurrence tasks', () => {
  state.kind = 'once';
  expect(renderToStaticMarkup(<SchedulerTab />)).not.toContain('Действует до');
});
