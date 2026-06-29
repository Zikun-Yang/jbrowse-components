import { openArray, openGroup, slice } from 'zarr'

import SingleCellZarrAdapter from './SingleCellZarrAdapter.ts'
import configSchema from './configSchema.ts'

jest.mock('zarr')

function mockSlice(
  start: number | null | undefined,
  stop?: number | null | undefined,
) {
  return { start, stop, step: null, _slice: true as const }
}

;(slice as jest.Mock).mockImplementation(mockSlice)

interface MockZarrArray {
  data: number[] | string[]
  shape: number[]
}

interface MockCategoricalArray extends MockZarrArray {
  categories?: string[]
}

interface MockSparseX {
  shape: MockZarrArray
  data: MockZarrArray
  indices: MockZarrArray
  indptr: MockZarrArray
}

/**
 * Build an in-memory mock of a Zarr/AnnData store.
 */
function createMockZarr(contents: {
  obsm?: Record<string, MockZarrArray>
  obs?: Record<string, MockCategoricalArray>
  var?: Record<string, MockZarrArray>
  X?: MockZarrArray | MockSparseX
}) {
  const storeKeys: string[] = []
  const arrays = new Map<string, MockZarrArray>()

  if (contents.obsm) {
    for (const [name, arr] of Object.entries(contents.obsm)) {
      storeKeys.push(`/obsm/${name}/0.0`)
      arrays.set(`obsm/${name}`, arr)
    }
  }

  if (contents.obs) {
    for (const [name, arr] of Object.entries(contents.obs)) {
      storeKeys.push(`/obs/${name}/0`)
      arrays.set(`obs/${name}`, arr)
      if (arr.categories) {
        storeKeys.push(`/obs/__categories/${name}/0`)
        arrays.set(`obs/__categories/${name}`, {
          data: arr.categories,
          shape: [arr.categories.length],
        })
      }
    }
  }

  if (contents.var) {
    for (const [name, arr] of Object.entries(contents.var)) {
      storeKeys.push(`/var/${name}/0`)
      arrays.set(`var/${name}`, arr)
    }
  }

  if (contents.X) {
    if ('dense' in contents.X) {
      storeKeys.push('/X/0.0')
      arrays.set('X', { data: contents.X.dense, shape: contents.X.shape })
    } else {
      const sparse = contents.X as MockSparseX
      storeKeys.push('/X/data/0', '/X/indices/0', '/X/indptr/0')
      arrays.set('X/data', sparse.data)
      arrays.set('X/indices', sparse.indices)
      arrays.set('X/indptr', sparse.indptr)
    }
  }

  const store = { keys: () => storeKeys }

  const xGroup = {
    path: '/X',
    store,
    attrs: {
      asObject: async () =>
        contents.X && !('dense' in contents.X)
          ? { shape: (contents.X as MockSparseX).shape.data }
          : {},
    },
    getItem: jest.fn(),
    containsItem: jest.fn(),
  }

  const rootGroup = {
    path: '/',
    store,
    attrs: { asObject: async () => ({}) },
    getItem: jest.fn((name: string) => {
      if (name === 'X') {
        return Promise.resolve(xGroup)
      }
      return Promise.resolve({
        path: `/${name}`,
        store,
        attrs: { asObject: async () => ({}) },
        getItem: jest.fn(),
        containsItem: jest.fn(),
      })
    }),
    containsItem: jest.fn(),
  }

  ;(openGroup as jest.Mock).mockImplementation(async (
    storeOrUri: unknown,
    path?: string,
  ) => {
    if (path === 'X') {
      return xGroup
    }
    return rootGroup
  })
  ;(openArray as jest.Mock).mockImplementation(async ({ path }: { path: string }) => {
    const arr = arrays.get(path)
    if (!arr) {
      throw new Error(`Array not found: ${path}`)
    }

    function isSlice(
      value: unknown,
    ): value is { _slice: true; start: number | null; stop: number | null } {
      return typeof value === 'object' && value !== null && '_slice' in value
    }

    return {
      shape: arr.shape,
      get: async (
        selection?: (
          | number
          | { _slice: true; start: number | null; stop: number | null }
          | null
        )[],
      ) => {
        let data = arr.data
        let shape = arr.shape

        if (selection && selection.length > 0) {
          // Normalize the selection to a list of [start, stop] pairs using the
          // original array shape. null / undefined means full extent.
          const nDims = shape.length
          const ranges: [number, number][] = []
          for (let d = 0; d < nDims; d++) {
            const sel = selection[d]
            const dimSize = shape[d] ?? 0
            if (sel === null || sel === undefined) {
              ranges.push([0, dimSize])
            } else if (isSlice(sel)) {
              const start = sel.start ?? 0
              const stop = sel.stop ?? dimSize
              ranges.push([start, stop])
            } else if (typeof sel === 'number') {
              ranges.push([sel, sel + 1])
            } else {
              ranges.push([0, dimSize])
            }
          }

          const [rowStart, rowStop] = ranges[0]!
          const nRows = shape[0] ?? 0
          const nCols = shape[1] ?? 1

          if (shape.length === 1) {
            // 1D slice
            const [start, stop] = ranges[0]!
            const sliced: number[] = []
            for (let i = start; i < stop && i < nRows; i++) {
              sliced.push((data as number[])[i] ?? 0)
            }
            data = sliced
            shape = [sliced.length]
          } else if (shape.length === 2) {
            const [colStart, colStop] = ranges[1]!
            const sliced: number[] = []
            for (let r = rowStart; r < rowStop && r < nRows; r++) {
              for (let c = colStart; c < colStop && c < nCols; c++) {
                const idx = r * nCols + c
                sliced.push((data as number[])[idx] ?? 0)
              }
            }
            data = sliced
            shape = [rowStop - rowStart, colStop - colStart]
          }
        }

        return { data, shape }
      },
    }
  })

  return { rootGroup }
}

function createAdapter(customConfig?: Record<string, unknown>) {
  return new SingleCellZarrAdapter(
    configSchema.create({
      zarrLocation: { uri: 'http://example.com/test.zarr' },
      ...customConfig,
    }),
  )
}

describe('SingleCellZarrAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('init detects embeddings, obs, var columns and dimensions', async () => {
    createMockZarr({
      obsm: {
        X_umap: { data: [1, 2, 3, 4], shape: [2, 2] },
        X_pca: { data: [0.1, 0.2], shape: [1, 2] },
      },
      obs: {
        cell_type: {
          data: [0, 1, 0],
          shape: [3],
          categories: ['T-cell', 'B-cell'],
        },
      },
      var: {
        index: { data: ['GENE1', 'GENE2'], shape: [2] },
      },
      X: {
        dense: [1, 2, 3, 4, 5, 6],
        shape: [3, 2],
      },
    })

    const adapter = createAdapter()
    await adapter.init()

    expect(adapter.embeddings).toEqual(['X_umap', 'X_pca'])
    expect(adapter.obsColumns).toEqual(['cell_type'])
    expect(adapter.varColumns).toEqual(['index'])
    expect(adapter.varNames).toEqual(['GENE1', 'GENE2'])
    expect(adapter.nObs).toBe(3)
    expect(adapter.nVar).toBe(2)
  })

  test('getEmbedding returns Float32Array in interleaved layout', async () => {
    createMockZarr({
      obsm: {
        X_umap: { data: [1, 2, 3, 4], shape: [2, 2] },
      },
    })

    const adapter = createAdapter()
    await adapter.init()

    const embedding = await adapter.getEmbedding('X_umap')
    expect(embedding).toEqual(new Float32Array([1, 2, 3, 4]))
  })

  test('getEmbedding slices multi-component PCA to first two dimensions', async () => {
    // 3 cells x 4 PCs; only the first two PCs should be returned
    createMockZarr({
      obsm: {
        X_pca: {
          data: [
            1, 2, 9, 9, // cell 0: PC1=1, PC2=2, PC3=9, PC4=9
            3, 4, 9, 9, // cell 1
            5, 6, 9, 9, // cell 2
          ],
          shape: [3, 4],
        },
      },
    })

    const adapter = createAdapter()
    await adapter.init()

    const embedding = await adapter.getEmbedding('X_pca')
    expect(embedding).toEqual(new Float32Array([1, 2, 3, 4, 5, 6]))
  })

  test('getObsColumn decodes categorical column', async () => {
    createMockZarr({
      obs: {
        cell_type: {
          data: [0, 1, 0],
          shape: [3],
          categories: ['T-cell', 'B-cell'],
        },
      },
    })

    const adapter = createAdapter()
    await adapter.init()

    const col = await adapter.getObsColumn('cell_type')
    expect(col.type).toBe('categorical')
    expect(col.categories).toEqual(['T-cell', 'B-cell'])
  })

  test('getObsColumn returns continuous column when no categories', async () => {
    createMockZarr({
      obs: {
        n_counts: {
          data: [100, 200, 300],
          shape: [3],
        },
      },
    })

    const adapter = createAdapter()
    await adapter.init()

    const col = await adapter.getObsColumn('n_counts')
    expect(col.type).toBe('continuous')
    expect(col.values).toEqual(new Float32Array([100, 200, 300]))
  })

  test('getExpression extracts column from dense X', async () => {
    createMockZarr({
      var: {
        index: { data: ['GENE1', 'GENE2'], shape: [2] },
      },
      X: {
        // 3 cells x 2 genes, row-major
        dense: [1, 2, 3, 4, 5, 6],
        shape: [3, 2],
      },
    })

    const adapter = createAdapter()
    await adapter.init()

    const expression = await adapter.getExpression('GENE2')
    expect(expression).toEqual(new Float32Array([2, 4, 6]))
  })

  test('getExpression extracts column from CSC sparse X', async () => {
    // 3 cells x 2 genes, CSC format
    // Column 0 (GENE1): cells 0, 2 have values
    // Column 1 (GENE2): cells 1, 2 have values
    createMockZarr({
      var: {
        index: { data: ['GENE1', 'GENE2'], shape: [2] },
      },
      X: {
        shape: { data: [3, 2], shape: [2] },
        data: { data: [10, 30, 20, 40], shape: [4] },
        indices: { data: [0, 2, 1, 2], shape: [4] },
        // indptr length = nVar + 1 = 3 → CSC
        indptr: { data: [0, 2, 4], shape: [3] },
      },
    })

    const adapter = createAdapter()
    await adapter.init()

    const expression = await adapter.getExpression('GENE2')
    expect(expression).toEqual(new Float32Array([0, 20, 40]))
  })

  test('getExpression extracts column from CSR sparse X', async () => {
    // 3 cells x 2 genes, CSR format
    // Row 0: gene 0 = 10
    // Row 1: gene 1 = 20
    // Row 2: gene 0 = 30, gene 1 = 40
    createMockZarr({
      var: {
        index: { data: ['GENE1', 'GENE2'], shape: [2] },
      },
      X: {
        shape: { data: [3, 2], shape: [2] },
        data: { data: [10, 20, 30, 40], shape: [4] },
        indices: { data: [0, 1, 0, 1], shape: [4] },
        // indptr length = nObs + 1 = 4 → CSR
        indptr: { data: [0, 1, 2, 4], shape: [4] },
      },
    })

    const adapter = createAdapter()
    await adapter.init()

    const expression = await adapter.getExpression('GENE1')
    expect(expression).toEqual(new Float32Array([10, 0, 30]))
  })

  test('getExpression throws for unknown gene', async () => {
    createMockZarr({
      var: {
        index: { data: ['GENE1'], shape: [1] },
      },
    })

    const adapter = createAdapter()
    await adapter.init()

    await expect(adapter.getExpression('UNKNOWN')).rejects.toThrow(
      'Gene UNKNOWN not found in var index',
    )
  })

  test('uses varIndexColumn config to resolve gene names', async () => {
    createMockZarr({
      var: {
        gene_ids: { data: ['G1', 'G2'], shape: [2] },
        index: { data: ['var_0', 'var_1'], shape: [2] },
      },
      X: {
        dense: [1, 2, 3, 4],
        shape: [2, 2],
      },
    })

    const adapter = createAdapter({ varIndexColumn: 'gene_ids' })
    await adapter.init()

    const expression = await adapter.getExpression('G2')
    expect(expression).toEqual(new Float32Array([2, 4]))
  })

  test('getExpression caches the returned array', async () => {
    createMockZarr({
      var: {
        index: { data: ['GENE1'], shape: [1] },
      },
      X: {
        dense: [1, 2, 3],
        shape: [3, 1],
      },
    })

    const adapter = createAdapter()
    await adapter.init()

    const first = await adapter.getExpression('GENE1')
    const second = await adapter.getExpression('GENE1')
    expect(first).toBe(second)
    expect(first).toEqual(new Float32Array([1, 2, 3]))
  })
})
