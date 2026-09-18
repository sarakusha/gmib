import type { PlaybackEvent, PlaybackIssue, PlaybackStatusSnapshot } from '/@common/playback';

export class PlaybackStatusStore {
  private readonly issues = new Map<string, PlaybackIssue>();

  snapshot(): PlaybackStatusSnapshot {
    return {
      issues: [...this.issues.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    };
  }

  apply(event: PlaybackEvent): boolean {
    const key = `${event.playerId}:${event.mediaId}`;
    if (event.event === 'error' || event.event === 'quarantined') {
      this.issues.set(key, event as PlaybackIssue);
      return true;
    }
    if (event.event === 'completed' || event.event === 'recovered') {
      return this.issues.delete(key);
    }
    return false;
  }

  clearPlayer(playerId: number): boolean {
    return this.deleteWhere(issue => issue.playerId === playerId);
  }

  clearMedia(mediaId: string): boolean {
    return this.deleteWhere(issue => issue.mediaId === mediaId);
  }

  private deleteWhere(predicate: (issue: PlaybackIssue) => boolean): boolean {
    let changed = false;
    this.issues.forEach((issue, key) => {
      if (predicate(issue)) changed = this.issues.delete(key) || changed;
    });
    return changed;
  }
}
