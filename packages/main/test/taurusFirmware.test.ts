import { TextReader, Uint8ArrayWriter, ZipWriter } from '@zip.js/zip.js';
import { describe, expect, it, vi } from 'vitest';

import type { TaurusClient } from '@novastar/taurus';

import {
  applyTaurusReceivingCardFirmware,
  readTaurusReceivingCardVersion,
} from '../src/taurusFirmware';
import { inspectTaurusFirmwareArchive } from '../src/taurusNcp';

const firmwareArchive = async (): Promise<Buffer> => {
  const writer = new ZipWriter(new Uint8ArrayWriter());
  await writer.add(
    'Config.xml',
    new TextReader(`<?xml version="1.0"?>
      <DataPackage>
        <DeviceTypes>Scanner</DeviceTypes>
        <ModuleID>18434</ModuleID>
        <Version>1.3.16.114</Version>
        <FileInfo>
          <FileLabel>MCU</FileLabel><Version>1.3.10.72</Version>
          <Remark>MCU build</Remark><FileName>mcu.dat</FileName>
        </FileInfo>
        <FileInfo>
          <FileLabel>FPGA</FileLabel><Version>1.3.10.72</Version>
          <Remark>FPGA build</Remark><FileName>fpga.dat</FileName>
        </FileInfo>
      </DataPackage>`),
  );
  await writer.add('Data_A10s.ini', new TextReader('{"BasicInfo":{"Type":"A10s Pro"}}'));
  await writer.add('mcu.dat', new TextReader('mcu'));
  await writer.add('fpga.dat', new TextReader('fpga'));
  return Buffer.from(await writer.close());
};

describe('Taurus receiving-card firmware', () => {
  it('reads the model, package version and component list from the firmware archive', async () => {
    await expect(
      inspectTaurusFirmwareArchive(await firmwareArchive(), 'Data_A10s.zip'),
    ).resolves.toEqual({
      filename: 'Data_A10s.zip',
      version: '1.3.16.114',
      model: 'A10s Pro',
      modelId: 18434,
      files: [
        {
          label: 'MCU',
          filename: 'mcu.dat',
          version: '1.3.10.72',
          remark: 'MCU build',
        },
        {
          label: 'FPGA',
          filename: 'fpga.dat',
          version: '1.3.10.72',
          remark: 'FPGA build',
        },
      ],
    });
  });

  it('reads detailed versions from the explicitly addressed receiving card', async () => {
    const topology = {
      receiveCardRegionInfo: [{ portIndex: 0, connectIndex: 1 }],
    };
    const requestJson = vi
      .fn()
      .mockResolvedValueOnce({
        receiveCardList: [
          {
            portIndex: 0,
            connectedIndex: 1,
            modelId: 18434,
            fpgaVersion: 'V1.3.10.72',
            mcuVersion: 'V1.3.10.72',
            fpgaHardwareVersionInfo: '2026.01.06 A10s Pro_FPGA_V1.3.9.22.hongzhST2',
            mcuHardwareVersionInfo: '2026.01.06 A10s Pro_MCU_V1.3.5.80.yuanxm',
          },
        ],
      })
      .mockResolvedValueOnce(topology)
      .mockResolvedValueOnce({
        screenMonitorData: [
          {
            receiveCardMonitorInfo: {
              portIndex: 0,
              connectIndex: 1,
              fpgaHardwareVersionInfo: '1.3.16.114',
              mcuHardwareVersionInfo: '1.3.16.114',
            },
          },
        ],
      });
    const client = { connection: { requestJson } } as unknown as TaurusClient;

    await expect(
      readTaurusReceivingCardVersion(client, { port: 0, receivingCard: 1 }),
    ).resolves.toEqual({
      modelId: 18434,
      fpgaVersion: '1.3.16.114',
      mcuVersion: '1.3.16.114',
    });
    expect(requestJson).toHaveBeenNthCalledWith(
      1,
      { what: 46, type: 7, action: 5 },
      { receiveCardList: [{ portIndex: 0, connectedIndex: 1 }] },
    );
    expect(requestJson).toHaveBeenNthCalledWith(2, { what: 33, type: 7, action: 5 });
    expect(requestJson).toHaveBeenNthCalledWith(3, { what: 33, type: 8, action: 5 }, topology);
  });

  it('sends one firmware archive to the selected raw card addresses', async () => {
    const requestJson = vi.fn().mockResolvedValue(undefined);
    const connection = { requestJson, timeout: 5_000 };
    const client = { connection } as unknown as TaurusClient;

    await applyTaurusReceivingCardFirmware(client, '/mnt/sdcard/gmib/fw.zip', [
      { port: 0, receivingCard: 1 },
      { port: 1, receivingCard: 0 },
    ]);

    expect(requestJson).toHaveBeenCalledWith(
      { what: 46, type: 1, action: 8 },
      {
        updateList: [
          { filePath: '/mnt/sdcard/gmib/fw.zip', portIndex: 0, connectedIndex: 1 },
          { filePath: '/mnt/sdcard/gmib/fw.zip', portIndex: 1, connectedIndex: 0 },
        ],
      },
    );
    expect(connection.timeout).toBe(5_000);
  });
});
