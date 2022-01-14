/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
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
  const print = (obj, level = 0) => {
    const pad = ' '.repeat(level * 4);
    if (typeof obj !== 'object' || !obj) {
      console.info(`${pad}${JSON.stringify(obj)}`);
      return;
    }
    for (const [name, value] of Object.entries(obj)) {
      if (typeof value === 'function') {
        const fstr = value.toString().trim();
        if (fstr.startsWith('function') || fstr[0] === '(') {
          console.info(`${pad}${name.trim()}: ${fstr}`);
        } else {
          console.info(`${pad}${fstr}`); // probably a method
        }
      } else if (typeof value === 'object') {
        console.info(`${pad}${name}: {`);
        print(value, level + 1);
        console.log(`${pad}}`);
      } else {
        console.info(`${pad}${name.trim()}: ${JSON.stringify(value)}`);
      }
    }
  };
  print(config);
  // console.info(
  //   inspect(config, {
  //     showHidden: false,
  //     depth: null,
  //     colors: false,
  //   })
  // );
});
