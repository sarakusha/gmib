import type { SchedulerJobBase } from '/@common/scheduler';

export type SchedulerOrderItem = {
  scope: 'gmib' | 'player';
  job: Pick<SchedulerJobBase, 'id' | 'priority'>;
  scheduledAt: number;
};

export const compareSchedulerOrder = (
  left: SchedulerOrderItem,
  right: SchedulerOrderItem,
): number =>
  left.scheduledAt - right.scheduledAt ||
  right.job.priority - left.job.priority ||
  left.scope.localeCompare(right.scope) ||
  left.job.id.localeCompare(right.job.id);
