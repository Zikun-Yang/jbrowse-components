declare module 'zarr' {
  export interface ZarrSlice {
    start: number | null
    stop: number | null
    step: number | null
    _slice: true
  }

  export interface ZarrArray {
    shape: number[]
    chunks: number[]
    dtype: string
    meta: {
      filters?: { id: string }[]
      compressor: { id: string } | null
      order: 'C' | 'F'
      dimension_separator?: string
    }
    chunkStore: {
      getItem(key: string, opts?: unknown): Promise<Uint8Array | Buffer>
    }
    chunkKey(chunkCoords: number[]): string
    decodeChunk(chunkData: Uint8Array | Buffer): Promise<ArrayBuffer>
    get(selection?: (number | ZarrSlice | null)[]): Promise<
      | {
          data:
            | Int8Array
            | Uint8Array
            | Int16Array
            | Uint16Array
            | Int32Array
            | Uint32Array
            | Float32Array
            | Float64Array
            | BigInt64Array
        }
      | undefined
    >
  }

  export interface ZarrGroup {
    path: string
    store: {
      keys(): Promise<string[]> | string[]
    }
    attrs: {
      [key: string]: unknown
      asObject(): Promise<Record<string, unknown>>
    }
    getItem(name: string): Promise<ZarrGroup | ZarrArray | undefined | null>
    containsItem(name: string): Promise<boolean>
  }

  export function openArray(options: {
    store?: unknown
    path?: string
  }): Promise<ZarrArray>

  export function openGroup(
    store: string | unknown,
    path?: string,
    mode?: string,
  ): Promise<ZarrGroup>

  export function slice(
    start: number | null | ':' | undefined,
    stop?: number | null | ':' | undefined,
    step?: number | null,
  ): ZarrSlice
}
