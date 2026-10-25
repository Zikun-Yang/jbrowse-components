import { featureLabelHitBounds, measureText } from '@jbrowse/core/util'

import { applyLabelDimensions } from './labelUtils.ts'

import type { RenderConfigContext } from './renderConfig.ts'
import type { FeatureLayout } from './types.ts'
import type { readConfObject } from '@jbrowse/core/configuration'

jest.mock('@jbrowse/core/configuration', () => ({
  readConfObject: jest.fn(),
}))

const mockReadConfObject = jest.requireMock('@jbrowse/core/configuration')
  .readConfObject as jest.MockedFunction<typeof readConfObject>

mockReadConfObject.mockImplementation(((_config: unknown, key: string | string[]) => {
  const last = Array.isArray(key) ? key.at(-1) : key
  return last === 'name' ? 'Gene1' : 'A gene'
}) as never)

const feature = { get: () => undefined, id: () => 'f1' } as any

function createLayout(overrides: Partial<FeatureLayout> = {}): FeatureLayout {
  return {
    feature,
    glyphType: 'Box',
    x: 0,
    y: 0,
    width: 100,
    height: 10,
    totalLayoutHeight: 10,
    totalLayoutWidth: 100,
    leftPadding: 0,
    children: [],
    ...overrides,
  }
}

function createConfigContext(
  overrides: Partial<RenderConfigContext> = {},
): RenderConfigContext {
  return {
    config: {} as any,
    displayMode: 'normal',
    showLabels: true,
    showDescriptions: true,
    labelPlacement: 'left',
    subfeatureLabels: 'none',
    transcriptTypes: [],
    containerTypes: [],
    geneGlyphMode: 'all',
    displayDirectionalChevrons: true,
    color1: { isCallback: false, value: 'goldenrod' },
    color2: { isCallback: false, value: '#f0f' },
    color3: { isCallback: false, value: '#357089' },
    outline: { isCallback: false, value: '' },
    colorScheme: {
      kind: 'default',
      colorField: 'color',
      scoreField: 'score',
      scorePalette: 'viridis',
      scoreScale: 'linear',
      scoreAutoRange: true,
      scoreMin: 0,
      scoreMax: 1000,
      typePalette: 'polychrome36',
    },
    colorByCDS: false,
    featureHeight: { isCallback: false, value: 10 },
    fontHeight: { isCallback: false, value: 12 },
    nameColor: { isCallback: false, value: 'black' },
    descriptionColor: { isCallback: false, value: 'blue' },
    labelAllowed: true,
    heightMultiplier: 1,
    ...overrides,
  }
}

const labelTextWidth = Math.max(
  measureText('Gene1', 12),
  measureText('A gene', 12),
)

describe('applyLabelDimensions', () => {
  test('left placement reserves width and height for the label block', () => {
    const layout = createLayout()
    applyLabelDimensions(layout, {
      feature,
      configContext: createConfigContext(),
      isNested: false,
      isTranscriptChild: false,
    })

    expect(layout.leftPadding).toBe(labelTextWidth + 3)
    expect(layout.totalLayoutWidth).toBe(100 + labelTextWidth + 3)
    expect(layout.leftLabelBlockHeight).toBe(22)
    expect(layout.totalLayoutHeight).toBe(22)
    // feature body is centered in the taller row
    expect(layout.y).toBe(6)
  })

  test('left placement with a single label grows the row only when needed', () => {
    const layout = createLayout()
    applyLabelDimensions(layout, {
      feature,
      configContext: createConfigContext({ showDescriptions: false }),
      isNested: false,
      isTranscriptChild: false,
    })

    expect(layout.leftLabelBlockHeight).toBe(11)
    expect(layout.totalLayoutHeight).toBe(11)
    expect(layout.y).toBe(0.5)
  })

  test('left reservation covers the labels that are actually drawn', () => {
    const layout = createLayout()
    applyLabelDimensions(layout, {
      feature,
      configContext: createConfigContext(),
      isNested: false,
      isTranscriptChild: false,
    })

    const bounds = featureLabelHitBounds(layout)
    // labels are drawn right-anchored at featureLeft - gap, using the 11px
    // floating label font, so the reservation must reach further left
    const drawnLabelLeft = -3 - measureText('Gene1', 11)
    expect(bounds.left).toBeLessThanOrEqual(drawnLabelLeft)
    expect(bounds.bottom - bounds.top).toBe(22)
  })

  test('below placement reserves width and height without moving the feature', () => {
    const layout = createLayout()
    applyLabelDimensions(layout, {
      feature,
      configContext: createConfigContext({ labelPlacement: 'below' }),
      isNested: false,
      isTranscriptChild: false,
    })

    expect(layout.leftPadding).toBe(0)
    expect(layout.leftLabelBlockHeight).toBeUndefined()
    expect(layout.totalLayoutWidth).toBe(Math.max(100, labelTextWidth))
    expect(layout.totalLayoutHeight).toBe(10 + 2 * 12)
    expect(layout.y).toBe(0)
  })

  test('overlay subfeature labels do not grow the row', () => {
    const layout = createLayout()
    applyLabelDimensions(layout, {
      feature,
      configContext: createConfigContext({ subfeatureLabels: 'overlay' }),
      isNested: true,
      isTranscriptChild: true,
    })

    expect(layout.totalLayoutHeight).toBe(10)
  })

  test('nested features do not reserve left label space', () => {
    const layout = createLayout()
    applyLabelDimensions(layout, {
      feature,
      configContext: createConfigContext(),
      isNested: true,
      isTranscriptChild: false,
    })

    expect(layout.leftPadding).toBe(0)
    expect(layout.totalLayoutHeight).toBe(10)
  })
})
