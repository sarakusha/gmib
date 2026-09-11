export type TaurusScreenSize = {
  width: number;
  height: number;
};

export type TaurusReceivingCardRegion = TaurusScreenSize & {
  x: number;
  y: number;
  xInPort: number;
  yInPort: number;
  column?: number;
  row?: number;
  port: number;
  connection: number;
};

export type TaurusScreenTopology = {
  id: number;
  source: number;
  type: number;
  columns: number;
  rows: number;
  offset: { x: number; y: number };
  portNumber: number;
  portOrder: number[];
  receivingCards: TaurusReceivingCardRegion[];
  size: TaurusScreenSize;
};

export type TaurusScreenConfiguration = {
  screens: TaurusScreenTopology[];
};

export type TaurusConfigurationState = {
  current: TaurusScreenConfiguration;
  backupAvailable: boolean;
};

export type TaurusScrInspection = TaurusConfigurationState & {
  filename: string;
  scrVersion: number;
  target: TaurusScreenConfiguration;
  warnings: string[];
};

export type TaurusNcpCabinetInfo = {
  index: number;
  name: string;
  revision?: number;
  firmwareFile?: string;
  cardModel?: string;
  firmwareVersion?: string;
  icType?: string;
  refreshRate?: number;
  scanType?: number;
  binarySize: number;
  parameterCount: number;
};

export type TaurusNcpTarget = {
  screen: number;
  port: number;
  receivingCard: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TaurusNcpInspection = {
  filename: string;
  formatVersion?: number;
  packageName?: string;
  cabinets: TaurusNcpCabinetInfo[];
  targets: TaurusNcpTarget[];
  warnings: string[];
};

export type TaurusNcpApplyRequest = {
  path: string;
  filename: string;
  cabinetIndex: number;
  targets: Array<Pick<TaurusNcpTarget, 'port' | 'receivingCard'>>;
};

export type TaurusNcpApplyResult = {
  completed: number;
  total: number;
  progress?: number;
};
