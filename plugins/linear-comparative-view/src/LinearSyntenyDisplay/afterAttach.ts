import { getContainingView, getSession } from '@jbrowse/core/util'
import { bpToPx } from '@jbrowse/core/util/Base1DUtils'
import { addDisposer, getSnapshot } from '@jbrowse/mobx-state-tree'
import { MismatchParser } from '@jbrowse/plugin-alignments'
import { autorun, reaction } from 'mobx'

import {
  drawCigarClickMap,
  drawMouseoverClickMap,
  drawRef,
} from './drawSynteny.ts'
import {
  applyAlpha,
  getIdentityColor,
  getRainbowColor,
} from './drawSyntenyUtils.ts'
import {
  buildLevelIndex,
  computeFeatureAnchorPos,
} from '../LinearSyntenyView/util/followSynteny.ts'

import type { FeatPos, LinearSyntenyDisplayModel } from './model.ts'
import type { LevelIndex } from '../LinearSyntenyView/util/followSynteny.ts'
import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'
import type { Feature } from '@jbrowse/core/util'

type LSV = LinearSyntenyViewModel

export function doAfterAttach(self: LinearSyntenyDisplayModel) {
  addDisposer(
    self,
    autorun(
      function syntenyDrawAutorun() {
        if (self.isMinimized) {
          return
        }
        const view = getContainingView(self) as LinearSyntenyViewModel
        if (
          !view.initialized ||
          !view.views.every(a => a.displayedRegions.length > 0 && a.initialized)
        ) {
          return
        }

        const ctx1 = self.mainCanvas?.getContext('2d')
        const ctx3 = self.cigarClickMapCanvas?.getContext('2d')
        if (!ctx1 || !ctx3) {
          return
        }

        // Access alpha to make autorun react to alpha changes
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { alpha } = self
        const height = self.height
        const width = view.width
        ctx1.clearRect(0, 0, width, height)

        // Draw main canvas immediately
        drawRef(self, ctx1)

        drawCigarClickMap(self, ctx3)
      },
      { name: 'SyntenyDraw' },
    ),
  )

  addDisposer(
    self,
    autorun(
      function syntenyMouseoverAutorun() {
        if (self.isMinimized) {
          return
        }
        const view = getContainingView(self) as LinearSyntenyViewModel
        if (
          !view.initialized ||
          !view.views.every(a => a.displayedRegions.length > 0 && a.initialized)
        ) {
          return
        }
        // Access reactive properties so autorun is triggered when they change
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { clickId, mouseoverId } = self
        drawMouseoverClickMap(self)
      },
      { name: 'SyntenyMouseover' },
    ),
  )

  // this attempts to reduce recalculation of feature positions drawn by the
  // synteny view
  //
  // uses a reaction to say "we know the positions don't change in any relevant
  // way unless bpPerPx changes or displayedRegions changes"
  addDisposer(
    self,
    reaction(
      () => {
        if (self.isMinimized) {
          return { initialized: false }
        }
        const view = getContainingView(self) as LSV
        return {
          bpPerPx: view.views.map(v => v.bpPerPx),

          // stringifying 'deeply' accesses the displayed regions, see
          // issue #3456
          displayedRegions: JSON.stringify(
            view.views.map(v => v.displayedRegions),
          ),
          features: self.features,
          // fill precomputation inputs: subscribing to these re-runs the
          // reaction when the coloring mode, its parameters, or the features
          // the rainbow mode maps through change
          colorBy: self.colorBy,
          alpha: self.alpha,
          themeHue: self.themePrimaryHue,
          rainbowAnchor: view.rainbowAnchor,
          levelFeatures: view.levels.flatMap(lvl =>
            (
              lvl.tracks as {
                displays: { type: string; features?: Feature[] }[]
              }[]
            ).flatMap(track =>
              track.displays
                .filter(d => d.type === 'LinearSyntenyDisplay')
                .map(d => d.features),
            ),
          ),
          initialized:
            view.initialized &&
            view.views.every(
              a => a.displayedRegions.length > 0 && a.initialized,
            ),
        }
      },
      ({ initialized }) => {
        if (!initialized) {
          return
        }
        const { level } = self
        const { assemblyManager } = getSession(self)
        const view = getContainingView(self) as LSV
        const { colorBy, alpha } = self
        const viewSnaps = view.views.map(view => ({
          ...getSnapshot(view),
          width: view.width,
          staticBlocks: view.staticBlocks,
          interRegionPaddingWidth: view.interRegionPaddingWidth,
          minimumBlockWidth: view.minimumBlockWidth,
        }))

        // rainbow coloring context: per-level indexes of all synteny display
        // features (WeakMap-cached by features reference) plus a concatenated
        // coordinate table over the anchor view's displayed regions
        let rainbowCtx:
          | {
              levelIndexes: (LevelIndex | undefined)[]
              anchorLevel: number
              anchorFrac: (refName: string, coord: number) => number | undefined
            }
          | undefined
        if (colorBy === 'rainbow') {
          const anchorLevel = Math.min(
            view.rainbowAnchor,
            view.views.length - 1,
          )
          const canonicalize = (asm: string, ref: string) =>
            assemblyManager.get(asm)?.getCanonicalRefName(ref) || ref
          const levelIndexes = view.levels.map(lvl => {
            const levelFeatures: Feature[] = []
            for (const track of lvl.tracks as {
              displays: { type: string; features?: Feature[] }[]
            }[]) {
              for (const d of track.displays) {
                if (d.type === 'LinearSyntenyDisplay') {
                  levelFeatures.push(...(d.features ?? []))
                }
              }
            }
            return levelFeatures.length
              ? buildLevelIndex(levelFeatures, canonicalize)
              : undefined
          })
          const anchorAsmName = view.views[anchorLevel]?.assemblyNames[0]
          // concatenate the anchor view's displayed regions (in display
          // order) into a single 0..1 axis; reversed regions mirror their
          // within-region coordinate so the on-screen gradient always runs
          // left to right
          const regions: {
            refName: string
            start: number
            end: number
            offset: number
            reversed: boolean
          }[] = []
          let total = 0
          for (const r of view.views[anchorLevel]?.displayedRegions ?? []) {
            const len = r.end - r.start
            regions.push({
              refName: canonicalize(anchorAsmName!, r.refName),
              start: r.start,
              end: r.end,
              offset: total,
              reversed: r.reversed ?? false,
            })
            total += len
          }
          rainbowCtx = {
            levelIndexes,
            anchorLevel,
            anchorFrac: (refName, coord) => {
              const candidates = regions.filter(r => r.refName === refName)
              if (!candidates.length || !total) {
                return undefined
              }
              const r =
                candidates.find(r => coord >= r.start && coord <= r.end) ??
                candidates[0]!
              const clamped = Math.min(r.end, Math.max(r.start, coord))
              const within = r.reversed ? r.end - clamped : clamped - r.start
              return (r.offset + within) / total
            },
          }
        }

        const map = [] as FeatPos[]
        const feats = self.features || []

        for (const f of feats) {
          const mate = f.get('mate')
          let f1s = f.get('start')
          let f1e = f.get('end')
          const f2s = mate.start
          const f2e = mate.end

          if (f.get('strand') === -1) {
            ;[f1e, f1s] = [f1s, f1e]
          }
          const a1 = assemblyManager.get(f.get('assemblyName'))
          const a2 = assemblyManager.get(mate.assemblyName)
          const r1 = f.get('refName')
          const r2 = mate.refName
          const ref1 = a1?.getCanonicalRefName(r1) || r1
          const ref2 = a2?.getCanonicalRefName(r2) || r2
          const v1 = viewSnaps[level]!
          const v2 = viewSnaps[level + 1]!
          const p11 = bpToPx({ self: v1, refName: ref1, coord: f1s })
          const p12 = bpToPx({ self: v1, refName: ref1, coord: f1e })
          const p21 = bpToPx({ self: v2, refName: ref2, coord: f2s })
          const p22 = bpToPx({ self: v2, refName: ref2, coord: f2e })

          if (
            p11 === undefined ||
            p12 === undefined ||
            p21 === undefined ||
            p22 === undefined
          ) {
            continue
          }

          const rawStrand = f.get('strand') as number | undefined
          const effStrand =
            rawStrand === -1 || rawStrand === 1
              ? rawStrand *
                (v1.displayedRegions[p11.index]?.reversed ? -1 : 1) *
                (v2.displayedRegions[p21.index]?.reversed ? -1 : 1)
              : 0

          const cigar = f.get('CIGAR') as string | undefined

          let fill: string | undefined
          if (colorBy === 'identity') {
            fill = applyAlpha(
              getIdentityColor(
                f.get('identity') as number | undefined,
                self.themePrimaryHue,
              ),
              alpha,
            )
          } else if (colorBy === 'rainbow') {
            const pos = rainbowCtx
              ? computeFeatureAnchorPos({
                  levelIndexes: rainbowCtx.levelIndexes,
                  displayLevel: level,
                  anchorLevel: rainbowCtx.anchorLevel,
                  topRef: ref1,
                  topStart: f.get('start'),
                  topEnd: f.get('end'),
                  botRef: ref2,
                  botStart: f2s,
                  botEnd: f2e,
                })
              : undefined
            const frac = pos
              ? rainbowCtx!.anchorFrac(pos.refName, pos.coord)
              : undefined
            fill = applyAlpha(
              frac === undefined ? '#999999' : getRainbowColor(frac),
              alpha,
            )
          }

          map.push({
            p11,
            p12,
            p21,
            p22,
            f,
            cigar: MismatchParser.parseCigar(cigar),
            effStrand,
            fill,
          })
        }

        self.setFeatPositions(map)
      },
      { fireImmediately: true },
    ),
  )
}
