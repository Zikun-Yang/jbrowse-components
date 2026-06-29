import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { TabixIndexedFile } from '@gmod/tabix'

import FeatureChartTabixAdapter from './FeatureChartTabixAdapter.ts'
import configSchema from './configSchema.ts'

jest.mock('@gmod/tabix')

class MockTabixIndexedFile {
  public lines: string[] = []
  public metadata: {
    columnNumbers: { ref: number; start: number; end: number }
  } = {
    columnNumbers: { ref: 1, start: 2, end: 3 },
  }

  async getReferenceSequenceNames() {
    return ['chr1']
  }

  async getMetadata() {
    return this.metadata
  }

  async getLines(
    _refName: string,
    _start: number,
    _end: number,
    opts: { lineCallback: (line: string, fileOffset: number) => void },
  ) {
    for (const [i, line] of this.lines.entries()) {
      opts.lineCallback(line, i)
    }
  }
}

function createAdapter(lines: string[]) {
  const mock = new MockTabixIndexedFile()
  mock.lines = lines
  ;(TabixIndexedFile as jest.Mock).mockImplementation(() => mock)

  return new FeatureChartTabixAdapter(
    configSchema.create({
      dataLocation: {
        uri: 'http://example.com/data.tsv.gz',
        locationType: 'UriLocation',
      },
      index: {
        location: {
          uri: 'http://example.com/data.tsv.gz.tbi',
          locationType: 'UriLocation',
        },
        indexType: 'TBI',
      },
    }),
  )
}

describe('FeatureChartTabixAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('parses TSV lines into features with contextData', async () => {
    const adapter = createAdapter([
      'chr1\t100\t200\tGENE1\t{"tissues":{"Brain":[1,2,3]}}\tBrain expression',
    ])

    const features = await firstValueFrom(
      adapter
        .getFeatures({ refName: 'chr1', start: 0, end: 1000 })
        .pipe(toArray()),
    )

    expect(features).toHaveLength(1)
    const feature = features[0]!
    expect(feature.get('refName')).toBe('chr1')
    expect(feature.get('start')).toBe(100)
    expect(feature.get('end')).toBe(200)
    expect(feature.get('name')).toBe('GENE1')

    const contextData = feature.get('contextData') as {
      data: { tissues: { Brain: number[] } }
      name: string
      description: string
    }
    expect(contextData.name).toBe('GENE1')
    expect(contextData.description).toBe('Brain expression')
    expect(contextData.data).toEqual({ tissues: { Brain: [1, 2, 3] } })
  })

  test('skips lines with too few columns or invalid JSON', async () => {
    const adapter = createAdapter([
      'chr1\t100\t200\tGENE1\tnot-json',
      'chr1\t300\t400',
      'chr1\t500\t600\tGENE2\t{"tissues":{"Liver":[4,5,6]}}',
    ])

    const features = await firstValueFrom(
      adapter
        .getFeatures({ refName: 'chr1', start: 0, end: 1000 })
        .pipe(toArray()),
    )

    expect(features).toHaveLength(1)
    expect(features[0]!.get('name')).toBe('GENE2')
  })

  test('getRefNames delegates to tabix file', async () => {
    const adapter = createAdapter([])
    const refNames = await adapter.getRefNames()
    expect(refNames).toEqual(['chr1'])
  })
})
