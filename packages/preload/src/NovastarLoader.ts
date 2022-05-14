import type ScreenConfigurator from '@novastar/screen';
import getCabinetPosition from '@novastar/screen/lib/getCabinetPosition';
import flatten from 'lodash/flatten';
import pMap from 'p-map';

import type { RunnableEvents } from './Runnable';
import Runnable from './Runnable';

import type { CabinetInfo, NovastarOptions } from '/@common/helpers';
import { notEmpty, NovastarSelector } from '/@common/helpers';

export interface NovastarLoaderEvents extends RunnableEvents {
  cabinet: (info: CabinetInfo) => void;
}

export default class NovastarLoader extends Runnable<
  NovastarOptions,
  NovastarLoaderEvents,
  CabinetInfo[]
> {
  constructor(readonly controller: ScreenConfigurator) {
    super();
  }

  protected async runImpl({ selectors }: NovastarOptions): Promise<CabinetInfo[]> {
    return flatten(
      await pMap(this.controller.screens, async (screen, screenIndex) => {
        const statusGen = this.controller.ReadHWStatus(screenIndex);
        const fpgaVersionGen = this.controller.ReadReceivingCardFPGARemarks(screenIndex);
        const mcuVersionGen = this.controller.ReadReceivingCardMCURemarks(screenIndex);
        const addresses = this.controller.GetScreenAllPort(screenIndex, true);
        const result = await pMap(addresses, async ({ SenderIndex, PortIndex, ScanIndex }) => {
          if (this.isCanceled) return null;
          const position = getCabinetPosition(screen, SenderIndex, PortIndex, ScanIndex);
          if (!position) throw new Error('Unknown position');
          const cabinetInfo: CabinetInfo = {
            ...position,
            status:
              selectors.has(NovastarSelector.Voltage) || selectors.has(NovastarSelector.Temperature)
                ? (await statusGen.next()).value
                : undefined,
            fpgaVersion: selectors.has(NovastarSelector.FPGA_Version)
              ? (await fpgaVersionGen.next()).value
              : undefined,
            mcuVersion: selectors.has(NovastarSelector.MCU_Version)
              ? (await mcuVersionGen.next()).value
              : undefined,
            screen: screenIndex,
          };
          this.emit('cabinet', cabinetInfo);
          return cabinetInfo;
        });
        return result.filter(notEmpty);
      }),
    );
  }
}
