import type { ChipTypeEnum } from '@novastar/native/ChipType';
import type { TestModeEnum } from '@novastar/native/TestMode';
import type { BrightnessRGBV, DeviceInfo, LEDDisplayInfo } from '@novastar/screen';

import type { TaurusFirmwareProgress } from './taurusConfiguration';

export type ScreenId = {
  path: string;
  screen: number;
};

export const TAURUS_PATH_PREFIX = 'taurus:';
export const TAURUS_ALL_PATH = `${TAURUS_PATH_PREFIX}*`;
export const TAURUS_MIN_SERIAL_SUFFIX_LENGTH = 4;
export const isTaurusPath = (path: string): boolean => path.startsWith(TAURUS_PATH_PREFIX);
export const getTaurusPath = (serialNumber: string): string =>
  `${TAURUS_PATH_PREFIX}${serialNumber}`;

export const matchesTaurusSerial = (path: string, serialNumber: string): boolean => {
  if (!isTaurusPath(path) || path === TAURUS_ALL_PATH) return false;
  const selector = path.slice(TAURUS_PATH_PREFIX.length).toLowerCase();
  const serial = serialNumber.toLowerCase();
  if (selector.length < TAURUS_MIN_SERIAL_SUFFIX_LENGTH || selector.length > serial.length) {
    return false;
  }
  return selector.length < serial.length ? serial.endsWith(selector) : serial === selector;
};

export const getMatchingTaurusSerials = (
  path: string,
  serialNumbers: Iterable<string>,
): string[] => {
  const serials = [...serialNumbers];
  const selector = path.slice(TAURUS_PATH_PREFIX.length).toLowerCase();
  const exact = serials.filter(serialNumber => serialNumber.toLowerCase() === selector);
  return exact.length > 0
    ? exact
    : serials.filter(serialNumber => matchesTaurusSerial(path, serialNumber));
};

export type Screen = {
  info: LEDDisplayInfo;
  mode?: TestModeEnum | null;
  rgbv?: BrightnessRGBV | null;
  gamma?: number | null;
  chipType?: ChipTypeEnum | null;
};

export type Novastar = {
  path: string;
  hasDVISignalIn?: boolean;
  info?: Readonly<DeviceInfo>;
  screens?: ReadonlyArray<Screen>;
  isBusy: boolean;
  connected: boolean;
  error?: string;
  isSerial?: boolean;
  taurus?: {
    address: string;
    port: number;
    aliasName: string;
    productName: string;
    serialNumber: string;
    platform: string;
    width: number;
    height: number;
    authenticated: boolean;
    passwordRequired: boolean;
    brightness?: number;
    illuminance?: number;
    firmwareProgress?: TaurusFirmwareProgress;
  };
};
