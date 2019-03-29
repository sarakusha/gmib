const withTypescript = require('@zeit/next-typescript');
const withCSS = require('@zeit/next-css');
const { ContextReplacementPlugin } = require('webpack');
const path = require('path');
const _ = require('lodash');
// const keysTransformer = require('ts-transformer-keys/transformer').default;

const { ANALYZE } = process.env;
const exclude = [
  /[\\/]node_modules[\\/](?!@nata[\\/]stela[\\/])/,
  /@nata[\\/]stela[\\/]node_modules[\\/]/,
];
module.exports = withCSS(withTypescript({
  webpack: function (config, { isServer }) {
    config.optimization.minimize = false;
    if (ANALYZE) {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

      config.plugins.push(new BundleAnalyzerPlugin({
        analyzerMode: 'server',
        analyzerPort: isServer ? 8888 : 8889,
        openAnalyzer: true,
      }));
    }

    config.plugins.push(
      new ContextReplacementPlugin(/moment[/\\]locale$/, /ru/),
    );
    config.module.rules.forEach((rule) => {
      if (rule.use.loader === 'next-babel-loader') {
        rule.use.options.configFile = path.resolve(__dirname, 'babel.config.js');
        // console.log('EXCLUDE', rule.exclude);
        // Особый способ исключения нужен для установки в глобальное пространство
        // Обратить внимание на предыдущий exclude
        // (после компиляции не должно быть <bash>grep -r 'async function ' .next</bash>)
        if (typeof rule.exclude !== 'function') {
          rule.exclude = exclude;
        }
      }
    });

    // Не работает с ts-node (только с webpack)
    // if (isServer) {
    //   config.module.rules.push({
    //     test: /\.ts$/,
    //     loader: 'awesome-typescript-loader',
    //     options: {
    //       getCustomTransformers: program => ({
    //         before: [
    //           keysTransformer(program)
    //         ]
    //       }),
    //     },
    //   });
    // }

    // const { IgnorePlugin } = require('webpack');
    // config.plugins.push(
    //   new IgnorePlugin(/font-manager/)
    // );
    return config;
  },
}));
