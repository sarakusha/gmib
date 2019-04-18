/* tslint:disable:no-this-assignment */
/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { IconButton } from '@material-ui/core';
import { IDevice } from '@nata/nibus.js-client/lib/mib';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { withStyles, createStyles, Theme, WithStyles } from '@material-ui/core/styles';
import { hot } from 'react-hot-loader/root';
import compose from 'recompose/compose';
import debounce from 'lodash/debounce';
import { EventEmitter } from 'events';
import StartIcon from '@material-ui/icons/refresh';
import { useDevicesContext } from './DevicesProvier';
import { useDevice } from './DevicesStateProvider';
import ModuleInfo from './ModuleInfo';
import { useToolbar } from './ToolbarProvider';

type Minihost3InfoType = {
  t?: number,
  v1?: number,
  v2?: number,
  ver?: string,
};

type Module3InfoType = {
  x: number,
  y: number,
  info?: Minihost3InfoType,
  error?: Error,
};

const parseData = (info: Minihost3InfoType, selector: number, data: Buffer) => {
  switch (selector) {
    case 0:
      info.t = data[2] / 2;
      if (info.t > 127) {
        info.t -= 256;
      }
      return;
    case 1:
      info.v1 = data.readUInt16LE(2);
      return;
    case 2:
      info.v2 = data.readUInt16LE(2);
      return;
    case 3:
      info.ver = `${data[3]}.${data[2]}`;
      return;
    default:
      throw new Error(`Unknown selector ${selector}`);
  }
};

const styles = (theme: Theme) => createStyles({
  root: {
    // flex: 1,
    // overflow: 'hidden',
    // width: '100%',
  },
  grid: {
    display: 'grid',
    gridAutoFlow: 'column',
  },
});

type HandlerType = () => void;
type Props = {
  xMin?: number,
  xMax?: number,
  yMin?: number,
  yMax?: number,
  id: string,
  // setStart?: (start: HandlerType) => void,
  // setCancel?: (cancel: HandlerType) => void,
  active?: boolean,
};

class Minihost3Loader extends EventEmitter {
  readonly selectorId: number;
  readonly moduleSelectId: number;
  static DOMAIN = 'MODUL';
  private isCanceled = false;
  private isRunning = false;
  private cancelPromise = Promise.resolve();
  private cancelResolve = () => {};

  constructor(
    readonly xMin: number,
    readonly xMax: number,
    readonly yMin: number,
    readonly yMax: number,
    readonly device: IDevice,
    readonly selectors: number[] = [0, 1, 2, 3]) {
    super();
    this.selectorId = device.getId('selector');
    this.moduleSelectId = device.getId('moduleSelect');
    // console.log('LOADER', xMin, xMax, yMin, yMax);
  }

  cancel() {
    this.isCanceled = true;
    return this.cancelPromise;
  }

  private async readColumn(x: number) {
    const { device, yMin, yMax } = this;
    const columnInfo: Module3InfoType[] = [];
    let y = yMin;
    try {
      while (y < yMax) {
        const info: Minihost3InfoType = {};
        for (const selector of this.selectors) {
          device.selector = selector;
          device.moduleSelect = (x & 0xFF) << 8 + (y & 0xFF);
          await device.write(this.selectorId, this.moduleSelectId);
          if (this.isCanceled) {
            this.isRunning = false;
            this.cancelResolve();
            break;
          }
          const data = await device.upload(Minihost3Loader.DOMAIN, 0, 6);
          // console.log(x, y, selector, printBuffer(data));
          parseData(info, selector, data);
        }
        const module: Module3InfoType = {
          x,
          y,
          info,
        };
        columnInfo.push(module);
        y += 1;
      }
    } catch (error) {
      console.error('load', error.message);
      while (y < yMax) {
        const module: Module3InfoType = {
          x,
          y,
          error,
        };
        // this.emit('module', module);
        columnInfo.push(module);
        y += 1;
      }
    }
    return columnInfo;
  }

  async start() {
    // if (this.device === null) throw new Error('Invalid device');
    if (this.isRunning) {
      await this.cancel();
    }
    this.isCanceled = false;
    this.cancelPromise = new Promise(resolve => this.cancelResolve = resolve);
    this.isRunning = true;

    try {
      const dirv: boolean = this.device.getRawValue('dirv');
      const dirh: boolean = this.device.getRawValue('dirh');
      const modules: Module3InfoType[] = [];
      const { xMin, xMax } = this;
      let x: number;
      let step: number;
      let check: (val: number) => boolean;
      if (dirh) {
        x = xMax - 1;
        step = -1;
        check = i => i >= xMin;
      } else {
        x = xMin;
        step = 1;
        check = i => i < xMax;
      }
      while (check(x)) {
        let column = await this.readColumn(x);
        if (dirv) {
          column = column.reverse();
        }
        this.emit('column', column);
        // console.log(column);
        modules.push(...column);
        x += step;
      }
      return modules;
    } finally {
      this.isRunning = false;
    }
  }
}

type InnerProps = Props & WithStyles<typeof styles>;
const Telemetry: React.FC<InnerProps> = (
  { classes, xMin = 0, xMax, yMin = 0, yMax, id, active = true },
) => {
  const { props, device } = useDevice(id);
  const max = useMemo(
    () => {
      const { hres, vres, moduleHres, moduleVres, maxModulesH } = props;
      // console.log(`${hres}x${vres} ${moduleHres}x${moduleVres}`);
      const x = xMax === undefined
        ? Math.ceil(hres / (moduleHres || hres))
        : Math.min(Math.max(xMin, xMax), maxModulesH);
      const y = yMax === undefined
        ? Math.ceil(vres / (moduleVres || vres))
        : Math.max(yMin, yMax);
      // console.log('x,y', x, y);
      return {
        x,
        y,
      };
    },
    [props],
  );
  const [loader, setLoader] = useState<Minihost3Loader | null>(null);
  const updateLoader = useCallback(
    debounce(
      (xmin, xmax, ymin, ymax) => {
        setLoader(Number.isFinite(xmax)
          ? new Minihost3Loader(xmin, xmax, ymin, ymax, device!)
          : null);
      },
      100,
    ),
    [setLoader],
  );

  useEffect(() => updateLoader(xMin, max.x, yMin, max.y), [max.x, max.y]);

  const style = useMemo(
    () => {
      return {
        gridTemplateRows: `repeat(${max.y - yMin}, 1fr)`,
      };
    },
    [max.y, yMin],
  );

  const [modules, setModules] = useState<Module3InfoType[]>([]);
  const start = useCallback(
    () => {
      setModules([]);
      loader && loader.start();
    },
    [!!loader],
  );
  const cancel = useCallback(() => loader && loader.cancel(), []);
  const telemetryToolbar = useMemo(
    () => (
      <IconButton onClick={start} color="inherit">
        <StartIcon />
      </IconButton>
    ),
    [start],
  );
  const [, setToolbar] = useToolbar();
  const { current } = useDevicesContext();
  useEffect(
    () => setToolbar((toolbar: React.ReactNode) => {
      if (active && current === id) return telemetryToolbar;
      return toolbar === telemetryToolbar ? null : toolbar;
    }),
    [active, current],
  );

  // useEffect(
  //   () => {
  //     setStart && setStart(start);
  //   },
  //   [setStart, start],
  // );
  // useEffect(
  //   () => {
  //     setCancel && setCancel(cancel);
  //   },
  //   [setCancel, cancel],
  // );
  useEffect(
    () => {
      // console.log('CHECK', !!loader);
      if (!loader) return;
      const columnHandler = (column: Module3InfoType[]) => {
        // console.log(module, module);
        setModules(modules => modules.concat(column));
      };
      loader.on('column', columnHandler);
      // setModules([]);
      // console.log('START');
      // loader.start();
      return () => {
        loader.off('column', columnHandler);
      };
    },
    [loader],
  );

  // console.log('STYLE', style);
  return (
    <div className={classes.root}>
      <div className={classes.grid} style={style}>
        {modules.map(props => (
          <ModuleInfo
            key={`${props.y}:${props.x}`}
            {...props}
          />
        ))}
      </div>
    </div>
  );
};

export default compose<InnerProps, Props>(
  hot,
  React.memo,
  withStyles(styles),
)(Telemetry);
