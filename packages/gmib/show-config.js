/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
// const fs = require('fs');
const { inspect } = require('util');

const configPath = `electron-webpack/webpack.${process.argv[2]}.config.js`;
// eslint-disable-next-line import/no-dynamic-require
const webpackMain = require(configPath); // JSON.parse(fs.readFileSync(configPath).toString());

webpackMain().then(config => {
  console.info(configPath);
  console.info(inspect(config, {
    showHidden: false,
    depth: null,
    colors: false,
  }));
});
