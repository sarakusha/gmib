import { describe, expect, it } from 'vitest';

import { getTaurusNcpTargets, validateTaurusNcpFilename } from '../src/taurusNcp';

describe('Taurus NCP support', () => {
  it('maps receiving cards to global screen coordinates', () => {
    expect(
      getTaurusNcpTargets({
        screens: [
          {
            id: 2,
            source: 1,
            type: 1,
            columns: 2,
            rows: 1,
            offset: { x: 10, y: 20 },
            portNumber: 2,
            portOrder: [0, 1],
            receivingCards: [
              {
                x: 756,
                y: 0,
                xInPort: 0,
                yInPort: 0,
                width: 756,
                height: 192,
                port: 1,
                connection: 0,
              },
            ],
            size: { width: 1512, height: 192 },
          },
        ],
      }),
    ).toEqual([
      {
        screen: 2,
        port: 1,
        receivingCard: 0,
        x: 766,
        y: 20,
        width: 756,
        height: 192,
      },
    ]);
  });

  it('accepts NCP filenames case-insensitively', () => {
    expect(() => validateTaurusNcpFilename('/tmp/cabinet.NCP')).not.toThrow();
    expect(() => validateTaurusNcpFilename('/tmp/topology.scr')).toThrow(/\.ncp/);
  });
});
