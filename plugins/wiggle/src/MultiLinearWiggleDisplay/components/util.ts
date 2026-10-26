import { getYScaleBarLeftPadding } from '../../util.ts'

import type { WiggleDisplayModel } from '../model.ts'
import type { GridRowId } from '@mui/x-data-grid'

export function moveUp<T extends { name: string }>(
  arr: T[],
  sel: GridRowId[],
  by = 1,
) {
  const idxs = sel
    .map(l => arr.findIndex(v => v.name === l))
    .sort((a, b) => a - b)
  let lastIdx = 0
  for (const old of idxs) {
    const idx = Math.max(lastIdx, old - by)
    if (idx >= lastIdx) {
      arr.splice(idx, 0, arr.splice(old, 1)[0]!)
    }
    lastIdx = lastIdx + 1
  }

  return arr
}

export function moveDown<T extends { name: string }>(
  arr: T[],
  sel: GridRowId[],
  by = 1,
) {
  const idxs = sel
    .map(l => arr.findIndex(v => v.name === l))
    .sort((a, b) => b - a)
  let lastIdx = arr.length - 1
  for (const old of idxs) {
    const idx = Math.min(lastIdx, old + by)
    if (idx <= lastIdx) {
      arr.splice(idx, 0, arr.splice(old, 1)[0]!)
    }
    lastIdx = lastIdx - 1
  }

  return arr
}

export function getOffset(model: WiggleDisplayModel) {
  return getYScaleBarLeftPadding(model)
}

/**
 * room the y-scale bar of a multi-row multi-wiggle reserves for its tick
 * labels: YScaleBar draws them from 9px right of the bar and they are at most
 * about 40px wide at fontSize 10, so the row labels start 50px after it
 */
export const ROW_LABEL_OFFSET_FROM_SCALE_BAR = 50

/**
 * gap between the y-scale bar and the row labels in an SVG export, where the
 * bar is mirrored and draws its tick labels on its left instead
 */
export const ROW_LABEL_OFFSET_IN_EXPORT = 10
