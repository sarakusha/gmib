import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ExternalBroadcastDetection from '../src/externalBroadcastDetection';

describe('ExternalBroadcastDetection', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reports an unknown address only once while repeated broadcasts continue', async () => {
    const onDetected = vi.fn();
    const detection = new ExternalBroadcastDetection({
      delay: 10_000,
      isKnownAddress: () => false,
      onDetected,
    });

    detection.observe('192.168.0.48');
    detection.observe('192.168.0.48');
    await vi.advanceTimersByTimeAsync(10_000);
    detection.observe('192.168.0.48');
    await vi.advanceTimersByTimeAsync(30_000);

    expect(onDetected).toHaveBeenCalledOnce();
    expect(onDetected).toHaveBeenCalledWith('192.168.0.48');
  });

  it('allows a new report after the address became known and disappeared again', async () => {
    let known = false;
    const onDetected = vi.fn();
    const detection = new ExternalBroadcastDetection({
      delay: 10_000,
      isKnownAddress: () => known,
      onDetected,
    });

    detection.observe('192.168.0.48');
    await vi.advanceTimersByTimeAsync(10_000);
    known = true;
    detection.markKnown('192.168.0.48');
    known = false;
    detection.observe('192.168.0.48');
    await vi.advanceTimersByTimeAsync(10_000);

    expect(onDetected).toHaveBeenCalledTimes(2);
  });

  it('cancels pending reports when the detector is restarted', () => {
    const onDetected = vi.fn();
    const detection = new ExternalBroadcastDetection({
      delay: 10_000,
      isKnownAddress: () => false,
      onDetected,
    });

    detection.observe('192.168.0.48');
    detection.clearPending();
    vi.advanceTimersByTime(10_000);

    expect(onDetected).not.toHaveBeenCalled();
  });

  it('suppresses a confirmed GMIB address when mDNS registration is delayed', async () => {
    const onDetected = vi.fn();
    const confirmExternalAddress = vi.fn().mockResolvedValue(false);
    const detection = new ExternalBroadcastDetection({
      delay: 10_000,
      isKnownAddress: () => false,
      confirmExternalAddress,
      onDetected,
    });

    detection.observe('192.168.0.48');
    await vi.advanceTimersByTimeAsync(10_000);
    detection.observe('192.168.0.48');
    await vi.advanceTimersByTimeAsync(30_000);

    expect(confirmExternalAddress).toHaveBeenCalledOnce();
    expect(onDetected).not.toHaveBeenCalled();
  });
});
