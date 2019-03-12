#!/usr/bin/env node
"use strict";

var _yargs = _interopRequireDefault(require("yargs"));

var _mib = require("../mib");

var _dump = _interopRequireDefault(require("./commands/dump"));

var _list = _interopRequireDefault(require("./commands/list"));

var _ping = _interopRequireDefault(require("./commands/ping"));

var _read = _interopRequireDefault(require("./commands/read"));

var _start = _interopRequireDefault(require("./commands/start"));

var _stop = _interopRequireDefault(require("./commands/stop"));

var _write = _interopRequireDefault(require("./commands/write"));

var _upload = _interopRequireDefault(require("./commands/upload"));

var _download = _interopRequireDefault(require("./commands/download"));

var _log = _interopRequireDefault(require("./commands/log"));

var _mib2 = _interopRequireDefault(require("./commands/mib"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// noinspection JSUnusedLocalSymbols
const argv = _yargs.default.option('m', {
  alias: 'mac',
  desc: 'Адрес устройства',
  type: 'string'
}).option('raw', {
  boolean: true,
  default: false,
  desc: 'Cырые данные'
}).option('id', {
  alias: 'name',
  description: 'имя или id переменной',
  array: true
}).option('mib', {
  desc: 'mib-файл',
  choices: (0, _mib.getMibsSync)(),
  string: true
}).option('compact', {
  desc: 'компактная таблица для вывода',
  boolean: true,
  default: true
}).option('q', {
  desc: 'тихий режим',
  boolean: true,
  alias: 'quiet'
}).option('fw', {
  desc: 'использовать firmware_version для определения типа устройства',
  boolean: true,
  default: true
}).command(_start.default).command(_stop.default).command(_list.default).command(_ping.default).command(_dump.default).command(_read.default).command(_write.default).command(_upload.default).command(_download.default).command(_log.default).command(_mib2.default).locale('ru').completion('completion').showHelpOnFail(false).strict().help().wrap(Math.min(_yargs.default.terminalWidth(), 100)).epilogue('(c) Nata-Info, 2019').argv;