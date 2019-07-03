/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
const configPath = `electron-webpack/webpack.${process.argv[2]}.config.js`;
const webpackMain = require(configPath);
const { inspect } = require('util');

webpackMain().then(config => {
  console.log(configPath);
  console.log(inspect(config, {
    showHidden: false,
    depth: null,
    colors: false,
  }));
});

