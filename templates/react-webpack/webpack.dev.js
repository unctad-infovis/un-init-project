const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const CopyPlugin = require('copy-webpack-plugin');
const ESLintPlugin = require('eslint-webpack-plugin');

module.exports = merge(common, {
  devtool: 'inline-source-map',
  devServer: {
    hot: true,
    static: './'
  },
  entry: {
    app: './src/index.js'
  },
  mode: 'development',
  plugins: [
    new ESLintPlugin({
      extensions: ['js', 'jsx'],
      fix: true
    }),
    new CopyPlugin({
      patterns: [
        { from: 'src/font/', to: './font', noErrorOnMissing: true}
      ]
    })
  ]
});