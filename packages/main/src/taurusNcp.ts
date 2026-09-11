import fs from 'node:fs/promises';
import path from 'node:path';

import { loadNcpConfig } from '@novastar/screen';
import type { TaurusLedScreenConfiguration } from '@novastar/taurus';
import { Uint8ArrayReader, Uint8ArrayWriter, ZipReader } from '@zip.js/zip.js';
import { XMLParser } from 'fast-xml-parser';

import type {
  TaurusNcpInspection,
  TaurusNcpTarget,
  TaurusReceivingCardFirmwareFile,
  TaurusReceivingCardFirmwareInfo,
} from '/@common/taurusConfiguration';

const NCP_OUTER_PASSWORD = 'N0@|,[)9.$eP';
const NCP_PACKAGE_PASSWORD = '*^Tm!{>6v8=&';
const MAX_FIRMWARE_SIZE = 64 * 1024 * 1024;

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value : undefined;

const optionalNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const asObject = (value: unknown, message: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(message);
  }
  return value as Record<string, unknown>;
};

const stringValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value || undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
};

const numberValue = (value: unknown): number | undefined => {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
};

const unzip = async (buffer: Buffer, password?: string): Promise<Map<string, Buffer>> => {
  const reader = new ZipReader(new Uint8ArrayReader(buffer));
  try {
    const files = new Map<string, Buffer>();
    for (const entry of await reader.getEntries()) {
      if (entry.directory) continue;
      const data = await entry.getData(new Uint8ArrayWriter(), password ? { password } : undefined);
      files.set(entry.filename.replaceAll('\\', '/'), Buffer.from(data));
    }
    return files;
  } finally {
    await reader.close();
  }
};

const findFile = (files: Map<string, Buffer>, filename: string): Buffer | undefined => {
  const normalized = filename.replaceAll('\\', '/');
  const exact = files.get(normalized);
  if (exact) return exact;
  const base = path.posix.basename(normalized).toLowerCase();
  return [...files].find(([name]) => path.posix.basename(name).toLowerCase() === base)?.[1];
};

const findFileByExtension = (files: Map<string, Buffer>, extension: string): Buffer | undefined =>
  [...files].find(([name]) => path.posix.extname(name).toLowerCase() === extension)?.[1];

const readNcpPackage = async (filename: string): Promise<Map<string, Buffer>> => {
  const outer = await unzip(await fs.readFile(filename), NCP_OUTER_PASSWORD);
  const payload = findFile(outer, 'package');
  if (!payload) throw new TypeError('Invalid NCP package entry');
  return unzip(payload, NCP_PACKAGE_PASSWORD);
};

const firmwareFiles = (value: unknown): TaurusReceivingCardFirmwareFile[] => {
  const items = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return items.flatMap(item => {
    const file = asObject(item, 'Invalid receiving-card firmware file entry');
    const filename = stringValue(file.FileName);
    const label = stringValue(file.FileLabel);
    if (!filename || !label) return [];
    return [
      {
        label,
        filename,
        version: stringValue(file.Version),
        remark: stringValue(file.Remark),
      },
    ];
  });
};

export const inspectTaurusFirmwareArchive = async (
  data: Buffer,
  filename: string,
): Promise<TaurusReceivingCardFirmwareInfo> => {
  if (data.byteLength > MAX_FIRMWARE_SIZE) {
    throw new RangeError(`Receiving-card firmware is too large: ${data.byteLength} bytes`);
  }
  const files = await unzip(data);
  const config = findFile(files, 'Config.xml');
  if (!config) throw new TypeError('Receiving-card firmware Config.xml is missing');
  const parsed = new XMLParser({ ignoreAttributes: false, parseTagValue: false }).parse(
    config.toString('utf8'),
  );
  const root = asObject(
    asObject(parsed, 'Invalid firmware XML').DataPackage,
    'Invalid firmware XML',
  );
  if (stringValue(root.DeviceTypes) !== 'Scanner') {
    throw new TypeError('Firmware is not intended for receiving cards');
  }
  const configBasic =
    typeof root.BasicInfo === 'object' && root.BasicInfo !== null && !Array.isArray(root.BasicInfo)
      ? asObject(root.BasicInfo, 'Invalid receiving-card firmware model')
      : undefined;
  const iniData = findFileByExtension(files, '.ini');
  const ini = iniData
    ? asObject(JSON.parse(iniData.toString('utf8')), 'Invalid receiving-card firmware INI')
    : undefined;
  const iniBasic =
    ini &&
    typeof ini.BasicInfo === 'object' &&
    ini.BasicInfo !== null &&
    !Array.isArray(ini.BasicInfo)
      ? asObject(ini.BasicInfo, 'Invalid receiving-card firmware INI model')
      : undefined;
  const result: TaurusReceivingCardFirmwareInfo = {
    filename,
    version: stringValue(root.Version),
    model: stringValue(configBasic?.Type) ?? stringValue(iniBasic?.Type),
    modelId: numberValue(root.ModuleID),
    files: firmwareFiles(root.FileInfo),
  };
  if (!result.modelId || !result.files.length) {
    throw new TypeError('Receiving-card firmware metadata is incomplete');
  }
  result.files.forEach(file => {
    if (!findFile(files, file.filename)) {
      throw new TypeError(`Receiving-card firmware file is missing: ${file.filename}`);
    }
  });
  return result;
};

const firmwareFromPackage = async (
  files: Map<string, Buffer>,
  filename: string,
): Promise<{ data: Buffer; info: TaurusReceivingCardFirmwareInfo }> => {
  const data = findFile(files, filename);
  if (!data) throw new TypeError(`NCP firmware file is missing: ${filename}`);
  return { data, info: await inspectTaurusFirmwareArchive(data, filename) };
};

export const loadTaurusNcpFirmware = async (
  filename: string,
  cabinetIndex: number,
): Promise<{ data: Buffer; info: TaurusReceivingCardFirmwareInfo }> => {
  validateTaurusNcpFilename(filename);
  const decoded = await loadNcpConfig(filename);
  const cabinet = decoded.cabinets[cabinetIndex];
  if (!cabinet) throw new RangeError('NCP cabinet was not found');
  if (!cabinet.firmwareFile) throw new TypeError('NCP cabinet does not contain firmware');
  return firmwareFromPackage(await readNcpPackage(filename), cabinet.firmwareFile);
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
  const packageFiles = decoded.cabinets.some(cabinet => cabinet.firmwareFile)
    ? await readNcpPackage(filename)
    : undefined;
  return {
    filename,
    formatVersion: decoded.formatVersion,
    packageName: decoded.packageName,
    cabinets: await Promise.all(
      decoded.cabinets.map(async (cabinet, index) => ({
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
        firmware:
          cabinet.firmwareFile && packageFiles
            ? (await firmwareFromPackage(packageFiles, cabinet.firmwareFile)).info
            : undefined,
      })),
    ),
    targets: getTaurusNcpTargets(configuration),
  };
};
