declare module 'zarr' {
  export interface ZarrArray {
    shape: number[]
    get(): Promise<unknown>
  }
  export interface ZarrGroup {
    store: unknown
    getItem(name: string): Promise<unknown>
    keys(): Promise<string[]>
  }
  export function openArray(options: {
    store: unknown
    path?: string
    mode?: string
  }): Promise<ZarrArray>
  export function openGroup(
    source: string | unknown,
  ): Promise<ZarrGroup>
}
