/*
 * Copyright (c) 2019. OOO Nata-Info
 * @author: Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

const isProduction = process.env.NODE_ENV === 'production';
const { ANALYZE } = process.env;
const path = require('path');

const config = {
  externals: [
    (function () {
      const IGNORES = [
        'electron',
      ];
      return function (context, request, callback) {
        if (IGNORES.indexOf(request) >= 0) {
          return callback(null, `require('${request}')`);
        }
        return callback();
      };
    }()),
    'worker_threads',
    'usb-detection',
  ],
  module: {
    rules: [
      // Нужно для iconv-lite
      {
        test: /node_modules[/\\](iconv-lite)[/\\].+/,
        resolve: {
          aliasFields: ['main'],
        },
      },
    ],
  },
  plugins: [],
  resolve: {
    alias: {
      'react-dom': '@hot-loader/react-dom',
    },
  },
};

if (ANALYZE) {
  const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

  config.plugins.push(new BundleAnalyzerPlugin({
    analyzerMode: 'server',
    analyzerPort: 8888,
    openAnalyzer: true,
  }));
}

module.exports = config;
// module.exports = {};
