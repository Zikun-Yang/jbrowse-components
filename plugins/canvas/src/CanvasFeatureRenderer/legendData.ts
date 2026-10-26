import type { RenderConfigContext } from './renderConfig.ts'
import type { Feature, FeatureColorLegendData } from '@jbrowse/core/util'

/**
 * Summarize what the renderer actually colored, for the display's legend.
 *
 * This runs in the worker next to the drawing code, so the display never has
 * to fetch or serialize the features again. Only schemes whose colors encode
 * data need a legend, so the other schemes return undefined.
 */
export function computeLegendData(
  configContext: RenderConfigContext,
  features: Iterable<Feature>,
): FeatureColorLegendData | undefined {
  switch (configContext.colorScheme.kind) {
    case 'score': {
      const stats = configContext.scoreStats
      return stats ? { min: stats.min, max: stats.max } : undefined
    }
    case 'type': {
      const typeCounts = new Map<string, number>()
      for (const feature of features) {
        const type = feature.get('type')
        if (typeof type === 'string' && type) {
          typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1)
        }
      }
      return typeCounts.size ? { typeCounts: [...typeCounts] } : undefined
    }
    default: {
      return undefined
    }
  }
}
