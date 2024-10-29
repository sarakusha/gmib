import type ScreenConfigurator from '@novastar/screen';
import { getCabinetPosition } from '@novastar/screen';
import flatten from 'lodash/flatten';
// import debugFactory from 'debug';

import type { RunnableEvents } from '/@common/Runnable';
import Runnable from '/@common/Runnable';
import type { CabinetInfo, NovastarOptions } from '/@common/helpers';
import { asyncSerial, notEmpty, NovastarSelector } from '/@common/helpers';

// const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:NovastarLoader`);

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
      await asyncSerial(this.controller.screens, async (screen, screenIndex) => {
        const statusGen = this.controller.ReadHWStatus(screenIndex);
        const fpgaVersionGen = this.controller.ReadReceivingCardFPGARemarks(screenIndex);
        const mcuVersionGen = this.controller.ReadReceivingCardMCURemarks(screenIndex);
        const addresses = this.controller.GetScreenAllPort(screenIndex, true);
        // debug(JSON.stringify({ addresses, selectors: [...selectors.values()] }));
        const result = await asyncSerial(
          addresses,
          async ({ SenderIndex, PortIndex, ScanIndex }) => {
            if (this.isCanceled) return null;
            const position = getCabinetPosition(screen, SenderIndex, PortIndex, ScanIndex);
            if (!position) throw new Error('Unknown position');
            const status = (await statusGen.next()).value;
            // debug({
            //   status,
            //   has: selectors.has(NovastarSelector.Temperature),
            //   selectors: [...selectors.values()],
            //   temp: NovastarSelector.Temperature,
            // });
            const cabinetInfo: CabinetInfo = {
              ...position,
              status:
                selectors.has(NovastarSelector.Voltage) ||
                selectors.has(NovastarSelector.Temperature)
                  ? status
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
            // debug(JSON.stringify({ cabinetInfo }));
            return cabinetInfo;
          },
        );
        return result.filter(notEmpty);
      }),
    );
  }
}
