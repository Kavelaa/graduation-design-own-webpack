const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const TerserJSPlugin = require("terser-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const OptimizeCSSAssetsPlugin = require("optimize-css-assets-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = function (env, argv) {
  const mode = env.production ? "production" : "development";
  const config = {
    mode,
    entry: {
      renderer: "./renderer",
      main: "./main"
    },
    output: {
      filename: "[name].js",
      chunkFilename: "[name].[chunkhash].chunk.js"
    },
    module: {
      rules: [
        {
          test: /\.m?js$/,
          exclude: /(node_modules|bower_components)/,
          use: {
            loader: "babel-loader",
            options: {
              presets: ["@babel/preset-env", "@babel/preset-react"],
              plugins: [
                [
                  "import",
                  {
                    libraryName: "antd",
                    style: "css"
                  }
                ]
              ]
            }
          }
        },
        {
          test: /\.css$/,
          use: [
            // 开发环境用内联，生产环境css单独抽出来并行加载。
            mode === "development"
              ? "style-loader"
              : MiniCssExtractPlugin.loader,
            "css-loader"
          ]
        }
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: path.join(__dirname, "public", "index.html"),
        // 只添加renderer进程的代码，主进程不需要加进去
        chunks: ["renderer"]
      }),
      new CleanWebpackPlugin()
    ],
    devServer: {
      contentBase: path.join(__dirname, "dist"),
      compress: true,
      port: 9999
    },
    target: "electron-renderer"
  };

  if (mode === "development") {
    config.devtool = false;
  } else if (mode === "production") {
    config.plugins.push(
      new MiniCssExtractPlugin({
        filename: "[name].[chunkhash].css",
        chunkFilename: "[id].[chunkhash].css"
      })
    );
    // 将package.json和默认的config.json也添加到打包的文件夹中，打包出的程序运行时需要用到
    // package.json是必须的，否则主进程根本运行不起来。config.json是renderer进程需要的。
    config.plugins.push(
      new CopyPlugin([
        "./package.json",
        "temp.xml",
        { from: "./defaultConfig.json", to: "config.json" }
      ])
    );
    config.optimization = {
      minimizer: [new TerserJSPlugin({}), new OptimizeCSSAssetsPlugin({})]
    };
  }

  return config;
};
