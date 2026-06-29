import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import SingleCellBamAdapter from './SingleCellBamAdapter.ts'
import configSchema from './SingleCellBamAdapterConfigSchema.ts'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'

function makeFeature(id: string, tag: string, barcode?: string) {
  return new SimpleFeature({
    id,
    data: {
      refName: 'chr1',
      start: 100,
      end: 200,
      [tag]: barcode,
    },
  })
}

class MockBamAdapter extends BaseFeatureDataAdapter {
  constructor(private features: Feature[]) {
    super()
  }

  async getRefNames(_opts?: BaseOptions) {
    return ['chr1']
  }

  getFeatures(_region: Region, _opts?: BaseOptions) {
    return ObservableCreate<Feature>(observer => {
      for (const f of this.features) {
        observer.next(f)
      }
      observer.complete()
    })
  }
}

function createAdapter(inner: Feature, tag = 'CB') {
  const adapter = new SingleCellBamAdapter(
    configSchema.create({
      subadapter: { type: 'MockBamAdapter' },
      cellBarcodeTag: tag,
    }),
    async () => ({ dataAdapter: inner as BaseFeatureDataAdapter }),
  )
  return adapter
}

describe('SingleCellBamAdapter', () => {
  test('passes through all features when no selection is provided', async () => {
    const inner = new MockBamAdapter([
      makeFeature('a', 'CB', 'cell1'),
      makeFeature('b', 'CB', 'cell2'),
      makeFeature('c', 'CB', 'cell3'),
    ])
    const adapter = createAdapter(inner)
    const features = await firstValueFrom(
      adapter.getFeatures({ refName: 'chr1', start: 0, end: 1000 }).pipe(toArray()),
    )
    expect(features.map(f => f.id())).toEqual(['a', 'b', 'c'])
  })

  test('filters features by CB tag', async () => {
    const inner = new MockBamAdapter([
      makeFeature('a', 'CB', 'cell1'),
      makeFeature('b', 'CB', 'cell2'),
      makeFeature('c', 'CB', 'cell3'),
    ])
    const adapter = createAdapter(inner)
    const features = await firstValueFrom(
      adapter
        .getFeatures(
          { refName: 'chr1', start: 0, end: 1000 },
          { selectedCells: new Set(['cell2', 'cell3']) },
        )
        .pipe(toArray()),
    )
    expect(features.map(f => f.id())).toEqual(['b', 'c'])
  })

  test('uses configured barcode tag', async () => {
    const inner = new MockBamAdapter([
      makeFeature('a', 'CR', 'cellA'),
      makeFeature('b', 'CR', 'cellB'),
    ])
    const adapter = createAdapter(inner, 'CR')
    const features = await firstValueFrom(
      adapter
        .getFeatures(
          { refName: 'chr1', start: 0, end: 1000 },
          { selectedCells: new Set(['cellA']) },
        )
        .pipe(toArray()),
    )
    expect(features.map(f => f.id())).toEqual(['a'])
  })

  test('returns no features when selectedCells is empty', async () => {
    const inner = new MockBamAdapter([
      makeFeature('a', 'CB', 'cell1'),
      makeFeature('b', 'CB', 'cell2'),
    ])
    const adapter = createAdapter(inner)
    const features = await firstValueFrom(
      adapter
        .getFeatures(
          { refName: 'chr1', start: 0, end: 1000 },
          { selectedCells: new Set<string>() },
        )
        .pipe(toArray()),
    )
    expect(features.map(f => f.id())).toEqual(['a', 'b'])
  })

  test('delegates getRefNames to inner adapter', async () => {
    const inner = new MockBamAdapter([])
    const adapter = createAdapter(inner)
    await expect(adapter.getRefNames()).resolves.toEqual(['chr1'])
  })
})
