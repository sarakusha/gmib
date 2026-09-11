import path from 'node:path';

import { loadNcpConfig } from '@novastar/screen';
import type { TaurusLedScreenConfiguration } from '@novastar/taurus';

import type {
  TaurusNcpInspection,
  TaurusNcpTarget,
  TaurusReceivingCardFirmwareInfo,
} from '/@common/taurusConfiguration';

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value : undefined;

const optionalNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

export const loadTaurusNcpFirmware = async (
  filename: string,
  cabinetIndex: number,
): Promise<{ data: Buffer; info: TaurusReceivingCardFirmwareInfo }> => {
  validateTaurusNcpFilename(filename);
  const decoded = await loadNcpConfig(filename);
  const cabinet = decoded.cabinets[cabinetIndex];
  if (!cabinet) throw new RangeError('NCP cabinet was not found');
  if (!cabinet.firmware) throw new TypeError('NCP cabinet does not contain firmware');
  return cabinet.firmware;
};

export const getTaurusNcpTargets = (
  configuration: TaurusLedScreenConfiguration,
): TaurusNcpTarget[] =>
  configuration.screens.flatMap(screen =>
    screen.receivingCards.map(card => ({
      screen: screen.id,
      port: card.port,
      receivingCard: card.connection,
      x: screen.offset.x + card.x,
      y: screen.offset.y + card.y,
      width: card.width,
      height: card.height,
    })),
  );

export const validateTaurusNcpFilename = (filename: string): void => {
  if (path.extname(filename).toLowerCase() !== '.ncp') {
    throw new TypeError('A NovaLCT .ncp file is required');
  }
};

export const inspectTaurusNcp = async (
  filename: string,
  configuration: TaurusLedScreenConfiguration,
): Promise<TaurusNcpInspection> => {
  validateTaurusNcpFilename(filename);
  const decoded = await loadNcpConfig(filename);
  if (!decoded.cabinets.length) throw new TypeError('NCP does not contain cabinet configuration');
  return {
    filename,
    formatVersion: decoded.formatVersion,
    packageName: decoded.packageName,
    cabinets: decoded.cabinets.map((cabinet, index) => ({
      index,
      name: cabinet.name,
      revision: cabinet.revision,
      firmwareFile: cabinet.firmwareFile,
      cardModel: optionalString(cabinet.baseInfo.cardModel),
      firmwareVersion: optionalString(cabinet.baseInfo.firmwareVersion),
      icType: optionalString(cabinet.baseInfo.icType),
      refreshRate: optionalNumber(cabinet.baseInfo.refreshRate),
      scanType: optionalNumber(cabinet.baseInfo.scanType),
      binarySize: cabinet.binary.byteLength,
      parameterCount: cabinet.parameters.length,
      firmware: cabinet.firmware?.info,
    })),
    targets: getTaurusNcpTargets(configuration),
  };
};
