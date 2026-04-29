declare module 'zarr' {
  export interface NestedArray<T> {
    data: T
    shape: number[]
  }

  export type TypedArray =
    | Int8Array
    | Uint8Array
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Float32Array
    | Float64Array

  export class ZarrArray {
    store: unknown
    path: string
    shape: number[]
    chunks: number[]
    attrs: { [key: string]: unknown }
    get(
      selection?: unknown,
      opts?: unknown,
    ): Promise<NestedArray<TypedArray> | number>
    getRaw(selection?: unknown, opts?: unknown): Promise<unknown>
  }

  export class Group {
    store: unknown
    path: string
    attrs: { [key: string]: unknown }
    getItem(item: string): Promise<Group | ZarrArray>
    setItem(item: string, value: unknown): Promise<boolean>
    containsItem(item: string): Promise<boolean>
  }

  export function openArray(options: {
    store: unknown
    path?: string
    mode?: string
  }): Promise<ZarrArray>

  export function openGroup(
    store?: string | unknown,
    path?: string | null,
    mode?: string,
    chunkStore?: unknown,
    cacheAttrs?: boolean,
  ): Promise<Group>

  export function slice(start?: number, stop?: number, step?: number): unknown
}
