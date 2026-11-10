import { beforeEach, expect, it, vi } from 'vitest';
import type { BaseWindow } from 'electron';
const mocks = vi.hoisted(() => ({ request: vi.fn(), dialog: vi.fn(), error: vi.fn() }));
vi.mock('../src/authRequest', () => ({ default: mocks.request }));
vi.mock('../src/updateDialog', () => ({ showUpdateDialog: mocks.dialog }));
vi.mock('../src/initlog', () => ({ default: { error: mocks.error } }));
import { checkHostUpdates } from '../src/checkHostUpdates';
const parent = {} as BaseWindow;
beforeEach(() => {
  vi.resetAllMocks();
  mocks.dialog.mockResolvedValue({ response: 0 });
});
it('keeps the confirmation pending without starting an update and attaches it to its window', async () => {
  mocks.request
    .mockResolvedValueOnce(Response.json({ version: '5.7.8' }))
    .mockResolvedValueOnce(new Response());
  let answer!: (value: { response: number }) => void;
  mocks.dialog.mockReturnValueOnce(
    new Promise(resolve => {
      answer = resolve;
    }),
  );
  const pending = checkHostUpdates('localhost', 9002, parent);
  await vi.waitFor(() => expect(mocks.dialog).toHaveBeenCalled());
  expect(mocks.dialog).toHaveBeenCalledWith(expect.objectContaining({ cancelId: 1 }), parent);
  expect(mocks.request).toHaveBeenCalledOnce();
  answer({ response: 0 });
  await pending;
  expect(mocks.request).toHaveBeenLastCalledWith({
    api: '/update',
    method: 'POST',
    host: 'localhost',
    port: 9002,
  });
  expect(mocks.dialog).toHaveBeenCalledOnce();
});
it.each([1, -1])('does not update on cancel/no available owner (%s)', async response => {
  mocks.request.mockResolvedValue(Response.json({ version: '5.7.8' }));
  mocks.dialog.mockResolvedValue({ response });
  await checkHostUpdates('localhost', 9002, parent);
  expect(mocks.request).toHaveBeenCalledOnce();
});
it('reports HTTP errors through the same attached asynchronous dialog', async () => {
  mocks.request.mockResolvedValue(new Response('Download failed', { status: 500 }));
  await checkHostUpdates('remote.example', 9002, parent);
  expect(mocks.dialog).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'error', message: 'Download failed' }),
    parent,
  );
});
it('attaches the no-update and remote-restart notifications', async () => {
  mocks.request.mockResolvedValueOnce(Response.json(''));
  await checkHostUpdates('remote.example', 9002, parent);
  expect(mocks.dialog).toHaveBeenLastCalledWith(
    expect.objectContaining({ title: 'Обновления не найдены' }),
    parent,
  );
  mocks.request
    .mockResolvedValueOnce(Response.json({ version: '5.7.8' }))
    .mockResolvedValueOnce(new Response());
  await checkHostUpdates('remote.example', 9002, parent);
  expect(mocks.dialog).toHaveBeenLastCalledWith(
    expect.objectContaining({ title: 'Обновление загружено' }),
    parent,
  );
});
