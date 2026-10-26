import PluginManager from '@jbrowse/core/PluginManager'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { computeScoreStats } from './colorScheme.ts'
import configSchema from './configSchema.ts'
import { computeLegendData } from './legendData.ts'
import { createRenderConfigContext } from './renderConfig.ts'

import type { RenderConfigContext } from './renderConfig.ts'

const pluginManager = new PluginManager([])
pluginManager.configure()

function makeFeature(attributes: Record<string, unknown>) {
  return new SimpleFeature({
    id: String(attributes.name ?? Math.random()),
    data: { start: 0, end: 10, ...attributes },
  })
}

function createContext(
  features: ReturnType<typeof makeFeature>[],
  overrides: Record<string, unknown> = {},
): RenderConfigContext {
  const config = configSchema.create(overrides, { pluginManager })
  const context = createRenderConfigContext(config)
  if (context.colorScheme.kind === 'score') {
    context.scoreStats = computeScoreStats(
      features,
      context.colorScheme.scoreField,
    )
  }
  return context
}

describe('computeLegendData', () => {
  test('reports the score range the colors were mapped onto', () => {
    const features = [10, 40, 70].map(score =>
      makeFeature({ name: `f${score}`, score, type: 'gene' }),
    )
    const data = computeLegendData(
      createContext(features, { colorScheme: 'score' }),
      features,
    )

    expect(data).toEqual({ min: 10, max: 70 })
  })

  test('returns nothing for a score scheme with no numeric scores', () => {
    const features = [makeFeature({ name: 'a', type: 'gene' })]
    expect(
      computeLegendData(
        createContext(features, { colorScheme: 'score' }),
        features,
      ),
    ).toBeUndefined()
  })

  test('reports type counts for the type scheme', () => {
    const features = [
      makeFeature({ name: 'a', type: 'gene' }),
      makeFeature({ name: 'b', type: 'gene' }),
      makeFeature({ name: 'c', type: 'exon' }),
    ]
    const data = computeLegendData(
      createContext(features, { colorScheme: 'type' }),
      features,
    )

    expect(data).toEqual({
      typeCounts: [
        ['gene', 2],
        ['exon', 1],
      ],
    })
  })

  test('returns nothing for schemes without a data legend', () => {
    const features = [makeFeature({ name: 'a', score: 5, type: 'gene' })]
    for (const colorScheme of ['default', 'featureField', 'strand']) {
      expect(
        computeLegendData(createContext(features, { colorScheme }), features),
      ).toBeUndefined()
    }
  })
})
