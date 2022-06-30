const path = require('path');
const name = require('./package.json').name;
const HtmlWebPackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  entry: {
    app: './src/index.js'
  },
  name:name,
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader'
        }
      },
      {
        test: /\.less$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
          },
          {
            loader: 'css-loader',
            options: {
              sourceMap: true,
              url: false
            }
          },
          {
            loader: 'less-loader'
          }
        ]
      },
      {
        test: /\.css$/,
        include: /node_modules\//,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
      {
        test: /\.(png|jp(e*)g|svg|gif)$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              emitFile: false,
              name:'[path][name].[ext]'
            }
          }
        ]
      }
    ]
  },
  output: {
    filename: 'js/' + name + '.min.js',
    path: path.resolve(__dirname, 'public'),
    clean: true
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'css/' + name + '.min.css'
    }),
    new HtmlWebPackPlugin({
      title: name,
      template: "./src/html/index.html",
      filename: "./index.html"
    }),
  ]
};