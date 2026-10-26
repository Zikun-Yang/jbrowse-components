import fs from 'node:fs'
import path from 'node:path'

/**
 * Drift guard: every product must register the plugin, otherwise the track
 * type exists in the codebase but users cannot select it (the original bug this
 * work package fixed). Worker rendering reuses the same `corePlugins` module,
 * so checking the product entry point covers the RPC worker too.
 */
const PRODUCTS = ['jbrowse-web', 'jbrowse-desktop', 'jbrowse-react-app']

const repoRoot = path.resolve(__dirname, '../../..')

function readProductFile(product: string, file: string) {
  return fs.readFileSync(path.join(repoRoot, 'products', product, file), 'utf8')
}

describe('FeatureChartPlugin registration in products', () => {
  test.each(PRODUCTS)('%s declares the workspace dependency', product => {
    const pkg = JSON.parse(readProductFile(product, 'package.json')) as {
      dependencies?: Record<string, string>
    }

    expect(pkg.dependencies?.['@jbrowse/plugin-feature-chart']).toBe(
      'workspace:^',
    )
  })

  test.each(PRODUCTS)('%s imports and registers the plugin', product => {
    const source = readProductFile(product, 'src/corePlugins.ts')

    expect(source).toMatch(
      /import FeatureChartPlugin from '@jbrowse\/plugin-feature-chart'/,
    )
    expect(source).toMatch(/^\s*FeatureChartPlugin,\s*$/m)
  })
})
