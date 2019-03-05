#!/usr/bin/env node --no-warnings
import yargs from 'yargs';
import { getMibsSync } from '../mib';
import dump from './commands/dump';
import list from './commands/list';
import ping from './commands/ping';
import read from './commands/read';
import start from './commands/start';
import write from './commands/write';
import upload from './commands/upload';
import download from './commands/download';

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
  .command(start)
  .command(list)
  .command(ping)
  .command(dump as any)
  .command(read as any)
  .command(write as any)
  .command(upload as any)
  .command(download as any)
  .locale('ru')
  .completion('completion')
  .showHelpOnFail(false)
  .strict()
  .help()
  .wrap(Math.min(yargs.terminalWidth(), 100))
  .epilogue('(c) Nata-Info, 2019')
  .argv;
