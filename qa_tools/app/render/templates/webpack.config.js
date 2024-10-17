const path = require('path');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
    mode: 'development',
    watchOptions: {
      poll: true,
      ignored: /node_modules/
    },
    entry: '{{ build_path }}/source/index.js',
    output: {
      filename: 'main.js',
      path: '{{ build_path }}/artifacts'
    },
    plugins: [new MiniCssExtractPlugin()],
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
          use: [MiniCssExtractPlugin.loader, "css-loader"],
        }
      ]
    },
    resolve: {
        modules: [path.resolve(__dirname, 'node_modules'), 'node_modules']
    }
};