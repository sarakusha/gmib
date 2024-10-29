import type { ChipTypeEnum } from '@novastar/native/ChipType';
import type { TestModeEnum } from '@novastar/native/TestMode';
import type { BrightnessRGBV, DeviceInfo, LEDDisplayInfo } from '@novastar/screen';

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
  isSerial?: boolean;
};
