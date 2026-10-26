/**
 * Jest transformer used by the `product-core` project.
 *
 * `@jbrowse/product-core` renders `react-markdown`, which is ESM only, so the
 * node_modules of that project may need to be transformed too. This
 * transformer therefore does not inherit `babel.config.cjs` (which ignores
 * node_modules and applies the react compiler) and instead uses a minimal
 * preset list that is safe to run over third party code.
 */
module.exports = require('babel-jest').default.createTransformer({
  babelrc: false,
  configFile: false,
  presets: [
    ['@babel/preset-react', { runtime: 'automatic' }],
    ['@babel/preset-env', { targets: { node: 'current' } }],
    '@babel/preset-typescript',
  ],
})
