import { describe, expect, it } from 'vitest';

import {
  activationErrorMessage,
  hasControlCharacters,
  isActivationSubmitKey,
  normalizeActivationKey,
  normalizeDeviceName,
} from './activationForm';

describe('activation form helpers', () => {
  it('uppercases a key without changing its separators', () => {
    expect(normalizeActivationKey('ab12-cd34 ef56')).toBe('AB12-CD34 EF56');
  });

  it('turns a hostname into a useful device name', () => {
    expect(normalizeDeviceName(' gmib-kiosk.local ')).toBe('gmib-kiosk');
    expect(normalizeDeviceName('gmib-kiosk.local.')).toBe('gmib-kiosk');
    expect(normalizeDeviceName()).toBe('');
  });

  it('rejects control characters in a device name', () => {
    expect(hasControlCharacters('gmib-kiosk')).toBe(false);
    expect(hasControlCharacters('gmib\nkiosk')).toBe(true);
  });

  it('submits the focused activation button with Enter or Space', () => {
    expect(isActivationSubmitKey('Enter')).toBe(true);
    expect(isActivationSubmitKey(' ')).toBe(true);
    expect(isActivationSubmitKey('Tab')).toBe(false);
  });

  it.each([
    ['plain response', 'Лицензия занята', 'Лицензия занята'],
    ['RTK Query string response', { status: 409, data: 'Лицензия занята' }, 'Лицензия занята'],
    [
      'RTK Query object response',
      { status: 500, data: { message: 'Сервер недоступен' } },
      'Сервер недоступен',
    ],
    ['serialized error', { message: 'Network error' }, 'Network error'],
    ['fetch error', { status: 'FETCH_ERROR', error: 'Failed to fetch' }, 'Failed to fetch'],
  ])('formats %s', (_description, error, expected) => {
    expect(activationErrorMessage(error)).toBe(expected);
  });
});
