const withTypescript = require('@zeit/next-typescript');
const withCSS = require('@zeit/next-css');
const { ContextReplacementPlugin } = require('webpack');
// const keysTransformer = require('ts-transformer-keys/transformer').default;

const { ANALYZE } = process.env;
module.exports = withCSS(withTypescript({
  serverRuntimeConfig: {
    bekar: {
      width: 160,
      height: 320,
      isCondensed: false,
      // backgroundColor: 'black',
      titleSize: 26,
      nameSize: 24,
      subSize: 14,
      priceSize: 24,
      title: 'Бекар',
      items: [
        {
          name: 'А98',
          price: 48,
          subName: 'Ultra',
        },
        {
          name: 'А95',
          price: 45.5,
        },
        {
          name: 'А92',
          price: 41.6,
        },
        {
          name: 'ДТ',
          price: 38.4,
        },
      ],
    },
    magistral: {
      width: 240,
      height: 720,
      title: 'МАГИСТРАЛЬ',
    },
  },
  webpack: function (config, { isServer }) {
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

    // A TypeScript custom transformer which enables to obtain keys of given type.
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
