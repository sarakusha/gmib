import { describe, expect, it, vi } from 'vitest';

import type { TaurusClient } from '@novastar/taurus';

import { NovastarSelector } from '/@common/helpers';

import { readTaurusReceivingCards } from '../src/TaurusTelemetryLoader';

describe('readTaurusReceivingCards', () => {
  it('joins topology and monitor data and discards the -255 sensor sentinel', async () => {
    const topology = {
      receiveCardRegionInfo: [
        {
          X: 756,
          Y: 192,
          colIndexInScreen: 1,
          rowIndexInScreen: 1,
          senderIndex: 0,
          portIndex: 1,
          connectIndex: 3,
          width: 756,
          height: 192,
        },
      ],
    };
    const requestJson = vi
      .fn()
      .mockResolvedValueOnce(topology)
      .mockResolvedValueOnce({
        screenMonitorData: [
          {
            receiveCardMonitorInfo: {
              portIndex: 1,
              connectIndex: 3,
              temprature: -255,
              voltage: 3.7,
              deviceWorkState: 0,
              fpgaHardwareVersionInfo: '1.2.3',
              mcuHardwareVersionInfo: '',
            },
          },
        ],
      });
    const client = { connection: { requestJson } } as unknown as TaurusClient;

    const result = await readTaurusReceivingCards(
      client,
      new Set(Object.values(NovastarSelector).filter(value => typeof value === 'number')),
    );

    expect(requestJson).toHaveBeenNthCalledWith(1, { what: 33, type: 7, action: 5 });
    expect(requestJson).toHaveBeenNthCalledWith(2, { what: 33, type: 8, action: 5 }, topology);
    expect(result).toEqual([
      expect.objectContaining({
        column: 1,
        row: 1,
        port: 1,
        card: 3,
        width: 756,
        height: 192,
        working: true,
        temperature: null,
        voltage: 3.7,
        fpgaVersion: '1.2.3',
        mcuVersion: null,
      }),
    ]);
  });
});
