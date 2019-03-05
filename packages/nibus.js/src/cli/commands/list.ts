import { CommandModule } from 'yargs';
import _ from 'lodash';
// @ts-ignore
import Table from 'table-layout';
import debugFactory from 'debug';
// import { Socket, connect } from 'net';
import { PATH } from '../../service/const';
import { Client, IPortArg } from '../../ipc';

// import service, { detector } from '../service';
// import { IKnownPort } from '../service/detector';

const debug = debugFactory('nibus:list');
const listCommand: CommandModule = {
  command: 'list',
  describe: 'Показать список доступных устройств',
  builder: {},
  handler: async () => new Promise((resolve, reject) => {
    const socket = Client.connect(PATH);
    let closed = false;
    let resolved = false;
    socket.once('close', () => {
      // debug('close event');
      if (!closed) {
        closed = true;
        resolved || reject();
      }
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
      resolve();
      socket.destroy();
    });
    socket.on('error', (err) => {
      debug('<error>', err);
    });

  }),

// const rows = _.sortBy<IKnownPort>(ports, [_.property('manufacturer'),
// _.property('category')]) .map(({ manufacturer, category, device, comName }) => ({
// manufacturer, category, device, comName, })); const table = new Table(rows, { maxWidth: 80
// }); console.info(table.toString());
};

export default listCommand;
