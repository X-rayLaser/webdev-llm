const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    mode: 'development',
    watchOptions: {
      poll: true,
      ignored: /node_modules/
    },
    entry: '{{ index_path }}',
    plugins: [
      new HtmlWebpackPlugin({
        title: 'React app'
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'static',
            to: 'static'
          }
        ]
      })
    ],
    output: {
      filename: '[name].bundle.js',
      path: '{{ build_path }}/artifacts'
    },
    module: {
      rules: [
        {
          test: /\.(?:js|mjs|cjs)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', { targets: "defaults" }],
                ["@babel/preset-react"]
              ]
            }
          }
        }, {
          test: /\.css$/i,
          use: ['style-loader', 'css-loader'],
        }, {
          test: /\.(jpg|png|svg|gif)$/,
          type: 'asset/resource'
        },
      ]
    },
    resolve: {
        modules: [path.resolve(__dirname, 'node_modules'), 'node_modules']
    }
};
