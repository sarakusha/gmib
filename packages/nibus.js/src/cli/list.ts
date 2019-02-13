import { CommandModule } from 'yargs';
import _ from 'lodash';
// @ts-ignore
import Table from 'table-layout';

import { detector } from '../service';
import { IKnownPort } from '../service/detector';

const list: CommandModule = {
  command: 'list',
  describe: 'Показать список доступных устройств',
  builder: {},
  handler: async (argv) => {
    const ports = await detector.getPorts();

    // const col = { width: 12 };
    const rows = _.sortBy<IKnownPort>(ports, [_.property('manufacturer'), _.property('category')])
      .map(({ manufacturer, category, device, comName }) => ({
        manufacturer,
        category,
        device,
        comName,
      }));
    const table = new Table(rows, { maxWidth: 80 });
    //   .map(port => `  ${port.manufacturer}\t  ${port.category}\t  ${port.device}\t
    // ${port.comName}`); console.info(rows.join('\n')); console.log(ports);
    console.info(table.toString());
  },
};

export default list;
