const path = require('path');

const distPath = 'webpack-dist';

const HtmlWebpackPlugin = require('html-webpack-plugin');
const HtmlWebpackHarddiskPlugin = require('html-webpack-harddisk-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssnanoPlugin = require('cssnano');

const styleLoader = MiniCssExtractPlugin.loader;
const postcssLoader = {
    loader: 'postcss-loader',
    options: {
        postcssOptions: {
            plugins: [
                [
                    CssnanoPlugin()
                ],
            ],
        },
    },
};

const config = {
    entry: {
        app: './src/js/main.js',
    },
    output: {
        path: path.resolve(__dirname, distPath),
    },
    // optimization: {
    //     splitChunks: {
    //         chunks: 'all',
    //         cacheGroups: {
    //             vendors: {
    //                 test: /[\\/](node_modules|deps)[\\/]/,
    //             },
    //         },
    //     },
    // },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: ['babel-loader'],
            },
            {
                test: /\.css$/,
                use: [styleLoader, 'css-loader', postcssLoader],
            },
            {
                test: /\.s[ac]ss$/,
                use: [styleLoader, 'css-loader', postcssLoader, 'sass-loader'],
            },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/index.html',
            filename: `../${distPath}/index.html`,
            minify: {
                removeComments: true,
                collapseWhitespace: true,
            },
            alwaysWriteToDisk: true,
        }),
        new HtmlWebpackHarddiskPlugin(),
        new MiniCssExtractPlugin(),
    ],
    devServer: {
        static: `./${distPath}`,
        open: true,
    },
};

module.exports = config;
