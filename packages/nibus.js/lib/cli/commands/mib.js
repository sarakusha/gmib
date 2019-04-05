"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

require("source-map-support/register");

var _PathReporter = require("io-ts/lib/PathReporter");

var _path = _interopRequireDefault(require("path"));

var _mib = require("@nata/nibus.js-client/lib/mib");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
const mibCommand = {
  command: 'mib <mibfile>',
  describe: 'добавить mib-файл',
  builder: argv => argv.positional('mibfile', {
    describe: 'путь к mib-файлу',
    type: 'string'
  }).demandOption('mibfile'),
  handler: async ({
    mibfile
  }) => {
    const dest = _path.default.resolve(__dirname, '../../../mibs');

    await (0, _mib.convert)(mibfile, dest);

    const validation = _mib.MibDeviceV.decode(require(dest));

    if (validation.isLeft()) {
      throw new Error(`Invalid mib file: ${mibfile}
      ${_PathReporter.PathReporter.report(validation)}`);
    }
  }
};
var _default = mibCommand;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jbGkvY29tbWFuZHMvbWliLnRzIl0sIm5hbWVzIjpbIm1pYkNvbW1hbmQiLCJjb21tYW5kIiwiZGVzY3JpYmUiLCJidWlsZGVyIiwiYXJndiIsInBvc2l0aW9uYWwiLCJ0eXBlIiwiZGVtYW5kT3B0aW9uIiwiaGFuZGxlciIsIm1pYmZpbGUiLCJkZXN0IiwicGF0aCIsInJlc29sdmUiLCJfX2Rpcm5hbWUiLCJ2YWxpZGF0aW9uIiwiTWliRGV2aWNlViIsImRlY29kZSIsInJlcXVpcmUiLCJpc0xlZnQiLCJFcnJvciIsIlBhdGhSZXBvcnRlciIsInJlcG9ydCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBVUE7O0FBRUE7O0FBQ0E7Ozs7QUFiQTs7Ozs7Ozs7O0FBZUEsTUFBTUEsVUFBeUIsR0FBRztBQUNoQ0MsRUFBQUEsT0FBTyxFQUFFLGVBRHVCO0FBRWhDQyxFQUFBQSxRQUFRLEVBQUUsbUJBRnNCO0FBR2hDQyxFQUFBQSxPQUFPLEVBQUVDLElBQUksSUFBSUEsSUFBSSxDQUNsQkMsVUFEYyxDQUNILFNBREcsRUFDUTtBQUNyQkgsSUFBQUEsUUFBUSxFQUFFLGtCQURXO0FBRXJCSSxJQUFBQSxJQUFJLEVBQUU7QUFGZSxHQURSLEVBS2RDLFlBTGMsQ0FLRCxTQUxDLENBSGU7QUFTaENDLEVBQUFBLE9BQU8sRUFBRSxPQUFPO0FBQUVDLElBQUFBO0FBQUYsR0FBUCxLQUF1QjtBQUM5QixVQUFNQyxJQUFJLEdBQUdDLGNBQUtDLE9BQUwsQ0FBYUMsU0FBYixFQUF3QixlQUF4QixDQUFiOztBQUNBLFVBQU0sa0JBQVFKLE9BQVIsRUFBMkJDLElBQTNCLENBQU47O0FBQ0EsVUFBTUksVUFBVSxHQUFHQyxnQkFBV0MsTUFBWCxDQUFrQkMsT0FBTyxDQUFDUCxJQUFELENBQXpCLENBQW5COztBQUNBLFFBQUlJLFVBQVUsQ0FBQ0ksTUFBWCxFQUFKLEVBQXlCO0FBQ3ZCLFlBQU0sSUFBSUMsS0FBSixDQUFXLHFCQUFvQlYsT0FBUTtRQUMzQ1csMkJBQWFDLE1BQWIsQ0FBb0JQLFVBQXBCLENBQWdDLEVBRDVCLENBQU47QUFFRDtBQUNGO0FBakIrQixDQUFsQztlQW9CZWQsVSIsInNvdXJjZXNDb250ZW50IjpbIi8qXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IChjKSAyMDE5LiBOYXRhLUluZm9cbiAqIEBhdXRob3IgQW5kcmVpIFNhcmFrZWV2IDxhdnNAbmF0YS1pbmZvLnJ1PlxuICpcbiAqIFRoaXMgZmlsZSBpcyBwYXJ0IG9mIHRoZSBcIkBuYXRhXCIgcHJvamVjdC5cbiAqIEZvciB0aGUgZnVsbCBjb3B5cmlnaHQgYW5kIGxpY2Vuc2UgaW5mb3JtYXRpb24sIHBsZWFzZSB2aWV3XG4gKiB0aGUgRVVMQSBmaWxlIHRoYXQgd2FzIGRpc3RyaWJ1dGVkIHdpdGggdGhpcyBzb3VyY2UgY29kZS5cbiAqL1xuXG5pbXBvcnQgeyBQYXRoUmVwb3J0ZXIgfSBmcm9tICdpby10cy9saWIvUGF0aFJlcG9ydGVyJztcbmltcG9ydCB7IENvbW1hbmRNb2R1bGUgfSBmcm9tICd5YXJncyc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IGNvbnZlcnQsIE1pYkRldmljZVYgfSBmcm9tICdAbmF0YS9uaWJ1cy5qcy1jbGllbnQvbGliL21pYic7XG5cbmNvbnN0IG1pYkNvbW1hbmQ6IENvbW1hbmRNb2R1bGUgPSB7XG4gIGNvbW1hbmQ6ICdtaWIgPG1pYmZpbGU+JyxcbiAgZGVzY3JpYmU6ICfQtNC+0LHQsNCy0LjRgtGMIG1pYi3RhNCw0LnQuycsXG4gIGJ1aWxkZXI6IGFyZ3YgPT4gYXJndlxuICAgIC5wb3NpdGlvbmFsKCdtaWJmaWxlJywge1xuICAgICAgZGVzY3JpYmU6ICfQv9GD0YLRjCDQuiBtaWIt0YTQsNC50LvRgycsXG4gICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICB9KVxuICAgIC5kZW1hbmRPcHRpb24oJ21pYmZpbGUnKSxcbiAgaGFuZGxlcjogYXN5bmMgKHsgbWliZmlsZSB9KSA9PiB7XG4gICAgY29uc3QgZGVzdCA9IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuLi8uLi8uLi9taWJzJyk7XG4gICAgYXdhaXQgY29udmVydChtaWJmaWxlIGFzIHN0cmluZywgZGVzdCk7XG4gICAgY29uc3QgdmFsaWRhdGlvbiA9IE1pYkRldmljZVYuZGVjb2RlKHJlcXVpcmUoZGVzdCkpO1xuICAgIGlmICh2YWxpZGF0aW9uLmlzTGVmdCgpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgbWliIGZpbGU6ICR7bWliZmlsZX1cbiAgICAgICR7UGF0aFJlcG9ydGVyLnJlcG9ydCh2YWxpZGF0aW9uKX1gKTtcbiAgICB9XG4gIH0sXG59O1xuXG5leHBvcnQgZGVmYXVsdCBtaWJDb21tYW5kO1xuIl19