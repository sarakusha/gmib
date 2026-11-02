export type FinitePlaybackPlan = {
  token: string;
  playlistId: number;
  itemIds: string[];
  repeatCount: number;
};

/** A cycle is the complete ordered snapshot, never merely a wrap after skipped media. */
export class FinitePlaybackCounter {
  private index = 0;
  private cycles = 0;
  constructor(readonly plan: FinitePlaybackPlan) {}
  completed(itemId: string): 'continue' | 'complete' | 'invalid' {
    if (this.plan.itemIds[this.index] !== itemId) return 'invalid';
    this.index += 1;
    if (this.index < this.plan.itemIds.length) return 'continue';
    this.index = 0;
    this.cycles += 1;
    return this.cycles >= this.plan.repeatCount ? 'complete' : 'continue';
  }
}
