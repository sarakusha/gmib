type ExternalBroadcastDetectionOptions = {
  readonly delay: number;
  readonly isKnownAddress: (address: string) => boolean;
  readonly confirmExternalAddress?: (address: string) => Promise<boolean>;
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

    const timeout = setTimeout(() => void this.confirm(address, timeout), this.options.delay);
    timeout.unref();
    this.pending.set(address, timeout);
  }

  private async confirm(address: string, timeout: NodeJS.Timeout): Promise<void> {
    if (this.pending.get(address) !== timeout) return;
    if (this.options.isKnownAddress(address)) {
      this.pending.delete(address);
      return;
    }

    const isExternal = (await this.options.confirmExternalAddress?.(address)) ?? true;
    if (this.pending.get(address) !== timeout) return;
    this.pending.delete(address);
    if (this.options.isKnownAddress(address)) return;

    this.detected.add(address);
    if (isExternal) this.options.onDetected(address);
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
