export type WindowsTaurusAdapter = {
  /** USB parent identity, never an adapter alias or interface index. */
  deviceId: string;
  serialNumber: string;
  interfaceAlias: string;
  interfaceIndex: number;
  interfaceGuid: string;
  defaultRoutes: Array<{ nextHop: string; metric: number; table?: string }>;
  dnsServers: string[];
  confirmedTaurus?: boolean;
  protection: 'enabled' | 'missing' | 'unknown';
  autoEnabled?: boolean;
  automaticSupported?: boolean;
};

export type WindowsTaurusRouteStatus = {
  supported: boolean;
  elevated: boolean;
  adapters: WindowsTaurusAdapter[];
  platform: 'win32' | 'linux' | 'unsupported';
  diagnostic?: string;
  routeInspectionComplete?: boolean;
};
