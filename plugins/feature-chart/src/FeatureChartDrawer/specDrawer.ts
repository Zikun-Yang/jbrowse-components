import { formatChartSpecError } from './chartSpec.ts'
import { resolveColorScheme } from './colorSchemes.ts'
import { paintChartModel } from './painters.ts'
import { drawPlaceholderPanel } from './placeholder.ts'

import type { ChartSpecError } from './chartSpec.ts'
import type { FeatureChartColorScheme } from './colorSchemes.ts'
import type { DrawerFunction, DrawerProps } from './types.ts'

/**
 * The built-in `spec` drawer: paints the normalized `ChartModel` the renderer
 * produced from `renderer.spec`, or a placeholder explaining why there is none.
 *
 * The renderer does the validation (`normalizeFromSpec`) rather than this
 * function, because structural spec errors apply to the whole track and are
 * reported in the RPC result the same way unknown-drawer errors are. This drawer
 * therefore only paints what it is handed.
 */
export const specDrawer: DrawerFunction = function (props: DrawerProps) {
  if (!props.model) {
    drawChartSpecPlaceholder(props)
    return
  }
  paintChartModel(props, props.model)
}

export function drawChartSpecPlaceholder(props: DrawerProps) {
  const { ctx, width, height } = props
  const colorScheme: FeatureChartColorScheme =
    props.colorScheme ?? resolveColorScheme(props.theme as never)
  const errors: ChartSpecError[] = props.modelErrors ?? []
  const [first, ...rest] = errors
  drawPlaceholderPanel(
    ctx,
    width,
    height,
    {
      title: 'Invalid chart spec',
      body: [
        first ? formatChartSpecError(first) : 'no chart model',
        ...(rest.length > 0 ? [`(+${rest.length} more)`] : []),
        'See plugins/feature-chart/SPEC.md',
      ],
    },
    colorScheme,
  )
}
