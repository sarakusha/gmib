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
"use strict";

require("source-map-support/register");

const path = require('path');

require('@babel/register')({
  extensions: ['.ts', '.js']
});

const main = path.resolve(__dirname, './index.ts');

require(main);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9pbmRleC1kZXYuanMiXSwibmFtZXMiOlsicGF0aCIsInJlcXVpcmUiLCJleHRlbnNpb25zIiwibWFpbiIsInJlc29sdmUiLCJfX2Rpcm5hbWUiXSwibWFwcGluZ3MiOiJBQUFBOztBQUNBOzs7Ozs7Ozs7Ozs7O0FBVUEsTUFBTUEsSUFBSSxHQUFHQyxPQUFPLENBQUMsTUFBRCxDQUFwQjs7QUFDQUEsT0FBTyxDQUFDLGlCQUFELENBQVAsQ0FBMkI7QUFDekJDLEVBQUFBLFVBQVUsRUFBRSxDQUFDLEtBQUQsRUFBUSxLQUFSO0FBRGEsQ0FBM0I7O0FBR0EsTUFBTUMsSUFBSSxHQUFHSCxJQUFJLENBQUNJLE9BQUwsQ0FBYUMsU0FBYixFQUF3QixZQUF4QixDQUFiOztBQUNBSixPQUFPLENBQUNFLElBQUQsQ0FBUCIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcbi8qXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IChjKSAyMDE5LiBOYXRhLUluZm9cbiAqIEBhdXRob3IgQW5kcmVpIFNhcmFrZWV2IDxhdnNAbmF0YS1pbmZvLnJ1PlxuICpcbiAqIFRoaXMgZmlsZSBpcyBwYXJ0IG9mIHRoZSBcIkBuYXRhXCIgcHJvamVjdC5cbiAqIEZvciB0aGUgZnVsbCBjb3B5cmlnaHQgYW5kIGxpY2Vuc2UgaW5mb3JtYXRpb24sIHBsZWFzZSB2aWV3XG4gKiB0aGUgRVVMQSBmaWxlIHRoYXQgd2FzIGRpc3RyaWJ1dGVkIHdpdGggdGhpcyBzb3VyY2UgY29kZS5cbiAqL1xuXG5jb25zdCBwYXRoID0gcmVxdWlyZSgncGF0aCcpO1xucmVxdWlyZSgnQGJhYmVsL3JlZ2lzdGVyJykoe1xuICBleHRlbnNpb25zOiBbJy50cycsICcuanMnXSxcbn0pO1xuY29uc3QgbWFpbiA9IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL2luZGV4LnRzJyk7XG5yZXF1aXJlKG1haW4pO1xuXG4iXX0=