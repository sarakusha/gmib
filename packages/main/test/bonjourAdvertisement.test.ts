import { describe, expect, it, vi } from 'vitest';

import { type TxtAdvertisement, updateAdvertisementTxt } from '../src/bonjourAdvertisement';

const createAdvertisement = (active: boolean): TxtAdvertisement => ({
  activated: active,
  published: active,
  txt: { role: 'master' },
  start: vi.fn(),
  stop: vi.fn(callback => callback?.()),
});

describe('Bonjour advertisement TXT updates', () => {
  it('sets TXT before restarting an active advertisement', () => {
    const advertisement = createAdvertisement(true);
    const stop = vi.mocked(advertisement.stop);
    stop.mockImplementation(callback => {
      expect(advertisement.txt).toEqual({ role: 'candidate' });
      callback?.();
    });

    updateAdvertisementTxt(advertisement, { role: 'candidate' });

    expect(advertisement.stop).toHaveBeenCalledOnce();
    expect(advertisement.start).toHaveBeenCalledOnce();
  });

  it('updates an inactive advertisement without starting it', () => {
    const advertisement = createAdvertisement(false);

    updateAdvertisementTxt(advertisement, { role: 'candidate' });

    expect(advertisement.txt).toEqual({ role: 'candidate' });
    expect(advertisement.stop).not.toHaveBeenCalled();
    expect(advertisement.start).not.toHaveBeenCalled();
  });
});
