import type { TaurusClient } from '@novastar/taurus';

import type { RunnableEvents } from '/@common/Runnable';
import Runnable from '/@common/Runnable';
import type { CabinetInfo, NovastarOptions } from '/@common/helpers';
import { NovastarSelector } from '/@common/helpers';

type TaurusRegion = {
  X?: unknown;
  Y?: unknown;
  colIndexInScreen?: unknown;
  rowIndexInScreen?: unknown;
  senderIndex?: unknown;
  portIndex?: unknown;
  connectIndex?: unknown;
  width?: unknown;
  height?: unknown;
};

type TaurusTopology = { receiveCardRegionInfo?: TaurusRegion[] };

type TaurusCardMonitor = {
  portIndex?: unknown;
  connectIndex?: unknown;
  temprature?: unknown;
  voltage?: unknown;
  deviceWorkState?: unknown;
  remarksVersionInfo?: unknown;
  fpgaHardwareVersionInfo?: unknown;
  mcuHardwareVersionInfo?: unknown;
};

type TaurusMonitorResult = {
  screenMonitorData?: Array<{ receiveCardMonitorInfo?: TaurusCardMonitor }>;
};

const number = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const validReading = (value: unknown): number | null => {
  const result = number(value, -255);
  return result === -255 ? null : result;
};

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

export const readTaurusReceivingCards = async (
  client: TaurusClient,
  selectors: Set<NovastarSelector>,
): Promise<CabinetInfo[]> => {
  const topology = await client.connection.requestJson<TaurusTopology>({
    what: 33,
    type: 7,
    action: 5,
  });
  const telemetry = await client.connection.requestJson<TaurusMonitorResult>(
    { what: 33, type: 8, action: 5 },
    topology,
  );
  const monitorByAddress = new Map(
    (telemetry.screenMonitorData ?? []).map(({ receiveCardMonitorInfo = {} }) => [
      `${number(receiveCardMonitorInfo.portIndex)}:${number(receiveCardMonitorInfo.connectIndex)}`,
      receiveCardMonitorInfo,
    ]),
  );

  return (topology.receiveCardRegionInfo ?? []).map(region => {
    const port = number(region.portIndex);
    const card = number(region.connectIndex);
    const monitor = monitorByAddress.get(`${port}:${card}`);
    return {
      screen: 0,
      column: number(region.colIndexInScreen),
      row: number(region.rowIndexInScreen),
      left: number(region.X),
      top: number(region.Y),
      sender: number(region.senderIndex),
      port,
      card,
      width: number(region.width),
      height: number(region.height),
      working: number(monitor?.deviceWorkState, 1) === 0,
      temperature: selectors.has(NovastarSelector.Temperature)
        ? validReading(monitor?.temprature)
        : undefined,
      voltage: selectors.has(NovastarSelector.Voltage) ? validReading(monitor?.voltage) : undefined,
      fpgaVersion: selectors.has(NovastarSelector.FPGA_Version)
        ? text(monitor?.fpgaHardwareVersionInfo)
        : undefined,
      mcuVersion: selectors.has(NovastarSelector.MCU_Version)
        ? text(monitor?.mcuHardwareVersionInfo)
        : undefined,
      remarksVersion: text(monitor?.remarksVersionInfo),
    };
  });
};

interface TaurusTelemetryLoaderEvents extends RunnableEvents {
  cabinet: (info: CabinetInfo) => void;
}

export default class TaurusTelemetryLoader extends Runnable<
  NovastarOptions,
  TaurusTelemetryLoaderEvents,
  CabinetInfo[]
> {
  constructor(readonly client: TaurusClient) {
    super();
  }

  protected async runImpl({ selectors }: NovastarOptions): Promise<CabinetInfo[]> {
    const result = await readTaurusReceivingCards(this.client, selectors);
    if (!this.isCanceled) result.forEach(info => this.emit('cabinet', info));
    return this.isCanceled ? [] : result;
  }
}
