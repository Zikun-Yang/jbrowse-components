/**
 * Access helper for `DrawerProps.data`.
 *
 * `data` is "whatever the adapter managed to parse out of the feature's `data`
 * column", which is **not guaranteed to be an object**:
 *
 * - the column can legitimately contain `null`, a number or a string —
 *   `JSON.parse` succeeds and hands the drawer that value;
 * - a feature can arrive without any parsed payload at all (an adapter that
 *   does not produce `contextData`, or a row whose JSON did not parse), so
 *   `data` is `undefined`.
 *
 * Every drawer used to read `data.boxes` / `data.tissues` / … directly, so any
 * of the above threw a `TypeError` inside the canvas callback. That is the one
 * failure mode the drawer contract forbids: in the RPC worker a throw is not
 * caught per chart, it fails the whole track. Drawers therefore read their
 * payload through `asDrawerData()`, which answers `{}` for anything that is not
 * a plain object, and then paint nothing for the missing keys.
 */

const EMPTY_DATA: Record<string, unknown> = {}

/** `data` when it is a plain object, `{}` otherwise (never `null`/`undefined`). */
export function asDrawerData<T extends object>(data: unknown): Partial<T> {
  return data !== null && typeof data === 'object' && !Array.isArray(data)
    ? (data as Partial<T>)
    : (EMPTY_DATA as unknown as Partial<T>)
}
