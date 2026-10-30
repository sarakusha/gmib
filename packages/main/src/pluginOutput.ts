import { screen } from 'electron';
import type { PluginManifest } from '/@common/plugins';
import type { PluginOutputApi, PluginOutputProfile } from '/@common/pluginOutput';
import { DefaultDisplays } from '/@common/video';
import { getScreen, getScreens, updateScreen } from './screen';
import { updateTest } from './screenOutput';
import { listPluginPlayers, setPluginPlayerState } from './pluginPlayerOutput';
import { clearScreenOutputVisibility, setScreenOutputHidden } from './outputVisibility';
import { findScreenWindow } from './windowStore';

export async function createPluginOutput(
  manifest: PluginManifest,
  storage: {
    get: <T>(key: string) => Promise<T | undefined>;
    set: (key: string, value: unknown) => Promise<void>;
  },
  onDispose: (handler: () => void | Promise<void>) => void,
): Promise<PluginOutputApi> {
  let profile = await storage.get<PluginOutputProfile>('gmib.output');
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(work: () => Promise<T>) => {
    const next = queue.then(work);
    queue = next.catch(() => undefined);
    return next;
  };
  const page = (id: string) => `plugin:${manifest.id}:${id}`;
  const check = (permission: 'output.control' | 'player.control' = 'output.control') => {
    if (!manifest.permissions?.includes(permission))
      throw new Error(`Отсутствует разрешение ${permission}`);
  };
  const stop = async (exceptScreenId?: number) => {
    const screens = await getScreens();
    for (const scr of screens) {
      if (scr.id !== exceptScreenId && scr.test?.startsWith(`plugin:${manifest.id}:`)) {
        const next = { ...scr, test: undefined };
        await updateScreen(next);
        clearScreenOutputVisibility(scr.id);
        await updateTest(next);
      }
    }
  };
  const start = async (value: PluginOutputProfile, explicit = true) => {
    if (
      !Number.isSafeInteger(value.screenId) ||
      typeof value.autoStart !== 'boolean' ||
      !manifest.pages?.some(item => item.id === value.pageId)
    )
      throw new Error('Некорректный профиль вывода');
    const scr = await getScreen(value.screenId);
    if (!scr?.width || !scr.height || !scr.display)
      throw new Error('Сначала настройте размер и дисплей в gmib → Вывод');
    if (scr.test?.startsWith('plugin:') && !scr.test.startsWith(`plugin:${manifest.id}:`))
      throw new Error('Экран занят другим плагином');
    await stop(value.screenId);
    profile = { ...value };
    await storage.set('gmib.output', profile);
    const next = { ...scr, test: page(profile.pageId) };
    await updateScreen(next);
    if (explicit) setScreenOutputHidden(value.screenId, false);
    await updateTest(next);
  };
  const restore = async () => {
    if (!manifest.permissions?.includes('output.control')) return;
    if (profile?.autoStart) await start(profile, false);
  };
  if (manifest.permissions?.includes('output.control')) {
    if (profile?.autoStart) await restore().catch(() => undefined);
    else if (profile) await stop();
  }
  const added = () => {
    void serial(restore).catch(() => undefined);
  };
  screen.on('display-added', added);
  onDispose(async () => {
    screen.off('display-added', added);
    await queue;
  });
  return {
    listPlayers: async () => {
      check('player.control');
      return listPluginPlayers();
    },
    setPlayerState: state => {
      check('player.control');
      return serial(() => setPluginPlayerState(state));
    },
    listScreens: async () => {
      check();
      return (await getScreens()).map(({ id, name, width, height }) => ({
        id,
        name,
        width,
        height,
      }));
    },
    getStatus: async () => {
      check();
      if (!profile) return { active: false, message: 'Экран ещё не выбран' };
      const scr = await getScreen(profile.screenId);
      const displays = screen.getAllDisplays();
      const displayId = scr?.display;
      const present =
        displayId === DefaultDisplays.Primary ||
        (displayId === DefaultDisplays.Secondary
          ? displays.length > 1
          : displays.some(display => display.id === displayId));
      const output = findScreenWindow(profile.screenId);
      const active = Boolean(
        present &&
        scr?.test === page(profile.pageId) &&
        output &&
        !output.isDestroyed() &&
        output.isVisible(),
      );
      return {
        profile: { ...profile },
        active,
        message: !scr
          ? 'Экран удалён из gmib'
          : !present
            ? 'Дисплей не подключён'
            : active
              ? 'Вывод включён'
              : 'Вывод выключен',
      };
    },
    start: value => {
      check();
      return serial(() => start(value));
    },
    stop: () => {
      check();
      return serial(async () => {
        await stop();
        if (profile) {
          profile = { ...profile, autoStart: false };
          await storage.set('gmib.output', profile);
        }
      });
    },
  };
}
