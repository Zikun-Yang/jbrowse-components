import {
  FEATURE_CHART_RENDER_DEFAULTS,
  resolveFeatureChartRenderSettings,
} from './renderSettings.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

function snapshot(overrides: Record<string, unknown>) {
  return overrides as unknown as AnyConfigurationModel
}

describe('resolveFeatureChartRenderSettings', () => {
  test('falls back to the documented defaults without a config', () => {
    expect(resolveFeatureChartRenderSettings()).toEqual(
      FEATURE_CHART_RENDER_DEFAULTS,
    )
    expect(resolveFeatureChartRenderSettings(null)).toEqual(
      FEATURE_CHART_RENDER_DEFAULTS,
    )
    expect(resolveFeatureChartRenderSettings().drawerOptions).toEqual({})
  })

  test('reads all six chart settings from the renderer config alone', () => {
    const settings = resolveFeatureChartRenderSettings(
      snapshot({
        drawer: 'rawViolinPlot',
        chartWidth: 77,
        chartHeight: 55,
        align: 'left',
        maxChartsPerView: 12,
        minChartSpacingPx: 9,
        colorScheme: 'viridis',
      }),
    )

    expect(settings).toEqual({
      drawer: 'rawViolinPlot',
      chartWidth: 77,
      chartHeight: 55,
      align: 'left',
      maxChartsPerView: 12,
      minChartSpacingPx: 9,
      colorScheme: 'viridis',
      drawerOptions: {},
      spec: {},
    })
  })

  test('reads the frozen drawerOptions slot and defaults it to an empty object', () => {
    expect(
      resolveFeatureChartRenderSettings(snapshot({})).drawerOptions,
    ).toEqual({})

    const options = { colorRamp: 'warm', cellGap: 2 }
    const settings = resolveFeatureChartRenderSettings(
      snapshot({ drawerOptions: options }),
    )
    expect(settings.drawerOptions).toEqual(options)

    // anything that is not a plain object means "no options" rather than a
    // crash or a leaked null into a drawer
    for (const bogus of [null, [1, 2], 'x', 42]) {
      expect(
        resolveFeatureChartRenderSettings(snapshot({ drawerOptions: bogus }))
          .drawerOptions,
      ).toEqual({})
    }
  })

  test('ignores render-prop leftovers and keeps config authoritative', () => {
    // Only the config object is consulted: a stale chartWidth on the render
    // props must not leak in.
    const renderProps = {
      config: snapshot({ chartWidth: 30, chartHeight: 40 }),
      chartWidth: 999,
      chartHeight: 999,
    }

    const settings = resolveFeatureChartRenderSettings(renderProps.config)
    expect(settings.chartWidth).toBe(30)
    expect(settings.chartHeight).toBe(40)
  })

  test('sanitizes malformed values back to defaults', () => {
    const settings = resolveFeatureChartRenderSettings(
      snapshot({
        drawer: '',
        chartWidth: -5,
        chartHeight: 'tall',
        align: 'diagonal',
        maxChartsPerView: -3,
        minChartSpacingPx: 'wide',
        colorScheme: 42,
      }),
    )

    expect(settings.drawer).toBe(FEATURE_CHART_RENDER_DEFAULTS.drawer)
    expect(settings.chartWidth).toBe(1)
    expect(settings.chartHeight).toBe(FEATURE_CHART_RENDER_DEFAULTS.chartHeight)
    expect(settings.align).toBe('center')
    expect(settings.maxChartsPerView).toBe(1)
    expect(settings.minChartSpacingPx).toBe(
      FEATURE_CHART_RENDER_DEFAULTS.minChartSpacingPx,
    )
    expect(settings.colorScheme).toBe('tableau10')
  })
})
