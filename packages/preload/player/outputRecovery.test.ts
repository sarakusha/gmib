import { describe, expect, it } from 'vitest';
import OutputRecovery from './outputRecovery';

describe('output recovery ladder', () => {
  it('retains escalation across isolated successful frames and replacement load', () => {
    const ladder = new OutputRecovery();
    ladder.observe(true, undefined, 0);
    expect(ladder.observe(true, undefined, 30_000)).toBe('reattach');
    expect(ladder.observe(true, 35_000, 35_000)).toBe('waiting');
    expect(ladder.observe(true, 35_000, 65_000)).toBe('recreate');
    expect(ladder.observe(true, undefined, 95_000)).toBe('exhausted');
  });
  it('resets escalation only after thirty seconds of sustained progress', () => {
    const ladder = new OutputRecovery();
    ladder.observe(true, undefined, 0);
    ladder.observe(true, undefined, 30_000);
    for (let now = 35_000; now <= 65_000; now += 5_000) ladder.observe(true, now, now);
    expect(ladder.observe(true, 65_000, 95_000)).toBe('reattach');
  });
  it('gives a resumed output a fresh grace period without erasing its recovery stage', () => {
    const ladder = new OutputRecovery();
    ladder.observe(true, undefined, 0);
    ladder.observe(true, undefined, 30_000);
    ladder.observe(false, undefined, 35_000);
    expect(ladder.observe(true, undefined, 150_000)).toBe('waiting');
    expect(ladder.observe(true, undefined, 180_000)).toBe('recreate');
  });
});
