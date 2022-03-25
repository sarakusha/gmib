/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { asyncSerialMap } from '@nibus/core';
import ScreenConfigurator, {
  CabinetPosition,
  HWStatus,
  getCabinetPosition,
} from '@novastar/screen';
import { notEmpty } from './helpers';
import Runnable, { RunnableEvents } from './Runnable';

type Status = ReturnType<HWStatus['toJSON']>;

export type CabinetInfo = CabinetPosition & {
  screen: number;
  status?: Status | null;
  mcuVersion?: string | null;
  fpgaVersion?: string | null;
};

export interface NovastarLoaderEvents extends RunnableEvents {
  cabinet: (info: CabinetInfo) => void;
}

export type NovastarOptions = {
  // screenIndex: number;
  selectors: Set<number>;
};

export enum NovastarSelector {
  Temperature,
  Voltage,
  MCU_Version,
  FPGA_Version,
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
    return asyncSerialMap(this.controller.screens, async (screen, screenIndex) => {
      const statusGen = this.controller.ReadHWStatus(screenIndex);
      const fpgaVersionGen = this.controller.ReadReceivingCardFPGARemarks(screenIndex);
      const mcuVersionGen = this.controller.ReadReceivingCardMCURemarks(screenIndex);
      const addresses = this.controller.GetScreenAllPort(screenIndex, true);
      const result = await asyncSerialMap(
        addresses,
        async ({ SenderIndex, PortIndex, ScanIndex }) => {
          if (this.isCanceled) return null;
          const position = getCabinetPosition(screen, SenderIndex, PortIndex, ScanIndex)!;
          const cabinetInfo = {
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
        }
      );
      return result.filter(notEmpty);
    });
  }
}
