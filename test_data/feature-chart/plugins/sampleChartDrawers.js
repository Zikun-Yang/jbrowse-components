/**
 * Example no-build JBrowse plugin: two canvas drawers for FeatureChartTrack.
 *
 * No imports, no bundler: this file is loaded as a native ES module from
 * `config.plugins[].esmLoc.uri`, in the browser *and* in the RPC worker. Read
 * `website/docs/developer_guides/feature_chart_drawers.md` for the contract.
 *
 * Data contract: the demo TSV rows carry
 * `data.tissues = { <tissue>: [values...] }`, so both drawers accept the
 * `tissues` data shape.
 */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const num = (value, fallback) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

/** `#rrggbb` interpolation: ramp endpoints stay plain hex, like the built-ins. */
function mix(from, to, t) {
  const channel = index => {
    const a = parseInt(from.slice(1 + index * 2, 3 + index * 2), 16)
    const b = parseInt(to.slice(1 + index * 2, 3 + index * 2), 16)
    return Math.round(a + (b - a) * clamp(t, 0, 1))
      .toString(16)
      .padStart(2, '0')
  }
  return `#${channel(0)}${channel(1)}${channel(2)}`
}

const RAMPS = {
  cool: t => mix('#e8effa', '#1d4e89', t),
  warm: t => mix('#fff6d9', '#b3300b', t),
  mono: t => mix('#eef7f5', '#0f5257', t),
}

function groupsOf(data) {
  const tissues = data && typeof data === 'object' ? data.tissues : undefined
  if (!tissues || typeof tissues !== 'object') {
    return []
  }
  return Object.keys(tissues)
    .filter(key => Array.isArray(tissues[key]))
    .map(key => ({ name: key, values: tissues[key].filter(Number.isFinite) }))
}

/** samplePlugin/heatmap: one column per group, one cell per observation. */
function drawHeatmap({ ctx, width, height, data, options }) {
  const groups = groupsOf(data)
  const all = groups.flatMap(group => group.values)
  if (groups.length === 0 || all.length === 0) {
    return
  }

  const ramp = RAMPS[options?.colorRamp] ?? RAMPS.cool
  const gap = clamp(num(options?.cellGap, 1), 0, 6)
  const ceiling = Math.max(1e-9, num(options?.maxValue, Math.max(...all)))
  const rows = Math.max(...groups.map(group => group.values.length))
  const cellWidth = (width - gap * (groups.length - 1)) / groups.length
  const cellHeight = (height - gap * (rows - 1)) / rows

  groups.forEach((group, column) => {
    group.values.forEach((value, row) => {
      ctx.fillStyle = ramp(value / ceiling)
      ctx.fillRect(
        column * (cellWidth + gap),
        height - (row + 1) * (cellHeight + gap) + gap,
        cellWidth,
        cellHeight,
      )
    })
  })
}

/** samplePlugin/dotPlot: observations as dots, one band per group. */
function drawDotPlot({ ctx, width, height, data, options, colorScheme }) {
  const groups = groupsOf(data)
  const all = groups.flatMap(group => group.values)
  if (groups.length === 0 || all.length === 0) {
    return
  }

  const colors = colorScheme?.colors ?? ['#4e79a7', '#f28e2c', '#e15759']
  const radius = clamp(num(options?.dotRadius, 1.8), 0.5, 6)
  const jitter = clamp(num(options?.jitter, 0.6), 0, 1)
  const opacity = clamp(num(options?.fillOpacity, 0.7), 0.05, 1)
  const min = Math.min(...all)
  const max = Math.max(...all)
  const pad = Math.max(radius + 1, 3)
  const band = width / groups.length
  const yOf = value =>
    height - pad - ((value - min) / (max - min || 1)) * (height - 2 * pad)

  ctx.globalAlpha = opacity
  groups.forEach((group, index) => {
    ctx.fillStyle = colors[index % colors.length]
    group.values.forEach((value, sample) => {
      // Deterministic jitter: the same sample lands in the same place on every
      // repaint, which matters inside the RPC worker.
      const offset = ((sample * 0.37 + 0.19) % 1) * 2 - 1
      const x = band * (index + 0.5) + offset * band * 0.4 * jitter
      ctx.beginPath()
      ctx.arc(x, yOf(value), radius, 0, Math.PI * 2)
      ctx.fill()
    })
  })
  ctx.globalAlpha = 1
}

export default class SampleChartDrawers {
  name = 'SampleChartDrawers'

  install(pluginManager) {
    pluginManager.addToExtensionPoint('Core-featureChartDrawer', drawers => [
      ...drawers,
      {
        name: 'samplePlugin/heatmap',
        displayName: 'Sample heatmap',
        description:
          'One column per group, one cell per observation, colored by value (data.tissues).',
        dataShape: 'tissues',
        optionsSchema: {
          colorRamp: 'cool | warm | mono',
          cellGap: 'number (px, 0-6)',
          maxValue: 'number (color ceiling)',
        },
        draw: drawHeatmap,
      },
      {
        name: 'samplePlugin/dotPlot',
        displayName: 'Sample dot plot',
        description:
          'Every observation as a dot, one band per group (data.tissues).',
        dataShape: 'tissues',
        optionsSchema: {
          dotRadius: 'number (px, 0.5-6)',
          jitter: 'number (0-1)',
          fillOpacity: 'number (0.05-1)',
        },
        draw: drawDotPlot,
      },
    ])

    // Debug probe: proves in which context this plugin installed itself. The
    // integration check reads it from the page *and* from the RPC worker.
    // Note: jbrowse's worker polyfill defines `window` inside the worker, so
    // `typeof window` cannot be used to tell the contexts apart.
    globalThis.__sampleChartDrawers = {
      context:
        'WorkerGlobalScope' in globalThis ? 'worker' : 'main thread',
      drawers: ['samplePlugin/heatmap', 'samplePlugin/dotPlot'],
    }
  }

  configure() {}
}
