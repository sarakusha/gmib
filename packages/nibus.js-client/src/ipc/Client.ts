/*
 * @license
 * Copyright (c) 2019. OOO Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { Socket, SocketConstructorOpts } from 'net';
import { PathReporter } from 'io-ts/lib/PathReporter';
import xpipe from 'xpipe';

import debugFactory from 'debug';
import { EventFromString, IPortArg } from './events';

const debug = debugFactory('nibus:IPCClient');

export interface IClient {
  addListener(event: 'ports', listener: (ports: IPortArg[]) => void): this;
  addListener(event: 'add', listener: (port: IPortArg) => void): this;
  addListener(event: 'remove', listener: (port: IPortArg) => void): this;
  on(event: 'ports', listener: (ports: IPortArg[]) => void): this;
  on(event: 'add', listener: (port: IPortArg) => void): this;
  on(event: 'remove', listener: (port: IPortArg) => void): this;
  once(event: 'ports', listener: (ports: IPortArg[]) => void): this;
  once(event: 'add', listener: (port: IPortArg) => void): this;
  once(event: 'remove', listener: (port: IPortArg) => void): this;
}

export default class IPCClient extends Socket implements IClient {
  protected constructor(options?: SocketConstructorOpts) {
    super(options);
    this.on('data', this.parseEvents);
  }

  parseEvents = (data: Buffer) => {
    const result = EventFromString.decode(data.toString());
    if (result.isLeft()) {
      debug('<error>:', PathReporter.report(result));
      return;
    }
    const { value: { event, args } } = result;
    this.emit(event, ...args);
  };

  send(event: string, ...args: any[]): Promise<void> {
    const data = {
      event,
      args,
    };
    return new Promise(resolve => this.write(JSON.stringify(data), () => resolve()));
  }

  static connect(path: string, connectionListener?: () => void): IPCClient {
    const client = new IPCClient();
    return client.connect(xpipe.eq(path), connectionListener);
  }
}
