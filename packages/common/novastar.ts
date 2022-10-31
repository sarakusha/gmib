import type { ChipTypeEnum } from '@novastar/native/ChipType';
import type { TestModeEnum } from '@novastar/native/TestMode';
import type { DeviceInfo } from '@novastar/screen/DeviceInfo';
import type { BrightnessRGBV } from '@novastar/screen/ScreenConfigurator';
import type { LEDDisplayInfo } from '@novastar/screen/common';

export type ScreenId = {
  path: string;
  screen: number;
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
};
