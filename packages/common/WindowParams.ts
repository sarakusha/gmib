import type { Host } from '@nibus/core/ipc';

import type { Screen } from './video';

export const impScreenProps = [
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


export type WindowType = 'gmib' | 'player' | 'screen' | 'video';

export type ScreenOptions = Readonly<Pick<Screen, (typeof impScreenProps)[number]>>;

export const gmibVariables = ['autostart'] satisfies Array<keyof GmibWindowParams>;
type GmibVariables = (typeof gmibVariables)[number];

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
  type: 'gmib';
  host: string;
  nibusPort: number;
  plan?: string;
  renew?: string;
  key?: string;
  useProxy?: boolean;
  info?: Partial<Host>;
  machineId?: string;
  autostart?: boolean;
  update: (update: Partial<Pick<GmibWindowParams, GmibVariables>>) => GmibWindowParams;
  // localConfig: LocalConfig;
  // esLocalConfig: EventSource;
};

export type PlayerWindowParams = CommonWindowParams & {
  type: 'player';
  playerId: number;
  host: string;
  port: number;
};

export type ScreenWindowParams = CommonWindowParams &
  ScreenOptions & { type: 'screen'; screenId: number };

export type VideoWindowParams = CommonWindowParams & { type: 'video' };

export const isGmib = (params?: WindowParams): params is GmibWindowParams =>
  params?.type === 'gmib';
export const isScreen = (params?: WindowParams): params is ScreenWindowParams =>
  params?.type === 'screen';
export const isPlayer = (params?: WindowParams): params is PlayerWindowParams =>
  params?.type === 'player';
export const isVideo = (params?: WindowParams): params is VideoWindowParams =>
  params?.type === 'video';
