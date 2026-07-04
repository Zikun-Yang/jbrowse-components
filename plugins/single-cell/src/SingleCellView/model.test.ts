import { autorun } from 'mobx'
import type PluginManager from '@jbrowse/core/PluginManager'

import stateModelFactory, {
  applyXTransform,
  applyYTransform,
  getGeneSetAggregator,
  maxGeneSetAggregator,
  meanGeneSetAggregator,
  medianGeneSetAggregator,
  sumGeneSetAggregator,
} from './model.ts'

describe('SingleCellView persisted state', () => {
  it('round-trips feature, gene-set and obs selection state via snapshot', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation()
    const stateModel = stateModelFactory(undefined as unknown as PluginManager)
    const instance = stateModel.create({
      id: 'test',
      type: 'SingleCellView',
      dataset: 'http://example.com/test.zarr',
      activeFeatures: ['GENE1', 'GENE2'],
      selectedFeature: 'GENE1',
      featureRanges: { GENE1: { min: 0, max: 10 } },
      featureTransforms: { GENE1: { x: 'log', y: 'linear' } },
      activeGeneSets: ['setA'],
      selectedGeneSet: 'setA',
      geneSets: { setA: ['GENE1', 'GENE2'] },
      geneSetRanges: { setA: { min: 1, max: 5 } },
      geneSetTransforms: { setA: { x: 'linear', y: 'log' } },
      geneSetAggregatorKeys: { setA: 'sum' },
      selectedLabels: { cell_type: ['T-cell'] },
      selectedRanges: { n_counts: { min: 100, max: 200 } },
      obsTransforms: { n_counts: { x: 'log', y: 'linear' } },
    })

    expect(Array.from(instance.activeFeatures)).toEqual(['GENE1', 'GENE2'])
    expect(instance.selectedFeature).toBe('GENE1')
    expect(instance.featureRanges.get('GENE1')).toEqual({ min: 0, max: 10 })
    expect(instance.featureTransforms.get('GENE1')).toEqual({
      x: 'log',
      y: 'linear',
    })
    expect(Array.from(instance.geneSets.get('setA') ?? [])).toEqual([
      'GENE1',
      'GENE2',
    ])
    expect(instance.geneSetAggregatorKeys.get('setA')).toBe('sum')
    expect(Array.from(instance.selectedLabels.get('cell_type') ?? [])).toEqual([
      'T-cell',
    ])
    consoleError.mockRestore()
  })
})

describe('applyXTransform', () => {
  it('returns original values for linear transform', () => {
    const values = new Float32Array([1, 2, 3])
    const result = applyXTransform(values, 'linear')
    expect(result).toBe(values)
  })

  it('applies log1p to non-negative values', () => {
    const values = new Float32Array([0, 1, 2, 3])
    const result = applyXTransform(values, 'log')
    expect(result[0]).toBeCloseTo(Math.log1p(0))
    expect(result[1]).toBeCloseTo(Math.log1p(1))
    expect(result[2]).toBeCloseTo(Math.log1p(2))
    expect(result[3]).toBeCloseTo(Math.log1p(3))
  })

  it('shifts negative values before log1p', () => {
    const values = new Float32Array([-2, -1, 0, 1])
    const result = applyXTransform(values, 'log')
    const shift = 2
    expect(result[0]).toBeCloseTo(Math.log1p(-2 + shift))
    expect(result[1]).toBeCloseTo(Math.log1p(-1 + shift))
    expect(result[2]).toBeCloseTo(Math.log1p(0 + shift))
    expect(result[3]).toBeCloseTo(Math.log1p(1 + shift))
  })

  it('handles all non-finite values gracefully', () => {
    const values = new Float32Array([Infinity, -Infinity, NaN])
    const result = applyXTransform(values, 'log')
    expect(Number.isFinite(result[0])).toBe(false)
  })
})

describe('applyYTransform', () => {
  it('returns count for linear transform', () => {
    expect(applyYTransform(5, 'linear')).toBe(5)
  })

  it('returns log1p of count for log transform', () => {
    expect(applyYTransform(5, 'log')).toBeCloseTo(Math.log1p(5))
    expect(applyYTransform(0, 'log')).toBeCloseTo(0)
  })
})

describe('meanGeneSetAggregator', () => {
  it('returns empty array for no input', () => {
    expect(meanGeneSetAggregator([]).length).toBe(0)
  })

  it('averages values per cell, ignoring non-finite values', () => {
    const geneA = new Float32Array([1, 2, 3])
    const geneB = new Float32Array([3, NaN, 5])
    const result = meanGeneSetAggregator([geneA, geneB])
    expect(result[0]).toBeCloseTo(2)
    expect(result[1]).toBeCloseTo(2)
    expect(result[2]).toBeCloseTo(4)
  })

  it('returns 0 for cells with no finite values', () => {
    const geneA = new Float32Array([NaN, NaN])
    const result = meanGeneSetAggregator([geneA])
    expect(result[0]).toBe(0)
    expect(result[1]).toBe(0)
  })
})

describe('sumGeneSetAggregator', () => {
  it('sums finite values per cell', () => {
    const geneA = new Float32Array([1, 2])
    const geneB = new Float32Array([3, 4])
    const result = sumGeneSetAggregator([geneA, geneB])
    expect(result[0]).toBeCloseTo(4)
    expect(result[1]).toBeCloseTo(6)
  })

  it('ignores non-finite values', () => {
    const geneA = new Float32Array([1, NaN])
    const geneB = new Float32Array([NaN, 4])
    const result = sumGeneSetAggregator([geneA, geneB])
    expect(result[0]).toBeCloseTo(1)
    expect(result[1]).toBeCloseTo(4)
  })
})

describe('medianGeneSetAggregator', () => {
  it('computes median for odd number of genes', () => {
    const geneA = new Float32Array([1, 10])
    const geneB = new Float32Array([2, 20])
    const geneC = new Float32Array([3, 30])
    const result = medianGeneSetAggregator([geneA, geneB, geneC])
    expect(result[0]).toBeCloseTo(2)
    expect(result[1]).toBeCloseTo(20)
  })

  it('computes median for even number of genes', () => {
    const geneA = new Float32Array([1, 10])
    const geneB = new Float32Array([3, 30])
    const result = medianGeneSetAggregator([geneA, geneB])
    expect(result[0]).toBeCloseTo(2)
    expect(result[1]).toBeCloseTo(20)
  })

  it('ignores non-finite values', () => {
    const geneA = new Float32Array([1, NaN])
    const geneB = new Float32Array([3, 10])
    const geneC = new Float32Array([NaN, 20])
    const result = medianGeneSetAggregator([geneA, geneB, geneC])
    expect(result[0]).toBeCloseTo(2)
    expect(result[1]).toBeCloseTo(15)
  })
})

describe('maxGeneSetAggregator', () => {
  it('uses maximum finite value per cell', () => {
    const geneA = new Float32Array([1, 5])
    const geneB = new Float32Array([3, 2])
    const result = maxGeneSetAggregator([geneA, geneB])
    expect(result[0]).toBeCloseTo(3)
    expect(result[1]).toBeCloseTo(5)
  })

  it('returns 0 when no finite values exist', () => {
    const geneA = new Float32Array([NaN, NaN])
    const result = maxGeneSetAggregator([geneA])
    expect(result[0]).toBe(0)
    expect(result[1]).toBe(0)
  })
})

describe('getGeneSetAggregator', () => {
  it('returns the requested aggregator', () => {
    expect(getGeneSetAggregator('mean')).toBe(meanGeneSetAggregator)
    expect(getGeneSetAggregator('sum')).toBe(sumGeneSetAggregator)
    expect(getGeneSetAggregator('median')).toBe(medianGeneSetAggregator)
    expect(getGeneSetAggregator('max')).toBe(maxGeneSetAggregator)
  })

  it('falls back to mean for unknown keys', () => {
    expect(getGeneSetAggregator('unknown')).toBe(meanGeneSetAggregator)
  })
})

describe('SingleCellView volatile reactivity', () => {
  it('toggleFeatureExpanded notifies observers when expanding', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation()
    const stateModel = stateModelFactory(undefined as unknown as PluginManager)
    const instance = stateModel.create({ id: 'test', type: 'SingleCellView' })
    const observed: boolean[] = []
    const disposer = autorun(() => {
      observed.push(instance.expandedFeatures.includes('GENE1'))
    })
    instance.toggleFeatureExpanded('GENE1')
    disposer()
    expect(observed).toEqual([false, true])
    consoleError.mockRestore()
  })

  it('toggleGeneSetExpanded notifies observers when expanding', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation()
    const stateModel = stateModelFactory(undefined as unknown as PluginManager)
    const instance = stateModel.create({
      id: 'test',
      type: 'SingleCellView',
      geneSets: { setA: ['GENE1'] },
    })
    const observed: boolean[] = []
    const disposer = autorun(() => {
      observed.push(instance.expandedGeneSets.includes('setA'))
    })
    instance.toggleGeneSetExpanded('setA')
    disposer()
    expect(observed).toEqual([false, true])
    consoleError.mockRestore()
  })
})
