/*
 * Copyright (c) 2019. OOO Nata-Info
 * @author: Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

const isProduction = process.env.NODE_ENV === 'production';

module.exports = isProduction ? {} : {
  module: {
    rules: [
      {
        test: /\.tsx$/,
        use:
          [
            { loader: 'react-hot-loader/webpack' },
            {
              loader: 'ts-loader',
              options:
                {
                  transpileOnly: true,
                  appendTsSuffixTo: [/\.vue$/],
                  configFile:
                    '/Users/sarakusha/WebstormProjects/@nata/packages/gmib/tsconfig.json',
                },
            }, // { loader: 'ts-loader' },
          ],
      }],
  },
};
