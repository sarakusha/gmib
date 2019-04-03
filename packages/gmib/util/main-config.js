/*
 * Copyright (c) 2019. OOO Nata-Info
 * @author: Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
const webpackMain = require('electron-webpack/webpack.main.config.js');
const { inspect } = require('util');

webpackMain().then(config => {
  console.log(inspect(config, {
    showHidden: false,
    depth: null,
    colors: true,
  }));
});

