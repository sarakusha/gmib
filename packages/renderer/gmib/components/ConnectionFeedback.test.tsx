import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ConnectionFeedback, { CONNECTION_LOSS_GRACE_MS } from './ConnectionFeedback';
import type { SessionStatus } from '../store/sessionSlice';

vi.mock('@mui/material', async importOriginal => {
  const original = await importOriginal<typeof MuiMaterial>();
  return {
    ...original,
    Backdrop: ({ open, children }: { open: boolean; children: React.ReactNode }) => (
      <div data-blocking={open}>{open && children}</div>
    ),
  };
});

describe('connection feedback', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const render = (online: boolean, loading = false, status: SessionStatus = 'succeeded'): void => {
    act(() =>
      root.render(<ConnectionFeedback online={online} loading={loading} status={status} />),
    );
  };
  const blocking = () => container.querySelector('[data-blocking]')?.getAttribute('data-blocking');

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it.each(['idle', 'pending', 'succeeded'] as const)(
    'always shows connecting feedback while offline with status %s',
    status => {
      render(false, false, status);
      expect(blocking()).toBe('true');
      expect(container.textContent).toContain('Подключаемся');
    },
  );

  it('explains an initial connection failure instead of displaying an empty overlay', () => {
    act(() =>
      root.render(
        <ConnectionFeedback online={false} loading status="failed" error="ECONNREFUSED" />,
      ),
    );
    expect(blocking()).toBe('true');
    expect(container.textContent).toContain('Не удалось подключиться');
    expect(container.textContent).toContain('ECONNREFUSED');
  });

  it('distinguishes settings loading after the transport connects', () => {
    render(true, true);
    expect(blocking()).toBe('true');
    expect(container.textContent).toContain('Загружаем настройки');
  });

  it('keeps brief heartbeat losses nonblocking and cancels the pending dimming', () => {
    render(true);
    render(false);
    expect(blocking()).toBe('false');
    expect(container.textContent).toContain('Связь нестабильна');
    act(() => {
      vi.advanceTimersByTime(CONNECTION_LOSS_GRACE_MS - 1);
    });
    expect(blocking()).toBe('false');
    render(true);
    act(() => {
      vi.advanceTimersByTime(CONNECTION_LOSS_GRACE_MS);
    });
    expect(blocking()).toBe('false');
    expect(container.textContent).not.toContain('Связь нестабильна');
  });

  it('blocks a sustained loss after the grace period and restores the interface on recovery', () => {
    render(true);
    render(false);
    act(() => {
      vi.advanceTimersByTime(CONNECTION_LOSS_GRACE_MS);
    });
    expect(blocking()).toBe('true');
    expect(container.textContent).toContain('Связь прервалась');
    render(true);
    expect(blocking()).toBe('false');
  });

  it('starts a fresh grace period for a new loss rather than retaining the previous timeout', () => {
    render(true);
    render(false);
    act(() => {
      vi.advanceTimersByTime(CONNECTION_LOSS_GRACE_MS);
    });
    render(true);
    render(false);
    expect(blocking()).toBe('false');
    act(() => {
      vi.advanceTimersByTime(CONNECTION_LOSS_GRACE_MS - 1);
    });
    expect(blocking()).toBe('false');
  });

  it('blocks a closed socket immediately, even after a successful connection', () => {
    render(true);
    render(false, false, 'closed');
    expect(blocking()).toBe('true');
    expect(container.textContent).toContain('Соединение закрыто');
  });
});
import type * as MuiMaterial from '@mui/material';
