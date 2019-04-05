/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { CommandModule } from 'yargs';
import _ from 'lodash';
// @ts-ignore
import Table from 'table-layout';
import { PATH } from '@nata/nibus.js-client';
import { Client, IPortArg } from '@nata/nibus.js-client/lib/ipc';

const listCommand: CommandModule = {
  command: 'list',
  describe: 'Показать список доступных устройств',
  builder: {},
  handler: async () => new Promise((resolve, reject) => {
    const socket = Client.connect(PATH);
    let resolved = false;
    let error: any;
    socket.once('close', () => {
      resolved ? resolve() : reject(error && error.message);
    });
    socket.on('ports', (ports: IPortArg[]) => {
      // debug('ports', ports);
      const rows = _.sortBy(ports, [_.property('description.category')])
        .map(({ portInfo: { manufacturer, category, device, comName } }) => ({
          manufacturer,
          category,
          device,
          comName,
        }));
      const table = new Table(rows, {
        maxWidth: 80,
      });
      console.info(table.toString());
      resolved = true;
      socket.destroy();
    });
    socket.on('error', (err) => {
      if ((err as any).code === 'ENOENT') {
        error = { message: 'Сервис не запущен' };
      } else {
        error = err;
      }
    });
  }),

// const rows = _.sortBy<IKnownPort>(ports, [_.property('manufacturer'),
// _.property('category')]) .map(({ manufacturer, category, device, comName }) => ({
// manufacturer, category, device, comName, })); const table = new Table(rows, { maxWidth: 80
// }); console.info(table.toString());
};

export default listCommand;
