import type { TaurusClient } from '@novastar/taurus';

import type { TaurusNcpTarget, TaurusReceivingCardVersionInfo } from '/@common/taurusConfiguration';
import { NovastarSelector } from '/@common/helpers';

import { readTaurusReceivingCards } from './TaurusTelemetryLoader';

type Address = Pick<TaurusNcpTarget, 'port' | 'receivingCard'>;

type RawVersionInfo = {
  portIndex?: unknown;
  connectedIndex?: unknown;
  modelId?: unknown;
};

type RawVersionResponse = { receiveCardList?: unknown };

const optionalNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;

const versionInfo = (result: RawVersionInfo): TaurusReceivingCardVersionInfo => ({
  modelId: optionalNumber(result.modelId),
});

const requestTaurusReceivingCardVersions = async (
  client: TaurusClient,
  targets: Address[],
): Promise<Array<Address & TaurusReceivingCardVersionInfo>> => {
  try {
    const result = await client.connection.requestJson<RawVersionResponse>(
      { what: 46, type: 7, action: 5 },
      {
        receiveCardList: targets.map(target => ({
          portIndex: target.port,
          connectedIndex: target.receivingCard,
        })),
      },
    );
    const cards = Array.isArray(result.receiveCardList)
      ? (result.receiveCardList as RawVersionInfo[])
      : [];
    const byAddress = new Map(
      cards.map(card => [
        `${optionalNumber(card.portIndex)}:${optionalNumber(card.connectedIndex)}`,
        card,
      ]),
    );
    return targets.map(target => {
      const card = byAddress.get(`${target.port}:${target.receivingCard}`);
      return card
        ? { ...target, ...versionInfo(card) }
        : { ...target, error: 'Receiving card did not return its version information' };
    });
  } catch (error) {
    return targets.map(target => ({ ...target, error: (error as Error).message }));
  }
};

export const readTaurusReceivingCardVersion = async (
  client: TaurusClient,
  target: Address,
): Promise<TaurusReceivingCardVersionInfo> => {
  const [result] = await readTaurusReceivingCardVersions(client, [target]);
  if (!result) return {};
  const { port: _port, receivingCard: _receivingCard, ...info } = result;
  return info;
};

export const readTaurusReceivingCardVersions = async (
  client: TaurusClient,
  targets: Address[],
): Promise<Array<Address & TaurusReceivingCardVersionInfo>> => {
  const result: Array<Address & TaurusReceivingCardVersionInfo> = [];
  // One disconnected address must not discard versions read from the other cards.
  for (const target of targets) {
    const [details] = await requestTaurusReceivingCardVersions(client, [target]);
    result.push(details ?? target);
  }
  try {
    // The detailed-version command is authoritative for modelId, but its similarly named
    // version fields describe component builds. Use the monitor command for the live FPGA/MCU
    // versions so this view is identical to Taurus telemetry.
    const telemetry = await readTaurusReceivingCards(
      client,
      new Set([NovastarSelector.FPGA_Version, NovastarSelector.MCU_Version]),
    );
    const byAddress = new Map(telemetry.map(card => [`${card.port}:${card.card}`, card]));
    return result.map(target => {
      const card = byAddress.get(`${target.port}:${target.receivingCard}`);
      return {
        ...target,
        fpgaVersion: card?.fpgaVersion ?? undefined,
        mcuVersion: card?.mcuVersion ?? undefined,
      };
    });
  } catch {
    // Model compatibility can still be checked when monitoring is temporarily unavailable.
  }
  return result;
};

export const applyTaurusReceivingCardFirmware = async (
  client: TaurusClient,
  devicePath: string,
  targets: Address[],
): Promise<void> => {
  const connection = client.connection as typeof client.connection & { timeout: number };
  const previousTimeout = connection.timeout;
  // ScreenService applies every file in the archive and restarts MCU/FPGA for every target.
  connection.timeout = Math.max(previousTimeout, 180_000 + targets.length * 120_000);
  try {
    await connection.requestJson(
      { what: 46, type: 1, action: 8 },
      {
        updateList: targets.map(target => ({
          filePath: devicePath,
          portIndex: target.port,
          connectedIndex: target.receivingCard,
        })),
      },
    );
  } finally {
    connection.timeout = previousTimeout;
  }
};
