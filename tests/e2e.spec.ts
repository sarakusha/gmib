import type { ElectronApplication, Page } from 'playwright';
import { _electron as electron } from 'playwright';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
// import '../packages/preload/exposedInMainWorld';

let electronApp: ElectronApplication;
let mainPage: Page;
let userDataDirectory: string;

beforeAll(async () => {
  userDataDirectory = await mkdtemp(path.join(tmpdir(), 'gmib-e2e-'));
  electronApp = await electron.launch({
    args: ['.', `--user-data-dir=${userDataDirectory}`],
  });
  for (let attempt = 0; attempt < 100 && !mainPage; attempt += 1) {
    for (const page of electronApp.windows()) {
      if (await page.$('#app')) {
        mainPage = page;
        break;
      }
    }
    if (!mainPage) await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!mainPage) throw new Error('GMIB content window was not created');
}, 60_000);

afterAll(async () => {
  await electronApp.close();
  await rm(userDataDirectory, { recursive: true, force: true });
});

test('Main window state', async () => {
  const windowState: { isVisible: boolean; isDevToolsOpened: boolean; isCrashed: boolean } =
    await electronApp.evaluate(({ BrowserWindow }) => {
      const mainWindow = BrowserWindow.getAllWindows()[0];

      const getState = () => ({
        isVisible: mainWindow.isVisible(),
        isDevToolsOpened: mainWindow.webContents.isDevToolsOpened(),
        isCrashed: mainWindow.webContents.isCrashed(),
      });

      return new Promise(resolve => {
        if (mainWindow.isVisible()) {
          resolve(getState());
        } else mainWindow.once('ready-to-show', () => setTimeout(() => resolve(getState()), 0));
      });
    });

  expect(windowState.isCrashed, 'App was crashed').toBeFalsy();
  expect(windowState.isVisible, 'Main window was not visible').toBeTruthy();
  expect(windowState.isDevToolsOpened, 'DevTools was opened').toBeFalsy();
});

test('Main window web content', async () => {
  const element = await mainPage.$('#app', { strict: true });
  expect(element, "Can't find root element").not.toBeNull();
  expect((await element.innerHTML()).trim(), 'Window content was empty').not.equal('');
});

test('Preload versions', async () => {
  const exposedVersions = await mainPage.evaluate(() => globalThis.versions);
  const expectedVersions = await electronApp.evaluate(() => process.versions);
  expect(exposedVersions).toBeDefined();
  expect(exposedVersions).to.deep.equal(expectedVersions);
});

test('Inactive runtime recovery', async () => {
  const licenseState = await mainPage.evaluate(() => globalThis.getLicenseState());
  expect(licenseState?.status).toBe('unlicensed');
  await expect(mainPage.getByRole('heading', { name: 'Активация' }).isVisible()).resolves.toBe(
    true,
  );
});
