/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

// eslint-disable-next-line import/no-extraneous-dependencies
const webpack = require('webpack');

const IGNORES = ['electron'];

module.exports = config => {
  config.plugins.push(
    new webpack.DefinePlugin({
      'process.env.DEBUG': "'nibus:*,gmib:*,novastar:*,-novastar:encoder,-novastar:decoder'",
    })
  );
  config.externals.push(
    (() => (context, request, callback) => {
      if (IGNORES.indexOf(request) >= 0) {
        return callback(null, `require('${request}')`);
      }
      return callback();
    })(),
    'worker_threads',
    'usb-detection'
  );
  return config;
  // optimization: {
  //   minimize: false
  // },
};
