type ExternalBroadcastDetectionOptions = {
  readonly delay: number;
  readonly isKnownAddress: (address: string) => boolean;
  readonly onDetected: (address: string) => void;
};

export default class ExternalBroadcastDetection {
  private readonly detected = new Set<string>();

  private readonly pending = new Map<string, NodeJS.Timeout>();

  constructor(private readonly options: ExternalBroadcastDetectionOptions) {}

  observe(address: string): void {
    if (this.options.isKnownAddress(address)) {
      this.markKnown(address);
      return;
    }
    if (this.detected.has(address) || this.pending.has(address)) return;

    const timeout = setTimeout(() => {
      this.pending.delete(address);
      if (this.options.isKnownAddress(address)) return;
      this.detected.add(address);
      this.options.onDetected(address);
    }, this.options.delay);
    timeout.unref();
    this.pending.set(address, timeout);
  }

  markKnown(address: string): void {
    const timeout = this.pending.get(address);
    if (timeout) clearTimeout(timeout);
    this.pending.delete(address);
    this.detected.delete(address);
  }

  clearPending(): void {
    this.pending.forEach(timeout => clearTimeout(timeout));
    this.pending.clear();
  }

  reset(): void {
    this.clearPending();
    this.detected.clear();
  }
}
