import { describe, expect, it } from 'vitest';

import { convertScrToTaurusConfiguration, verifyTaurusConfiguration } from '../src/taurusScr';

describe('Taurus SCR conversion', () => {
  it('converts explicit NovaLCT regions to Taurus topology', () => {
    const result = convertScrToTaurusConfiguration({
      version: 1006,
      dviVersion: 1001,
      dviInfo: {} as never,
      screens: [
        {
          Type: 1,
          X: 4,
          Y: 5,
          ScanBdCols: 2,
          ScanBdRows: 1,
          ScannerRegionList: [
            {
              SenderIndex: 0,
              PortIndex: 0,
              ConnectIndex: 0,
              X: 0,
              Y: 0,
              XInPort: 0,
              YInPort: 0,
              Width: 756,
              Height: 192,
              DVIIndex: 1,
            },
            {
              SenderIndex: 0,
              PortIndex: 1,
              ConnectIndex: 0,
              X: 756,
              Y: 0,
              XInPort: 1,
              YInPort: 0,
              Width: 756,
              Height: 192,
              DVIIndex: 1,
            },
          ],
          ScanBoardCols: 1,
          ScanBoardRows: 1,
        } as never,
      ],
    });

    expect(result).toEqual({
      screens: [
        {
          id: 0,
          source: 1,
          type: 1,
          columns: 2,
          rows: 1,
          offset: { x: 4, y: 5 },
          portNumber: 2,
          portOrder: [0, 1],
          receivingCards: [
            {
              x: 0,
              y: 0,
              xInPort: 0,
              yInPort: 0,
              width: 756,
              height: 192,
              port: 0,
              connection: 0,
              column: 0,
              row: 0,
            },
            {
              x: 756,
              y: 0,
              xInPort: 1,
              yInPort: 0,
              width: 756,
              height: 192,
              port: 1,
              connection: 0,
              column: 1,
              row: 0,
            },
          ],
          size: { width: 1512, height: 192 },
        },
      ],
    });
  });

  it('accepts a device response with receiving cards in a different order', () => {
    const first = {
      id: 0,
      source: 1,
      type: 1,
      columns: 2,
      rows: 1,
      offset: { x: 0, y: 0 },
      portNumber: 2,
      portOrder: [0, 1],
      receivingCards: [
        {
          x: 0,
          y: 0,
          xInPort: 0,
          yInPort: 0,
          width: 756,
          height: 192,
          port: 0,
          connection: 0,
          column: 0,
          row: 0,
        },
        {
          x: 756,
          y: 0,
          xInPort: 1,
          yInPort: 0,
          width: 756,
          height: 192,
          port: 1,
          connection: 0,
          column: 1,
          row: 0,
        },
      ],
      size: { width: 1512, height: 192 },
    };

    expect(() =>
      verifyTaurusConfiguration(
        { screens: [first] },
        { screens: [{ ...first, receivingCards: [...first.receivingCards].reverse() }] },
      ),
    ).not.toThrow();
  });
});
