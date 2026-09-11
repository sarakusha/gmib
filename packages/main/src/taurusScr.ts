import path from 'node:path';

import type { LEDDisplayInfo, ScrConfig } from '@novastar/screen';
import { loadScreenConfig } from '@novastar/screen';
import type {
  TaurusClient,
  TaurusLedScreenConfiguration,
  TaurusReceivingCardRegion,
} from '@novastar/taurus';

import type { TaurusScreenSize, TaurusScrInspection } from '/@common/taurusConfiguration';

type ScrRegion = {
  SenderIndex?: number;
  PortIndex?: number;
  ConnectIndex?: number;
  X?: number;
  Y?: number;
  XInPort?: number;
  YInPort?: number;
  Width?: number;
  Height?: number;
  DVIIndex?: number;
};

type ScrScreen = LEDDisplayInfo & {
  X?: number;
  Y?: number;
  Type?: number;
  ScanBdCols?: number;
  ScanBdRows?: number;
  ScannerRegionList?: ScrRegion[];
  ScanBoardRegionInfoList?: ScrRegion[];
};

const requiredInteger = (value: unknown, name: string, positive = false): number => {
  if (!Number.isInteger(value) || (positive ? Number(value) <= 0 : Number(value) < 0)) {
    throw new TypeError(`Invalid SCR ${name}`);
  }
  return Number(value);
};

const uniqueSorted = (values: number[]): number[] => [...new Set(values)].sort((a, b) => a - b);

const calculateSize = (regions: TaurusReceivingCardRegion[]): TaurusScreenSize => ({
  width: Math.max(...regions.map(region => region.x + region.width)),
  height: Math.max(...regions.map(region => region.y + region.height)),
});

const getRegions = (screen: ScrScreen, index: number): ScrRegion[] => {
  const regions = screen.ScannerRegionList ?? screen.ScanBoardRegionInfoList;
  if (!regions?.length) {
    throw new TypeError(`SCR screen ${index + 1} does not contain explicit receiving-card regions`);
  }
  return regions;
};

export const convertScrToTaurusConfiguration = (
  configuration: ScrConfig,
): TaurusLedScreenConfiguration => ({
  screens: configuration.screens.map((value, screenIndex) => {
    const screen = value as ScrScreen;
    const rawRegions = getRegions(screen, screenIndex);
    const senders = uniqueSorted(
      rawRegions.map((region, index) =>
        requiredInteger(
          region.SenderIndex ?? 0,
          `screen ${screenIndex + 1} card ${index + 1} sender`,
        ),
      ),
    );
    if (senders.length !== 1 || senders[0] !== 0) {
      throw new RangeError('Taurus SCR import supports only sender index 0');
    }
    const xCoordinates = uniqueSorted(
      rawRegions.map((region, index) =>
        requiredInteger(region.X, `screen ${screenIndex + 1} card ${index + 1} X`),
      ),
    );
    const yCoordinates = uniqueSorted(
      rawRegions.map((region, index) =>
        requiredInteger(region.Y, `screen ${screenIndex + 1} card ${index + 1} Y`),
      ),
    );
    const receivingCards = rawRegions.map<TaurusReceivingCardRegion>((region, index) => {
      const x = requiredInteger(region.X, `screen ${screenIndex + 1} card ${index + 1} X`);
      const y = requiredInteger(region.Y, `screen ${screenIndex + 1} card ${index + 1} Y`);
      return {
        x,
        y,
        xInPort: requiredInteger(
          region.XInPort ?? 0,
          `screen ${screenIndex + 1} card ${index + 1} port X`,
        ),
        yInPort: requiredInteger(
          region.YInPort ?? 0,
          `screen ${screenIndex + 1} card ${index + 1} port Y`,
        ),
        width: requiredInteger(
          region.Width,
          `screen ${screenIndex + 1} card ${index + 1} width`,
          true,
        ),
        height: requiredInteger(
          region.Height,
          `screen ${screenIndex + 1} card ${index + 1} height`,
          true,
        ),
        port: requiredInteger(region.PortIndex, `screen ${screenIndex + 1} card ${index + 1} port`),
        connection: requiredInteger(
          region.ConnectIndex,
          `screen ${screenIndex + 1} card ${index + 1} connection`,
        ),
        column: xCoordinates.indexOf(x),
        row: yCoordinates.indexOf(y),
      };
    });
    const portOrder = [...new Set(receivingCards.map(region => region.port))];
    const sources = uniqueSorted(
      rawRegions.map(region => requiredInteger(region.DVIIndex ?? 1, 'DVI source')),
    );
    if (sources.length !== 1) {
      throw new RangeError(`SCR screen ${screenIndex + 1} uses multiple video sources`);
    }
    return {
      id: screenIndex,
      source: sources[0] ?? 1,
      type: requiredInteger(screen.Type ?? 1, `screen ${screenIndex + 1} type`),
      columns: requiredInteger(
        screen.ScanBdCols ?? xCoordinates.length,
        `screen ${screenIndex + 1} columns`,
        true,
      ),
      rows: requiredInteger(
        screen.ScanBdRows ?? yCoordinates.length,
        `screen ${screenIndex + 1} rows`,
        true,
      ),
      offset: {
        x: requiredInteger(screen.X ?? 0, `screen ${screenIndex + 1} offset X`),
        y: requiredInteger(screen.Y ?? 0, `screen ${screenIndex + 1} offset Y`),
      },
      portNumber: Math.max(...portOrder) + 1,
      portOrder,
      receivingCards,
      size: calculateSize(receivingCards),
    };
  }),
});

const normalizeConfiguration = (configuration: TaurusLedScreenConfiguration) => ({
  screens: [...configuration.screens]
    .sort((left, right) => left.id - right.id)
    .map(screen => ({
      ...screen,
      receivingCards: [...screen.receivingCards].sort(
        (left, right) =>
          left.port - right.port ||
          left.connection - right.connection ||
          left.y - right.y ||
          left.x - right.x,
      ),
    })),
});

const configurationsEqual = (
  left: TaurusLedScreenConfiguration,
  right: TaurusLedScreenConfiguration,
): boolean =>
  JSON.stringify(normalizeConfiguration(left)) === JSON.stringify(normalizeConfiguration(right));

const getTotalSize = (configuration: TaurusLedScreenConfiguration): TaurusScreenSize => ({
  width: Math.max(...configuration.screens.map(screen => screen.offset.x + screen.size.width)),
  height: Math.max(...configuration.screens.map(screen => screen.offset.y + screen.size.height)),
});

const filenameSize = (filename: string): TaurusScreenSize | undefined => {
  const match = /(?:^|[^\d])(\d{2,5})x(\d{2,5})(?:pix)?(?:[^\d]|$)/i.exec(filename);
  return match ? { width: Number(match[1]), height: Number(match[2]) } : undefined;
};

export const inspectTaurusScr = (
  filename: string,
  current: TaurusLedScreenConfiguration,
  backupAvailable: boolean,
): TaurusScrInspection => {
  if (path.extname(filename).toLowerCase() !== '.scr') {
    throw new TypeError('A NovaLCT .scr file is required');
  }
  const decoded = loadScreenConfig(filename);
  const target = convertScrToTaurusConfiguration(decoded);
  if (!target.screens.length) throw new TypeError('SCR does not contain any screens');
  const warnings: string[] = [];
  const expected = filenameSize(path.basename(filename));
  const targetSize = getTotalSize(target);
  if (expected && (expected.width !== targetSize.width || expected.height !== targetSize.height)) {
    warnings.push(
      `Имя файла указывает ${expected.width}x${expected.height}, но SCR содержит ${targetSize.width}x${targetSize.height}.`,
    );
  }
  const currentCards = current.screens.reduce(
    (count, screen) => count + screen.receivingCards.length,
    0,
  );
  const targetCards = target.screens.reduce(
    (count, screen) => count + screen.receivingCards.length,
    0,
  );
  if (currentCards !== targetCards) {
    warnings.push(`Количество карт изменится: ${currentCards} → ${targetCards}.`);
  }
  if (!configurationsEqual(current, target)) warnings.push('Текущая топология будет заменена.');
  return {
    filename,
    scrVersion: decoded.version,
    current,
    target,
    backupAvailable,
    warnings,
  };
};

export const verifyTaurusConfiguration = (
  expected: TaurusLedScreenConfiguration,
  actual: TaurusLedScreenConfiguration,
): void => {
  if (!configurationsEqual(expected, actual)) {
    throw new Error('Taurus returned a different screen topology after writing SCR');
  }
};

type TaurusConfigurationClient = Pick<
  TaurusClient,
  'getLedScreenConfiguration' | 'setLedScreenConfiguration'
>;

const isRequestTimeout = (error: unknown): error is Error =>
  error instanceof Error && /^Taurus request \d+ timed out$/.test(error.message);

const wait = (timeout: number): Promise<void> =>
  new Promise(resolve => {
    setTimeout(resolve, timeout);
  });

export const writeAndVerifyTaurusConfiguration = async (
  client: TaurusConfigurationClient,
  expected: TaurusLedScreenConfiguration,
  retryDelay = 500,
): Promise<TaurusLedScreenConfiguration> => {
  let writeTimeout: Error | undefined;
  try {
    await client.setLedScreenConfiguration(expected);
  } catch (error) {
    if (!isRequestTimeout(error)) throw error;
    writeTimeout = error;
  }

  let verificationError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0 && retryDelay > 0) await wait(retryDelay);
    try {
      const actual = await client.getLedScreenConfiguration();
      verifyTaurusConfiguration(expected, actual);
      return actual;
    } catch (error) {
      verificationError = error;
    }
  }

  if (writeTimeout) {
    const verificationMessage =
      verificationError instanceof Error ? verificationError.message : String(verificationError);
    throw new Error(
      `${writeTimeout.message}; configuration verification failed: ${verificationMessage}`,
      {
        cause: writeTimeout,
      },
    );
  }
  throw verificationError;
};
