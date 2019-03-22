import { CommandModule } from 'yargs';
import _ from 'lodash';
// @ts-ignore
import Table from 'table-layout';
import { PATH } from '../../service/common';
import { Client, IPortArg } from '../../ipc';

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
