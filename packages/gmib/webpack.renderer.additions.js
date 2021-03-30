/* eslint-disable import/no-extraneous-dependencies */
/*
 * Copyright (c) 2019. OOO Nata-Info
 * @author: Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
// const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
// const path = require('path');

// const { ANALYZE } = process.env;
const isProduction = process.env.NODE_ENV === 'production';

/*
const myConfig = {
  externals: [
    (function () {
      const IGNORES = ['electron'];
      return function (context, request, callback) {
        if (IGNORES.indexOf(request) >= 0) {
          return callback(null, `require('${request}')`);
        }
        return callback();
      };
    })(),
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
  // resolve: {
  //   alias: {
  // 'react-dom': '@hot-loader/react-dom',
  // },
  // }
};
*/

// module.exports = myConfig;
// module.exports = {};

module.exports = config => {
  const babel = config.module.rules.find(rule => rule.use.loader === 'babel-loader');
  const babelOptions = babel.use.options;
  if (!isProduction) {
    babelOptions.plugins.push(require.resolve('react-refresh/babel'));
    // Несовместим с React DevTools в main
    config.plugins.push(new ReactRefreshWebpackPlugin());
  }
  /*
    [
      require.resolve('transform-imports'),
      {
        '@material-ui/core': {
          // Use "transform: '@material-ui/core/${member}'," if your bundler does not support ES modules
          transform: '@material-ui/core/${member}',
          preventFullImport: true,
        },
        '@material-ui/icons': {
          // Use "transform: '@material-ui/icons/${member}'," if your bundler does not support ES modules
          transform: '@material-ui/icons/${member}',
          preventFullImport: true,
        },
      },
    ]
*/
  // Не работает. Хрень какая-то
  /*
  babelOptions.plugins.push(
    [
      require.resolve('import-plugin-babel'),
      {
        libraryName: '@material-ui/core',
        libraryDirectory: '',
        camel2DashComponentName: false,
      },
      'core',
    ],
    [
      require.resolve('import-plugin-babel'),
      {
        libraryName: '@material-ui/icons',
        // Use "'libraryDirectory': ''," if your bundler does not support ES modules
        libraryDirectory: '',
        camel2DashComponentName: false,
      },
      'icons',
    ]
  );
*/
  // Нужно для iconv-lite
  /*
  config.module.rules.push({
    test: /node_modules[/\\](iconv-lite)[/\\].+/,
    resolve: {
      aliasFields: ['main'],
    },
  });
*/
  config.module.rules.push({
    test: /\.mdx?$/,
    use: ['babel-loader', '@mdx-js/loader'],
  });
  // !!! Помогает избежать дублирования react electron-ом и webpack-ом
  config.externals = [...config.externals, 'react', 'react-dom'];
  // config.resolve.alias.debug = path.join(require.resolve('debug'), 'src', 'node');
  // if (ANALYZE) {
  //   config.plugins.push(
  //     new BundleAnalyzerPlugin({
  //       analyzerMode: 'server',
  //       analyzerPort: 8888,
  //       openAnalyzer: true,
  //     })
  //   );
  // }

  return config;
};
