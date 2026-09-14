import { screen } from 'electron';
import type { PluginManifest } from '/@common/plugins';
import type { PluginOutputApi, PluginOutputProfile } from '/@common/pluginOutput';
import { DefaultDisplays } from '/@common/video';
import { getScreen, getScreens, updateScreen } from './screen';
import { updateTest } from './screenOutput';

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
  const check = () => {
    if (!manifest.permissions?.includes('output.control'))
      throw new Error('Отсутствует разрешение output.control');
  };
  const stop = async () => {
    if (!profile) return;
    const scr = await getScreen(profile.screenId);
    if (scr?.test?.startsWith(`plugin:${manifest.id}:`)) {
      const next = { ...scr, test: undefined };
      await updateScreen(next);
      await updateTest(next);
    }
  };
  const start = async (value: PluginOutputProfile) => {
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
    if (profile && profile.screenId !== value.screenId) await stop();
    profile = { ...value };
    await storage.set('gmib.output', profile);
    const next = { ...scr, test: page(profile.pageId) };
    await updateScreen(next);
    await updateTest(next);
  };
  const restore = async () => {
    if (profile?.autoStart) await start(profile);
  };
  if (manifest.permissions?.includes('output.control')) {
    if (profile?.autoStart) await restore().catch(() => undefined);
    else await stop();
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
      const active = Boolean(present && scr?.test === page(profile.pageId));
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
