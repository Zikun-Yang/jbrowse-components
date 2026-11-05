#!/usr/bin/env node
/**
 * Fork drift guard: the three products must register the plugins they ship.
 *
 * The bug this exists for: `@jbrowse/plugin-feature-chart` was wired into one
 * product, so `FeatureChartTrack` existed in the codebase but users of the other
 * products could not select it — no error, no placeholder, the track type simply
 * was not registered. A unit test covers the same facts
 * (`plugins/feature-chart/src/corePluginsRegistration.test.ts`), but it only runs
 * when the feature-chart tests run; this script is the CI entry point and also
 * checks that no product lists a plugin twice (a rebase that duplicates a line
 * still "contains" the plugin, and the duplicate registration is a real bug).
 *
 * Usage:
 *   node scripts/check-core-plugins.mjs           # exit 1 on problems
 *   node scripts/check-core-plugins.mjs --verbose # also print the per-product diff
 *
 * No dependencies on purpose: it has to run before/independently of a build.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const PRODUCTS = ['jbrowse-web', 'jbrowse-desktop', 'jbrowse-react-app']

/**
 * Plugins that must be registered everywhere. Keep this list to plugins whose
 * absence silently removes a user-visible capability; a plugin that only exists
 * in one product (jobs-management on desktop, for example) does not belong here.
 */
const REQUIRED = [
  {
    packageName: '@jbrowse/plugin-feature-chart',
    identifier: 'FeatureChartPlugin',
    why: 'FeatureChartTrack (chart tracks) would not be selectable',
  },
]

const problems = []
const notes = []

function read(product, file) {
  return fs.readFileSync(path.join(repoRoot, 'products', product, file), 'utf8')
}

/** `import X from 'pkg'` lines, and the entries of the `corePlugins` array */
function parseCorePlugins(source) {
  const imports = new Map()
  for (const match of source.matchAll(
    /^\s*import\s+([A-Za-z0-9_$]+)\s+from\s+'([^']+)'\s*$/gm,
  )) {
    imports.set(match[1], match[2])
  }
  const arrayMatch = /const corePlugins = \[([\s\S]*?)\n\]/.exec(source)
  const entries = arrayMatch
    ? arrayMatch[1]
        .split('\n')
        .map(line => line.replace(/\/\/.*$/, '').trim())
        .filter(line => /^[A-Za-z0-9_$]+,$/.test(line))
        .map(line => line.replace(/,$/, ''))
    : null
  return { imports, entries }
}

for (const product of PRODUCTS) {
  let source
  let pkg
  try {
    source = read(product, 'src/corePlugins.ts')
    pkg = JSON.parse(read(product, 'package.json'))
  } catch (error) {
    problems.push(
      `${product}: cannot read corePlugins.ts / package.json (${error.message})`,
    )
    continue
  }

  const { imports, entries } = parseCorePlugins(source)
  if (!entries) {
    problems.push(
      `${product}: could not find \`const corePlugins = [...]\` in src/corePlugins.ts`,
    )
    continue
  }

  for (const required of REQUIRED) {
    const { packageName, identifier, why } = required
    const dep =
      pkg.dependencies?.[packageName] ??
      pkg.devDependencies?.[packageName] ??
      pkg.peerDependencies?.[packageName]
    if (!dep) {
      problems.push(
        `${product}: package.json does not depend on ${packageName} (${why})`,
      )
    } else if (dep !== 'workspace:^') {
      notes.push(
        `${product}: ${packageName} is "${dep}", expected "workspace:^"`,
      )
    }
    const imported = imports.get(identifier) === packageName
    if (!imported) {
      problems.push(
        `${product}: src/corePlugins.ts does not import ${identifier} from ${packageName} (${why})`,
      )
    }
    if (!entries.includes(identifier)) {
      problems.push(
        `${product}: ${identifier} is ${imported ? 'imported but missing from' : 'missing from'} the corePlugins array (${why})`,
      )
    }
  }

  const seen = new Set()
  for (const identifier of entries) {
    if (seen.has(identifier)) {
      problems.push(
        `${product}: ${identifier} is registered twice in corePlugins`,
      )
    }
    seen.add(identifier)
    if (!imports.has(identifier)) {
      problems.push(
        `${product}: ${identifier} is in corePlugins but not imported`,
      )
    }
  }
  if (entries.length === 0) {
    problems.push(`${product}: corePlugins is empty`)
  }
}

// informational: which plugins each product registers that the others do not.
// A missing plugin here is often intentional (desktop-only jobs management),
// so this is printed, never fatal.
const sets = new Map()
for (const product of PRODUCTS) {
  try {
    sets.set(
      product,
      parseCorePlugins(read(product, 'src/corePlugins.ts')).entries,
    )
  } catch {
    // already reported above
  }
}
const verbose = process.argv.includes('--verbose')

if (problems.length > 0) {
  console.error('corePlugins consistency check FAILED\n')
  for (const problem of problems) {
    console.error(`  ✗ ${problem}`)
  }
  console.error(
    '\nFix products/*/src/corePlugins.ts (and the matching package.json dependency),',
  )
  console.error(
    'then run this script again — see FORK.md "rebase checklist" for why this drifts.',
  )
  process.exit(1)
}

console.log(
  `corePlugins consistency check passed (${PRODUCTS.length} products, ` +
    `${REQUIRED.length} required plugin${REQUIRED.length === 1 ? '' : 's'})`,
)
for (const note of notes) {
  console.log(`  note: ${note}`)
}
if (verbose) {
  for (const [product, entries] of sets) {
    const others = [...sets].filter(([name]) => name !== product)
    const unique = entries.filter(
      entry => !others.every(([, list]) => list.includes(entry)),
    )
    console.log(
      `  ${product}: ${entries.length} plugins; only here: ${unique.join(', ') || '—'}`,
    )
  }
}
