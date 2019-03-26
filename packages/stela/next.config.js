const withTypescript = require('@zeit/next-typescript');
const withCSS = require('@zeit/next-css');
const { ContextReplacementPlugin } = require('webpack');
const path = require('path');
// const keysTransformer = require('ts-transformer-keys/transformer').default;

const { ANALYZE } = process.env;
module.exports = withCSS(withTypescript({
  webpack: function (config, { isServer }) {
    // config.optimization.minimize = false;
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
        rule.exclude = [/\/node_modules\/(?!@nata\/stela\/)/];
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
