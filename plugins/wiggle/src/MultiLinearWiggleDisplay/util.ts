import type { Source } from '../util.ts'

/**
 * Color that the multi-row renderers hardcoded for every row before rows
 * started using the posColor of the renderer config. Sessions that ran the
 * (removed) cluster dialog, or saved the color/arrangement editor while that
 * default was active, have it stored in the display layout as if the user had
 * picked it, which would keep every row blue forever.
 *
 * "#0000ff" is the same color written out, which can end up in a layout if the
 * color went through a picker that normalizes color names.
 */
const LEGACY_MULTIROW_COLORS = new Set(['blue', '#0000ff'])

/**
 * Drops the legacy uniform "blue" that multi-row displays used to write into
 * their layout. Only a layout where every source has the same legacy color is
 * touched: that is the signature of the old hardcoded default, while a user
 * that colors individual sources is left alone.
 */
export function stripLegacyMultiRowColors(layout: Source[]) {
  // a single row is not a multi-row default; don't touch it
  if (layout.length < 2) {
    return layout
  }
  const color = layout[0]?.color
  if (!color || !LEGACY_MULTIROW_COLORS.has(color)) {
    return layout
  }
  if (!layout.every(s => s.color === color)) {
    return layout
  }
  return layout.map(source => {
    const ret = { ...source }
    delete ret.color
    return ret
  })
}

/**
 * Drops colors the display derives by itself (see defaultSourceColor in the
 * display model) from the rows the color/arrangement editor is about to save.
 *
 * The editor works on the same sources that are rendered, so it sees derived
 * colors too. Persisting them would turn a default into an explicit user
 * choice: changing the default later would not apply to that display anymore,
 * and switching from a multi-row renderer to an overlaid one would keep every
 * sample the same color. Only colors that are not the default of their own
 * source are kept.
 */
export function stripDefaultColors<T extends { name: string; color?: unknown }>(
  rows: T[],
  defaultColorFor: (name: string) => string | undefined,
) {
  return rows.map(row => {
    const defaultColor = defaultColorFor(row.name)
    if (
      typeof row.color !== 'string' ||
      defaultColor === undefined ||
      row.color !== defaultColor
    ) {
      return row
    }
    const ret = { ...row }
    delete ret.color
    return ret
  })
}
