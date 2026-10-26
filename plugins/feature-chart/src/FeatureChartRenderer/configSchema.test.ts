import { readConfObject } from '@jbrowse/core/configuration'
import { getSubType } from '@jbrowse/core/util/mst-reflection'

import FeatureChartRendererSchema from './configSchema.ts'
import { listColorSchemeNames } from '../FeatureChartDrawer/colorSchemes.ts'
import {
  initBuiltInDrawers,
  listFeatureChartDrawerNames,
} from '../FeatureChartDrawer/drawerRegistry.ts'
import FeatureChartPlotlyRendererSchema from '../FeatureChartPlotlyRenderer/configSchema.ts'
import { resolveFeatureChartRenderSettings } from '../renderSettings.ts'

/**
 * Read a slot's `defaultValue` straight from the schema definition, i.e. the
 * value JBrowse uses when a config omits the slot. This needs no session.
 */
function slotDefault(schema: any, slot: string): unknown {
  const definition = schema.jbrowseSchemaDefinition?.[slot]
  if (!definition || !('defaultValue' in definition)) {
    throw new Error(`no config slot "${slot}" in schema`)
  }
  return definition.defaultValue
}

function slotNames(schema: any): string[] {
  return Object.keys(schema.jbrowseSchemaDefinition ?? {})
}

/** Instantiate the schema's default config to prove the effective value. */
function defaultConfig(schema: any) {
  return getSubType(schema).create({})
}

const RENDERER_SCHEMAS = {
  FeatureChartRenderer: FeatureChartRendererSchema,
  FeatureChartPlotlyRenderer: FeatureChartPlotlyRendererSchema,
}

describe('feature chart renderer defaults', () => {
  beforeEach(() => {
    initBuiltInDrawers()
  })

  test('FeatureChartRenderer defaults to a built-in drawer', () => {
    const drawer = slotDefault(FeatureChartRendererSchema, 'drawer')

    // Regression gate: the schema used to default to "tissueBoxPlot", a drawer
    // that was never registered, so every chart without an explicit `drawer`
    // rendered nothing.
    expect(drawer).toBe('precomputedBoxPlot')
    expect(listFeatureChartDrawerNames()).toContain(drawer)

    // and the effective value of an untouched config agrees
    expect(
      readConfObject(defaultConfig(FeatureChartRendererSchema), 'drawer'),
    ).toBe('precomputedBoxPlot')
  })

  test('every renderer drawer default exists in the built-in catalog', () => {
    const renderersWithDrawerSlot = Object.entries(RENDERER_SCHEMAS).filter(
      ([, schema]) => slotNames(schema).includes('drawer'),
    )

    // FeatureChartPlotlyRenderer selects its chart with `plotType`, so it is
    // allowed to have no drawer slot; if one is ever added it must be valid.
    expect(renderersWithDrawerSlot.map(([name]) => name)).toEqual([
      'FeatureChartRenderer',
    ])

    for (const [, schema] of renderersWithDrawerSlot) {
      expect(listFeatureChartDrawerNames()).toContain(
        slotDefault(schema, 'drawer'),
      )
    }
  })

  test('the frozen drawerOptions slot is present on both renderers', () => {
    for (const schema of Object.values(RENDERER_SCHEMAS)) {
      const definition = (schema as any).jbrowseSchemaDefinition
      expect(slotNames(schema)).toContain('drawerOptions')
      expect(definition.drawerOptions.type).toBe('frozen')
      expect(slotDefault(schema, 'drawerOptions')).toEqual({})
      // the effective value of an untouched config agrees
      expect(readConfObject(defaultConfig(schema), 'drawerOptions')).toEqual({})
    }
  })

  test('a real config model round-trips drawerOptions into the render settings', () => {
    // This is the `readConf` frozen path the renderer actually takes: an MST
    // config model, not a plain snapshot.
    const model = getSubType(FeatureChartRendererSchema).create({
      drawer: 'samplePlugin/heatmap',
      drawerOptions: { colorRamp: 'warm', cellGap: 2 },
    })

    expect(readConfObject(model, 'drawerOptions')).toEqual({
      colorRamp: 'warm',
      cellGap: 2,
    })
    expect(resolveFeatureChartRenderSettings(model)).toMatchObject({
      drawer: 'samplePlugin/heatmap',
      drawerOptions: { colorRamp: 'warm', cellGap: 2 },
    })
  })

  test('every renderer colorScheme default exists in the palette catalog', () => {
    const paletteNames = listColorSchemeNames()
    const renderersWithColorScheme = Object.entries(RENDERER_SCHEMAS).filter(
      ([, schema]) => slotNames(schema).includes('colorScheme'),
    )

    expect(renderersWithColorScheme).toHaveLength(2)

    for (const [, schema] of renderersWithColorScheme) {
      expect(paletteNames).toContain(slotDefault(schema, 'colorScheme'))
    }
  })
})
