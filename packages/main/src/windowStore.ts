import type { Host } from '@nibus/core/ipc';
import type { Screen } from '/@common/video';

export type WindowType = 'gmib' | 'player' | 'screen' | 'video';

export const licenseNames = [
  'basic',
  'standard',
  'plus',
  'premium',
  'enterprise',
] as const;

export type LicenseName = typeof licenseNames[number];

const impScreenProps = [
  'test',
  'borderTop',
  'borderBottom',
  'borderLeft',
  'borderRight',
  'width',
  'height',
  'moduleWidth',
  'moduleHeight',
] as const;

export type WindowParams =
  | GmibWindowParams
  | PlayerWindowParams
  | ScreenWindowParams
  | VideoWindowParams;

export type CommonWindowParams = {
  type: WindowType;
  id: number;
};

export type GmibWindowParams = CommonWindowParams & {
  host: string;
  port: number;
  license?: {
    key: string;
    name: LicenseName; 
  };
  info?: Partial<Host>;
};

export type PlayerWindowParams = CommonWindowParams;

export type ScreenWindowParams = CommonWindowParams & Pick<Screen, (typeof impScreenProps)[number]>;

export type VideoWindowParams = CommonWindowParams;

const store = new Map<number, WindowParams>();

export const isGmib = (params: WindowParams): params is GmibWindowParams => params.type === 'gmib';
export const isScreen = (params: WindowParams): params is ScreenWindowParams => params.type === 'screen';
export const isPlayer = (params: WindowParams): params is PlayerWindowParams => params.type === 'player';
export const isVideo = (params: WindowParams): params is VideoWindowParams => params.type === 'video';

export default store as ReadonlyMap<number, WindowParams>;
