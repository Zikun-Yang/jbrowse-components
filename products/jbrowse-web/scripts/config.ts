import path from 'path'
import { fileURLToPath } from 'url'

import type { Configuration } from 'webpack'
import webpack from 'webpack'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default function webpackConfig(config: Configuration) {
  config.plugins!.push(
    new webpack.DefinePlugin({
      'process.env.ENABLE_TYPE_CHECK': '"true"',
    }),
  )

  config.output!.publicPath = 'auto'

  // Allow serving dotfiles (e.g. .zgroup, .zarray for Zarr datasets)
  config.devServer = {
    ...(config.devServer || {}),
    static: [
      {
        directory: path.join(__dirname, '../public'),
        publicPath: '/',
        staticOptions: {
          dotfiles: 'allow',
        },
      },
    ],
  }
  return config
}
