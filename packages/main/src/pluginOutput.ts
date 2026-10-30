import { type BrowserWindow, screen } from 'electron';
import type { PluginManifest } from '/@common/plugins';
import type { PluginOutputApi, PluginOutputProfile } from '/@common/pluginOutput';
import { DefaultDisplays, type Player, type Screen } from '/@common/video';
import { getPlayer, getScreen, getScreens, updateScreen } from './screen';
import { getScreenOutputError, updateTest } from './screenOutput';
import { listPluginPlayers, setPluginPlayerState } from './pluginPlayerOutput';
import {
  clearPlayerOutputReveal,
  clearScreenOutputVisibility,
  getOutputVisibilityRevision,
  isPlayerOutputHidden,
  isScreenOutputHidden,
  revealPlayerOutput,
  setScreenOutputHidden,
} from './outputVisibility';
import {
  holdOutputWindows,
  reconcilePlayerOutputWindows,
  setPlayerOutputWindowsVisibility,
} from './openHandler';
import { waitForPluginOutputFrame, waitForPluginPlayerReady } from './pluginOutputTransition';
import { updatePlayerRuntime } from './playerRuntime';
import { findPlayerWindow, findScreenWindow } from './windowStore';

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
  const displayPresent = (displayId: number | undefined): boolean => {
    const displays = screen.getAllDisplays();
    return displayId === DefaultDisplays.Primary
      ? displays.length > 0
      : displayId === DefaultDisplays.Secondary
        ? displays.length > 1
        : displays.some(display => display.id === displayId);
  };
  const changeLayout = async (
    value: PluginOutputProfile,
    playerChanges: Array<{ playerId: number; playing: boolean }> = [],
    explicit = true,
  ): Promise<void> => {
    const visibilityRevision = getOutputVisibilityRevision();
    const visibilityUnchanged = () => getOutputVisibilityRevision() === visibilityRevision;
    const checkVisibility = () => {
      if (!visibilityUnchanged())
        throw new Error('Видимость изменена общей командой GMIB. Переключение отменено.');
    };
    if (
      !value ||
      !Number.isSafeInteger(value.screenId) ||
      typeof value.autoStart !== 'boolean' ||
      !manifest.pages?.some(item => item.id === value.pageId)
    )
      throw new Error('Некорректный профиль вывода');
    const nextProfile = { ...value };
    if (!Array.isArray(playerChanges)) throw new Error('Некорректный список плееров');
    const changes = playerChanges.map(change => {
      if (!change || !Number.isSafeInteger(change.playerId) || typeof change.playing !== 'boolean')
        throw new Error('Некорректное состояние плеера');
      return { ...change };
    });
    if (new Set(changes.map(change => change.playerId)).size !== changes.length)
      throw new Error('Плеер указан несколько раз');
    const savedPlayers = new Map<number, { player: Player; hidden: boolean }>();
    for (const change of changes) {
      const player = await getPlayer(change.playerId);
      if (!player) {
        if (change.playing) throw new Error(`Плеер ${change.playerId} не найден`);
        continue;
      }
      if (change.playing && !player.playlistId)
        throw new Error(`У плеера ${change.playerId} не выбран плейлист`);
      savedPlayers.set(player.id, { player, hidden: isPlayerOutputHidden(player.id) });
    }
    const target = await getScreen(nextProfile.screenId);
    if (!target?.width || !target.height || !target.display)
      throw new Error('Сначала настройте размер и дисплей в gmib → Вывод');
    if (target.test?.startsWith('plugin:') && !target.test.startsWith(`plugin:${manifest.id}:`))
      throw new Error('Экран занят другим плагином');
    const owned = (await getScreens()).filter(scr =>
      scr.test?.startsWith(`plugin:${manifest.id}:`),
    );
    const previousVisibleIds = new Set(
      owned
        .filter(scr => {
          const window = findScreenWindow(scr.id);
          return window && !window.isDestroyed() && window.isVisible();
        })
        .map(scr => scr.id),
    );
    const previousWindows = owned
      .map(scr => findScreenWindow(scr.id))
      .filter((window): window is BrowserWindow =>
        Boolean(window && !window.isDestroyed() && window.isVisible()),
      );
    if (!displayPresent(target.display) && (explicit || previousWindows.length > 0))
      throw new Error('Дисплей не подключён. Прежний вывод сохранён.');
    const previousProfile = profile && { ...profile };
    const previousHidden = new Map(
      [...owned, target].map(scr => [scr.id, isScreenOutputHidden(scr.id)]),
    );
    checkVisibility();
    const release = holdOutputWindows(previousWindows);
    const cleared: Screen[] = [];
    const touchedPlayers: number[] = [];
    let targetTouched = false;
    let savingProfile = false;
    try {
      targetTouched = true;
      const next = { ...target, test: page(nextProfile.pageId) };
      await updateScreen(next);
      checkVisibility();
      if (explicit) setScreenOutputHidden(target.id, false);
      await updateTest(next);
      checkVisibility();
      const loadError = getScreenOutputError(target.id);
      if (loadError) throw new Error(loadError);
      if (explicit || previousWindows.length > 0) {
        const output = findScreenWindow(target.id);
        if (!output || output.isDestroyed() || !output.isVisible())
          throw new Error('Новый вывод не появился. Прежний вывод сохранён.');
      }
      // Keep the previous picture in front until all starting players have fresh
      // frame evidence; stop requests run only once replacements are ready.
      for (const change of changes.filter(item => item.playing)) {
        checkVisibility();
        touchedPlayers.push(change.playerId);
        await setPluginPlayerState(change);
        checkVisibility();
        await waitForPluginPlayerReady(change.playerId);
        checkVisibility();
      }
      const preparedOutput = findScreenWindow(target.id);
      if (preparedOutput && !preparedOutput.isDestroyed() && preparedOutput.isVisible()) {
        await waitForPluginOutputFrame(preparedOutput);
      }
      checkVisibility();
      for (const change of changes.filter(item => !item.playing)) {
        checkVisibility();
        touchedPlayers.push(change.playerId);
        await setPluginPlayerState(change);
      }
      checkVisibility();
      for (const old of owned.filter(scr => scr.id !== target.id)) {
        checkVisibility();
        cleared.push(old);
        const next = { ...old, test: undefined };
        await updateScreen(next);
        clearScreenOutputVisibility(old.id);
        await updateTest(next);
      }
      checkVisibility();
      savingProfile = true;
      await storage.set('gmib.output', nextProfile);
      checkVisibility();
      profile = nextProfile;
    } catch (error) {
      const failures: unknown[] = [];
      const restore = async (work: () => Promise<void>) => {
        try {
          await work();
          return true;
        } catch (failure) {
          failures.push(failure);
          return false;
        }
      };
      // Restore old pictures before removing the prepared target. Continue each
      // independent rollback even if another one fails, and report every failure.
      let previousPictureRestored = true;
      for (const old of cleared) {
        const restored = await restore(async () => {
          await updateScreen(old);
          if (visibilityUnchanged())
            setScreenOutputHidden(old.id, previousHidden.get(old.id) ?? false);
          else clearScreenOutputVisibility(old.id);
          await updateTest(old);
          const loadError = getScreenOutputError(old.id);
          if (loadError) throw new Error(`Не удалось восстановить экран ${old.id}: ${loadError}`);
          if (previousVisibleIds.has(old.id) && !isScreenOutputHidden(old.id)) {
            const output = findScreenWindow(old.id);
            if (!output || output.isDestroyed() || !output.isVisible())
              throw new Error(`Не удалось восстановить изображение экрана ${old.id}`);
          }
        });
        previousPictureRestored = restored && previousPictureRestored;
      }
      // If the old page itself failed to return, retain the successfully prepared
      // replacement instead of taking away the last available picture as well.
      if (targetTouched && previousPictureRestored)
        await restore(async () => {
          await updateScreen(target);
          if (visibilityUnchanged())
            setScreenOutputHidden(target.id, previousHidden.get(target.id) ?? false);
          else clearScreenOutputVisibility(target.id);
          await updateTest(target);
          const loadError = target.test ? getScreenOutputError(target.id) : undefined;
          if (loadError)
            throw new Error(`Не удалось восстановить экран ${target.id}: ${loadError}`);
          if (previousVisibleIds.has(target.id) && !isScreenOutputHidden(target.id)) {
            const output = findScreenWindow(target.id);
            if (!output || output.isDestroyed() || !output.isVisible())
              throw new Error(`Не удалось восстановить изображение экрана ${target.id}`);
          }
        });
      for (const id of touchedPlayers.reverse())
        await restore(async () => {
          const saved = savedPlayers.get(id);
          if (!saved) return;
          await updatePlayerRuntime(saved.player);
          if (!saved.player.autoPlay) findPlayerWindow(id)?.webContents.send('stop', id);
          if (visibilityUnchanged()) {
            if (!saved.hidden) revealPlayerOutput(id);
            setPlayerOutputWindowsVisibility(!saved.hidden, id);
          } else {
            clearPlayerOutputReveal(id);
            reconcilePlayerOutputWindows(id);
            findPlayerWindow(id)?.webContents.send('outputVisibility', isPlayerOutputHidden(id));
          }
        });
      if (savingProfile)
        await restore(async () => {
          await storage.set('gmib.output', previousProfile);
        });
      profile = previousProfile;
      if (failures.length)
        throw new AggregateError(
          [error, ...failures],
          `Не удалось изменить и полностью восстановить вывод: ${[error, ...failures].map(failure => (failure instanceof Error ? failure.message : String(failure))).join('; ')}`,
        );
      throw error;
    } finally {
      release();
    }
  };
  const start = (value: PluginOutputProfile, explicit = true) => changeLayout(value, [], explicit);
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
    applyLayout: layout => {
      check();
      // Snapshot before queueing: callers can otherwise append player operations
      // after a permission check while a prior operation is still running.
      const nextProfile = { ...layout?.profile };
      const players = Array.isArray(layout?.players)
        ? layout.players.map(change => ({ ...change }))
        : layout?.players;
      if (players?.length) check('player.control');
      return serial(() => changeLayout(nextProfile, players));
    },
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
      const loadError =
        scr?.test === page(profile.pageId) ? getScreenOutputError(profile.screenId) : undefined;
      const output = findScreenWindow(profile.screenId);
      const active = Boolean(
        present &&
        !loadError &&
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
            : (loadError ?? (active ? 'Вывод включён' : 'Вывод выключен')),
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
