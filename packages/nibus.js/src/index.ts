#!/usr/bin/env node
/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import yargs from 'yargs';
import { getMibsSync } from '@nata/nibus.js-client/lib/mib';
import dump from './cli/commands/dump';
import list from './cli/commands/list';
import ping from './cli/commands/ping';
import read from './cli/commands/read';
import start from './cli/commands/start';
import stop from './cli/commands/stop';
import write from './cli/commands/write';
import upload from './cli/commands/upload';
import download from './cli/commands/download';
import log from './cli/commands/log';
import mib from './cli/commands/mib';
import flash from './cli/commands/flash';
import execute from './cli/commands/execute';

// noinspection JSUnusedLocalSymbols 111
const argv = yargs
  .option('m', {
    alias: 'mac',
    desc: 'Адрес устройства',
    type: 'string',
  })
  .option('raw', {
    boolean: true,
    default: false,
    desc: 'Cырые данные',
  })
  .option('id', {
    alias: 'name',
    description: 'имя или id переменной',
    array: true,
  })
  .option('mib', {
    desc: 'mib-файл',
    choices: getMibsSync(),
    string: true,
  })
  .option('compact', {
    desc: 'компактная таблица для вывода',
    boolean: true,
    default: true,
  })
  .option('q', {
    desc: 'тихий режим',
    boolean: true,
    alias: 'quiet',
  })
  .option('fw', {
    desc: 'использовать firmware_version для определения типа устройства',
    boolean: true,
    default: true,
  })
  .option('timeout', {
    desc: 'тймаут в секундах',
    number: true,
    default: 1,
  })
  .command(start)
  .command(stop)
  .command(list)
  .command(ping as any)
  .command(dump as any)
  .command(read as any)
  .command(write as any)
  .command(upload as any)
  .command(download as any)
  .command(log as any)
  .command(mib as any)
  .command(flash as any)
  .command(execute as any)
  .locale('ru')
  .completion('completion')
  .showHelpOnFail(false)
  .strict()
  .help()
  .wrap(Math.min(yargs.terminalWidth(), 100))
  .epilogue('(c) Nata-Info, 2019')
  .argv;
