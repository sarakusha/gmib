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
  firmware?: TaurusReceivingCardFirmwareInfo;
};

export type TaurusReceivingCardFirmwareFile = {
  label: string;
  filename: string;
  version?: string;
  remark?: string;
};

export type TaurusReceivingCardFirmwareInfo = {
  filename: string;
  version?: string;
  model?: string;
  modelId?: number;
  files: TaurusReceivingCardFirmwareFile[];
};

export type TaurusReceivingCardVersionInfo = {
  modelId?: number;
  fpgaVersion?: string;
  mcuVersion?: string;
  error?: string;
};

export type TaurusNcpTarget = {
  screen: number;
  port: number;
  receivingCard: number;
  x: number;
  y: number;
  width: number;
  height: number;
  version?: TaurusReceivingCardVersionInfo;
};

export type TaurusNcpInspection = {
  filename: string;
  formatVersion?: number;
  packageName?: string;
  cabinets: TaurusNcpCabinetInfo[];
  targets: TaurusNcpTarget[];
  // warnings: string[];
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

export type TaurusFirmwareApplyRequest = TaurusNcpApplyRequest;

export type TaurusFirmwareApplyResult = {
  completed: number;
  total: number;
  versions: Array<Pick<TaurusNcpTarget, 'port' | 'receivingCard'> & TaurusReceivingCardVersionInfo>;
};
