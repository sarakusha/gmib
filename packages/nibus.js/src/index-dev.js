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

const path = require('path');
require('@babel/register')({
  extensions: ['.ts', '.js'],
});
const main = path.resolve(__dirname, './index.ts');
require(main);

