import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema, getConf } from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'

import { modelFactory as LinearBasicDisplayModelFactory } from './index.ts'
import { BASIC_DISPLAY_TRACK_OVERRIDES } from './model.ts'
import {
  BaseLinearDisplayComponent,
  baseLinearDisplayConfigSchema,
} from '../BaseLinearDisplay/index.ts'
import { FEATURE_DISPLAY_TRACK_OVERRIDES } from '../LinearFeatureDisplay/model.ts'
import { stateModelFactory as LinearGenomeViewModelFactory } from '../LinearGenomeView/index.ts'

import type { LegendItem } from '../BaseLinearDisplay/components/FloatingLegend.tsx'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Instance } from '@jbrowse/mobx-state-tree'

const ALL_TRACK_OVERRIDES = [
  ...FEATURE_DISPLAY_TRACK_OVERRIDES,
  ...BASIC_DISPLAY_TRACK_OVERRIDES,
]

const GENE_FILTER = "jexl:get(feature,'type')=='gene'"

function createTestEnvironment() {
  console.warn = jest.fn()
  const pluginManager = new PluginManager()

  const linearBasicDisplayConfigSchema = ConfigurationSchema(
    'LinearBasicDisplay',
    {
      renderer: ConfigurationSchema('CanvasFeatureRenderer', {
        color1: {
          type: 'color',
          defaultValue: '#292421',
          contextVariable: ['feature'],
        },
        showLabels: { type: 'boolean', defaultValue: true },
        showDescriptions: { type: 'boolean', defaultValue: true },
        labelPlacement: { type: 'string', defaultValue: 'left' },
        subfeatureLabels: { type: 'string', defaultValue: 'none' },
        geneGlyphMode: { type: 'string', defaultValue: 'all' },
        displayDirectionalChevrons: { type: 'boolean', defaultValue: true },
        displayMode: { type: 'string', defaultValue: 'normal' },
        maxHeight: { type: 'integer', defaultValue: 5000 },
        colorScheme: { type: 'string', defaultValue: 'default' },
        scorePalette: { type: 'string', defaultValue: 'viridis' },
        scoreScale: { type: 'string', defaultValue: 'linear' },
        scoreAutoRange: { type: 'boolean', defaultValue: true },
        scoreMin: { type: 'number', defaultValue: 0 },
        scoreMax: { type: 'number', defaultValue: 1000 },
        typePalette: { type: 'string', defaultValue: 'polychrome36' },
      }),
    },
    {
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )

  pluginManager.addTrackType(() => {
    const configSchema = ConfigurationSchema(
      'FeatureTrack',
      {},
      {
        baseConfiguration: createBaseTrackConfig(pluginManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: 'FeatureTrack',
      configSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'FeatureTrack',
        configSchema,
      ),
    })
  })

  pluginManager.addDisplayType(
    () =>
      new DisplayType({
        name: 'LinearBasicDisplay',
        configSchema: linearBasicDisplayConfigSchema,
        stateModel: LinearBasicDisplayModelFactory(
          linearBasicDisplayConfigSchema,
        ),
        trackType: 'FeatureTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: BaseLinearDisplayComponent,
      }),
  )

  pluginManager.createPluggableElements()
  pluginManager.configure()

  const LinearGenomeModel = LinearGenomeViewModelFactory(pluginManager)

  const Session = types
    .model({
      name: 'testSession',
      view: types.maybe(LinearGenomeModel),
      configuration: types.map(types.frozen()),
    })
    .volatile(() => ({
      rpcManager: { call: jest.fn() },
      assemblyManager: {
        get: () => ({
          regions: [
            { refName: 'ctgA', start: 0, end: 50000, assemblyName: 'volvox' },
          ],
          getCanonicalRefName: (refName: string) => refName,
        }),
        waitForAssembly: () =>
          Promise.resolve({
            regions: [
              { refName: 'ctgA', start: 0, end: 50000, assemblyName: 'volvox' },
            ],
            getCanonicalRefName: (refName: string) => refName,
          }),
        isValidRefName: () => true,
      },
    }))
    .actions(self => ({
      setView(view: Instance<typeof LinearGenomeModel>) {
        self.view = view
        return view
      },
      notifyError() {},
      queueDialog() {},
      setSelection() {},
      clearSelection() {},
    }))

  return { Session, LinearGenomeModel, pluginManager }
}

function createDisplay() {
  const { Session, LinearGenomeModel, pluginManager } = createTestEnvironment()
  const session = Session.create({ configuration: {} }, { pluginManager })
  const view = session.setView(
    LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: [
        {
          type: 'FeatureTrack',
          trackId: 'test_track',
          displays: [{ type: 'LinearBasicDisplay' }],
        },
      ],
    }),
  )
  view.setWidth(800)
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgA' },
  ])
  const track = view.tracks[0]!
  const display = track.displays[0]!
  return { display, view, session }
}

function findMenuItem(items: MenuItem[], label: string) {
  return items.find(item => 'label' in item && item.label === label)
}

function findSubMenuItem(items: MenuItem[], label: string) {
  const item = findMenuItem(items, label)
  return item && 'subMenu' in item ? item : undefined
}

function findClickableMenuItem(items: MenuItem[], label: string) {
  const item = findMenuItem(items, label)
  return item && 'onClick' in item ? item : undefined
}

function subMenuLabels(item: MenuItem | undefined) {
  return item && 'subMenu' in item
    ? item.subMenu.map(i => ('label' in i ? i.label : undefined))
    : []
}

describe('LinearBasicDisplay', () => {
  test('reads defaults from the renderer config', () => {
    const { display } = createDisplay()
    expect(display.labelPlacement).toBe('left')
    expect(display.geneGlyphMode).toBe('all')
    expect(display.subfeatureLabels).toBe('none')
    expect(display.displayDirectionalChevrons).toBe(true)
    expect(getConf(display, ['renderer', 'color1'])).toBe('#292421')
  })

  test('track overrides take precedence over the config', () => {
    const { display } = createDisplay()
    display.configuration.renderer.labelPlacement.set('below')
    display.configuration.renderer.geneGlyphMode.set('longest')

    expect(display.labelPlacement).toBe('below')
    expect(display.geneGlyphMode).toBe('longest')

    display.setLabelPlacement('left')
    display.setGeneGlyphMode('all')

    expect(display.labelPlacement).toBe('left')
    expect(display.geneGlyphMode).toBe('all')
    expect(display.rendererConfig.labelPlacement).toBe('left')
    expect(display.rendererConfig.geneGlyphMode).toBe('all')
  })

  test('actions update the getters and rendererConfig', () => {
    const { display } = createDisplay()
    display.setSubfeatureLabels('overlay')
    display.toggleDisplayDirectionalChevrons()

    expect(display.subfeatureLabels).toBe('overlay')
    expect(display.rendererConfig.subfeatureLabels).toBe('overlay')
    expect(display.displayDirectionalChevrons).toBe(false)
    expect(display.rendererConfig.displayDirectionalChevrons).toBe(false)
  })

  test('adds the gene/feature style options to the Show... menu', () => {
    const { display } = createDisplay()
    const showMenu = findSubMenuItem(display.trackMenuItems(), 'Show...')
    const labels = subMenuLabels(showMenu)

    expect(labels).toEqual(
      expect.arrayContaining([
        'Show tooltips',
        'Show labels',
        'Show descriptions',
        'Show chevrons',
        'Subfeature labels',
        'Label placement',
        'Gene glyph',
      ]),
    )
  })

  test('the Label placement menu items change the placement setting', () => {
    const { display } = createDisplay()
    const showMenu = findSubMenuItem(display.trackMenuItems(), 'Show...')
    const placement = findSubMenuItem(
      showMenu?.subMenu ?? [],
      'Label placement',
    )

    const below = findClickableMenuItem(
      placement?.subMenu ?? [],
      'Below feature',
    )
    below?.onClick()

    expect(display.labelPlacement).toBe('below')
    expect(display.rendererConfig.labelPlacement).toBe('below')
  })

  test('the chevrons checkbox reflects and toggles the setting', () => {
    const { display } = createDisplay()
    const getChevrons = () =>
      findClickableMenuItem(
        findSubMenuItem(display.trackMenuItems(), 'Show...')?.subMenu ?? [],
        'Show chevrons',
      )

    expect(getChevrons()).toMatchObject({ type: 'checkbox', checked: true })
    getChevrons()?.onClick()
    expect(display.displayDirectionalChevrons).toBe(false)
    expect(getChevrons()).toMatchObject({ checked: false })
  })

  test('the "Show only genes" filter toggles the gene jexl filter', () => {
    const { display } = createDisplay()
    const getGenesItem = () =>
      findClickableMenuItem(
        findSubMenuItem(display.trackMenuItems(), 'Filter by...')?.subMenu ??
          [],
        'Show only genes',
      )

    expect(getGenesItem()).toMatchObject({ checked: false })
    getGenesItem()?.onClick()
    expect(display.activeFilters()).toEqual([GENE_FILTER])
    expect(getGenesItem()).toMatchObject({ checked: true })

    getGenesItem()?.onClick()
    expect(display.activeFilters()).toEqual([])
    expect(getGenesItem()).toMatchObject({ checked: false })
  })

  test('persists track overrides in the snapshot and omits unset ones', () => {
    const { display } = createDisplay()
    display.setLabelPlacement('below')
    display.setGeneGlyphMode('longestCoding')
    display.setSubfeatureLabels('overlay')
    display.toggleDisplayDirectionalChevrons()

    const snap = getSnapshot(display)
    expect(snap).toMatchObject({
      trackLabelPlacement: 'below',
      trackGeneGlyphMode: 'longestCoding',
      trackSubfeatureLabels: 'overlay',
      trackDisplayDirectionalChevrons: false,
    })

    const { display: fresh } = createDisplay()
    const freshSnap = getSnapshot(fresh)
    expect(freshSnap).not.toHaveProperty('trackLabelPlacement')
    expect(freshSnap).not.toHaveProperty('trackGeneGlyphMode')
  })

  test('does not expose the removed feature context menu API', () => {
    // the fork removed the right-click feature menu on purpose: right-click on
    // a track opens the track menu in TrackContainer instead
    const { display } = createDisplay()
    const props = display.renderingProps()
    expect('onFeatureContextMenu' in props).toBe(false)
    expect('contextMenuItems' in display).toBe(false)
    expect(props.onFeatureClick).toBeDefined()
  })

  test('every declared track override is wired end to end', () => {
    // one table drives getters, rendererConfig, actions and snapshot
    // persistence; this loops over it so a new setting cannot add only part
    // of the plumbing
    const { display } = createDisplay()
    const d = display

    for (const spec of ALL_TRACK_OVERRIDES) {
      const { trackProp, getter, slot, action, kind } = spec
      const initial = d[getter]
      expect(d[trackProp]).toBeUndefined()

      if (kind === 'toggle') {
        d[action]()
        expect(d[getter]).toBe(!initial)
      } else {
        const value = typeof initial === 'number' ? 1234 : 'test-value'
        d[action](value)
        expect(d[getter]).toBe(value)
      }

      expect(d.rendererConfig[slot]).toBe(d[getter])
      expect(getSnapshot(display)).toHaveProperty(trackProp)
    }
  })

  test('unset track overrides are pruned from the snapshot', () => {
    const { display } = createDisplay()
    const snap = getSnapshot(display)
    for (const spec of ALL_TRACK_OVERRIDES) {
      expect(snap).not.toHaveProperty(spec.trackProp)
    }
  })

  test('the Show... menu is composed from the featureStyleMenuItems() hook', () => {
    const { display } = createDisplay()
    const hookLabels = display
      .featureStyleMenuItems()
      .map((item: MenuItem) => ('label' in item ? item.label : undefined))
    const shownLabels = subMenuLabels(
      findSubMenuItem(display.trackMenuItems(), 'Show...'),
    )

    expect(hookLabels.length).toBeGreaterThan(0)
    for (const label of hookLabels) {
      expect(shownLabels).toContain(label)
    }
  })

  test('the Color by... menu offers the native color schemes', () => {
    const { display } = createDisplay()
    const colorMenu = findSubMenuItem(display.trackMenuItems(), 'Color by...')

    expect(subMenuLabels(colorMenu)).toEqual(
      expect.arrayContaining([
        'Track colors',
        'Feature color',
        'Score',
        'Strand',
        'Feature type',
      ]),
    )
    expect(
      findClickableMenuItem(colorMenu?.subMenu ?? [], 'Track colors'),
    ).toMatchObject({ type: 'radio', checked: true })
  })

  test('picking a color scheme updates the display and the renderer config', () => {
    const { display } = createDisplay()
    const getColorMenu = () =>
      findSubMenuItem(display.trackMenuItems(), 'Color by...')

    findClickableMenuItem(getColorMenu()?.subMenu ?? [], 'Score')?.onClick()

    expect(display.colorScheme).toBe('score')
    expect(display.rendererConfig.colorScheme).toBe('score')
    expect(
      findClickableMenuItem(getColorMenu()?.subMenu ?? [], 'Score'),
    ).toMatchObject({ checked: true })
  })

  test('the palette entry only appears for the scheme that uses it', () => {
    const { display } = createDisplay()
    const getColorMenu = () =>
      findSubMenuItem(display.trackMenuItems(), 'Color by...')

    // default colors come from color1/2/3, so no palette is offered
    expect(subMenuLabels(getColorMenu())).not.toContain('Palette')

    findClickableMenuItem(getColorMenu()?.subMenu ?? [], 'Score')?.onClick()
    const scorePalettes = subMenuLabels(
      findSubMenuItem(getColorMenu()?.subMenu ?? [], 'Palette'),
    )
    expect(scorePalettes).toEqual(expect.arrayContaining(['viridis', 'plasma']))

    findClickableMenuItem(
      getColorMenu()?.subMenu ?? [],
      'Feature type',
    )?.onClick()
    const typePalettes = subMenuLabels(
      findSubMenuItem(getColorMenu()?.subMenu ?? [], 'Palette'),
    )
    expect(typePalettes).toEqual(
      expect.arrayContaining(['polychrome36', 'tab10']),
    )
  })

  test('palette choices are stored as track overrides', () => {
    const { display } = createDisplay()
    const getColorMenu = () =>
      findSubMenuItem(display.trackMenuItems(), 'Color by...')

    findClickableMenuItem(getColorMenu()?.subMenu ?? [], 'Score')?.onClick()
    const paletteMenu = findSubMenuItem(
      getColorMenu()?.subMenu ?? [],
      'Palette',
    )
    findClickableMenuItem(paletteMenu?.subMenu ?? [], 'plasma')?.onClick()

    expect(display.scorePalette).toBe('plasma')
    expect(display.rendererConfig.scorePalette).toBe('plasma')
    expect(getSnapshot(display)).toMatchObject({
      trackColorScheme: 'score',
      trackScorePalette: 'plasma',
    })
  })

  test('Show legend is only offered for schemes that have one', () => {
    const { display } = createDisplay()
    const getColorMenu = () =>
      findSubMenuItem(display.trackMenuItems(), 'Color by...')

    expect(subMenuLabels(getColorMenu())).not.toContain('Show legend')

    findClickableMenuItem(getColorMenu()?.subMenu ?? [], 'Strand')?.onClick()
    expect(subMenuLabels(getColorMenu())).not.toContain('Show legend')

    findClickableMenuItem(getColorMenu()?.subMenu ?? [], 'Score')?.onClick()
    const legend = findClickableMenuItem(
      getColorMenu()?.subMenu ?? [],
      'Show legend',
    )
    expect(legend).toMatchObject({ type: 'checkbox', checked: false })

    legend?.onClick()
    expect(display.showLegend).toBe(true)
    expect(
      findClickableMenuItem(getColorMenu()?.subMenu ?? [], 'Show legend'),
    ).toMatchObject({ checked: true })
  })

  test('the legend follows the fixed score range from the config', () => {
    const { display } = createDisplay()
    display.configuration.renderer.scoreAutoRange.set(false)
    display.configuration.renderer.scoreMin.set(0)
    display.configuration.renderer.scoreMax.set(100)
    display.setColorScheme('score')

    expect(display.legendItems().map((item: LegendItem) => item.label)).toEqual(
      ['0', '25', '50', '75', '100'],
    )
  })

  test('the legend has no rows for the default color scheme', () => {
    const { display } = createDisplay()
    expect(display.colorScheme).toBe('default')
    expect(display.legendItems()).toEqual([])
  })
})
