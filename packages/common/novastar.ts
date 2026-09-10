import type { ChipTypeEnum } from '@novastar/native/ChipType';
import type { TestModeEnum } from '@novastar/native/TestMode';
import type { BrightnessRGBV, DeviceInfo, LEDDisplayInfo } from '@novastar/screen';

export type ScreenId = {
  path: string;
  screen: number;
};

export const TAURUS_PATH_PREFIX = 'taurus:';
export const TAURUS_ALL_PATH = `${TAURUS_PATH_PREFIX}*`;
export const isTaurusPath = (path: string): boolean => path.startsWith(TAURUS_PATH_PREFIX);
export const getTaurusPath = (serialNumber: string): string =>
  `${TAURUS_PATH_PREFIX}${serialNumber}`;

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
  };
};
