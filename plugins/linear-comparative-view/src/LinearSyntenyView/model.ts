import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import { addDisposer, getPath, types } from '@jbrowse/mobx-state-tree'
import { autorun, observable, reaction, when } from 'mobx'

import {
  CenterFocusStrongIcon,
  CropFreeIcon,
  LinkIcon,
  PhotoCameraIcon,
  ShuffleIcon,
  VisibilityIcon,
} from '@jbrowse/core/ui/Icons'

import { Curves } from './components/Icons.tsx'
import { buildLevelIndex, computeFollowTargets } from './util/followSynteny.ts'
import baseModel from '../LinearComparativeView/model.ts'

import type {
  ExportSvgOptions,
  ImportFormSyntenyTrack,
  LinearSyntenyViewInit,
} from './types.ts'
import type { Window } from './util/followSynteny.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// lazies
const ExportSvgDialog = lazy(() => import('./components/ExportSvgDialog.tsx'))
const DiagonalizationProgressDialog = lazy(
  () => import('./components/DiagonalizationProgressDialog.tsx'),
)

// idempotence check: is the target view already showing the mapped windows?
// single window compares center and visible span; multiple windows compare
// the displayed regions segment-by-segment plus total visible span, all with
// a ~2px tolerance so the resync reaction doesn't re-apply endlessly
function matchesWindows(view: LinearGenomeViewModel, windows: Window[]) {
  const tolerance = view.bpPerPx * 2
  if (windows.length === 1) {
    const target = windows[0]!
    const current = view.centerLineInfo
    return (
      current?.refName === target.refName &&
      Math.abs(current.coord - (target.start + target.end) / 2) < tolerance &&
      Math.abs(view.bpPerPx * view.width - (target.end - target.start)) <
        tolerance
    )
  }
  const regions = view.displayedRegions
  const totalBp = windows.reduce((acc, w) => acc + w.end - w.start, 0)
  return (
    regions.length === windows.length &&
    windows.every((w, i) => {
      const r = regions[i]!
      return (
        r.refName === w.refName &&
        Math.abs(r.start - w.start) < tolerance &&
        Math.abs(r.end - w.end) < tolerance
      )
    }) &&
    Math.abs(view.bpPerPx * view.width - totalBp) < tolerance
  )
}

/**
 * #stateModel LinearSyntenyView
 * extends
 * - [LinearComparativeView](../linearcomparativeview)
 */
export default function stateModelFactory(pluginManager: PluginManager) {
  return types
    .compose(
      'LinearSyntenyView',
      baseModel(pluginManager),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearSyntenyView'),
        /**
         * #property/
         */
        drawCIGAR: true,
        /**
         * #property/
         */
        drawCIGARMatchesOnly: false,
        /**
         * #property
         */
        drawCurves: true,
        /**
         * #property
         */
        drawLocationMarkers: false,
        /**
         * #property
         * used for initializing the view from a session snapshot. tracks is
         * 2D — outer index is the level (the gap between views[i] and
         * views[i+1]), so a 3-way view has two entries.
         * example:
         * ```json
         * {
         *   views: [
         *     { loc: "chr1:1-100", assembly: "hg38", tracks: ["genes"] },
         *     { loc: "chr1:1-100", assembly: "mm39" },
         *     { loc: "chr1:1-100", assembly: "rn7" }
         *   ],
         *   tracks: [["hg38_vs_mm39_synteny"], ["mm39_vs_rn7_synteny"]]
         * }
         * ```
         */
        init: types.frozen<LinearSyntenyViewInit | undefined>(),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      importFormSyntenyTrackSelections:
        observable.array<ImportFormSyntenyTrack>(),
    }))
    .views(self => ({
      /**
       * #getter
       */
      get hasSomethingToShow() {
        return self.views.length > 0 || !!self.init
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Whether to show a loading indicator instead of the import form or view
       */
      get showLoading() {
        return self.isLoading || (!self.initialized && self.hasSomethingToShow)
      },
      /**
       * #getter
       * Whether to show the import form
       */
      get showImportForm() {
        return !self.hasSomethingToShow
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      importFormRemoveRow(idx: number) {
        self.importFormSyntenyTrackSelections.splice(idx, 1)
      },
      /**
       * #action
       */
      clearImportFormSyntenyTracks() {
        self.importFormSyntenyTrackSelections.clear()
      },
      /**
       * #action
       */
      setImportFormSyntenyTrack(arg: number, val: ImportFormSyntenyTrack) {
        self.importFormSyntenyTrackSelections[arg] = val
      },
      /**
       * #action
       */
      setDrawCurves(arg: boolean) {
        self.drawCurves = arg
      },
      /**
       * #action
       */
      setDrawCIGAR(arg: boolean) {
        self.drawCIGAR = arg
      },
      /**
       * #action
       */
      setDrawCIGARMatchesOnly(arg: boolean) {
        self.drawCIGARMatchesOnly = arg
      },
      /**
       * #action
       */
      setDrawLocationMarkers(arg: boolean) {
        self.drawLocationMarkers = arg
      },
      /**
       * #action
       */
      showAllRegions() {
        for (const view of self.views) {
          view.showAllRegionsInAssembly()
        }
      },
      /**
       * #action
       */
      setInit(init?: LinearSyntenyViewInit) {
        self.init = init
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      async exportSvg(opts: ExportSvgOptions) {
        const { renderToSvg } =
          await import('./svgcomponents/SVGLinearSyntenyView.tsx')
        const html = await renderToSvg(self as LinearSyntenyViewModel, opts)
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const { saveAs } = await import('file-saver-es')

        if (opts.format === 'png') {
          const img = new Image()
          const svgBlob = new Blob([html], { type: 'image/svg+xml' })
          const url = URL.createObjectURL(svgBlob)
          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              const canvas = document.createElement('canvas')
              canvas.width = img.width
              canvas.height = img.height
              const ctx = canvas.getContext('2d')!
              ctx.drawImage(img, 0, 0)
              URL.revokeObjectURL(url)
              canvas.toBlob(blob => {
                if (blob) {
                  saveAs(blob, opts.filename || 'image.png')
                  resolve()
                } else {
                  reject(
                    new Error(
                      `Failed to create PNG. The image may be too large (${img.width}x${img.height}). Try reducing the view size or use SVG format.`,
                    ),
                  )
                }
              }, 'image/png')
            }
            img.onerror = () => {
              URL.revokeObjectURL(url)
              reject(new Error('Failed to load SVG for PNG conversion'))
            }
            img.src = url
          })
        } else {
          saveAs(
            new Blob([html], { type: 'image/svg+xml' }),
            opts.filename || 'image.svg',
          )
        }
      },
    }))
    .views(self => {
      const superHeaderMenuItems = self.headerMenuItems
      const superMenuItems = self.menuItems
      return {
        /**
         * #method
         * includes a subset of view menu options because the full list is a
         * little overwhelming
         */
        headerMenuItems() {
          return [
            ...superHeaderMenuItems(),
            {
              label: 'Square view',
              onClick: self.squareView,
              description:
                'Makes both views use the same zoom level, adjusting to the average of each',
              icon: CropFreeIcon,
              helpText:
                'Square view synchronizes the zoom levels of both genome views by calculating the average zoom level and applying it to both panels. This helps ensure features are displayed at comparable scales, making it easier to compare syntenic regions visually.',
            },
            {
              label: 'Re-order chromosomes',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  DiagonalizationProgressDialog,
                  {
                    handleClose,
                    model: self,
                  },
                ])
              },
              icon: ShuffleIcon,
              description:
                "Reorder and reorient query regions to minimize crossing lines, also known as 'diagonalizing'",
              helpText:
                "This operation 'diagonalizes' the data which algorithmically reorders and reorients chromosomes to minimize crossing synteny lines, creating a more diagonal pattern. This makes it easier to identify large-scale genomic rearrangements, inversions, and translocations. The process may take a few moments for large genomes.",
            },
            {
              label: 'Show...',
              subMenu: [
                {
                  label: 'Show all regions',
                  onClick: self.showAllRegions,
                  description: 'Show entire genome assemblies',
                  icon: VisibilityIcon,
                  helpText:
                    'This command will zoom out all views to display the entire genome assemblies. This is useful when you want to get a high-level overview of syntenic relationships across whole genomes or when you need to reset the view after zooming into specific regions.',
                },
                {
                  label: 'Show dynamic controls',
                  type: 'checkbox',
                  checked: self.showDynamicControls,
                  onClick: () => {
                    self.setShowDynamicControls(!self.showDynamicControls)
                  },
                  helpText:
                    'Toggle visibility of dynamic controls like opacity and minimum length sliders. These controls allow you to adjust synteny visualization parameters in real-time.',
                },
                {
                  label: 'Show CIGAR insertions/deletions',
                  checked: self.drawCIGAR,
                  type: 'checkbox',
                  description:
                    'If disabled, only shows the broad scale CIGAR match',
                  onClick: () => {
                    self.setDrawCIGAR(!self.drawCIGAR)
                  },
                  helpText:
                    'CIGAR strings encode detailed alignment information including matches, insertions, and deletions. When enabled, this option visualizes the fine-scale variations in syntenic alignments. Disable this for a cleaner view that shows only broad syntenic blocks.',
                },
                {
                  label: 'Show CIGAR matches only',
                  checked: self.drawCIGARMatchesOnly,
                  type: 'checkbox',
                  description:
                    'If enabled, hides the insertions and deletions in the CIGAR strings',
                  onClick: () => {
                    self.setDrawCIGARMatchesOnly(!self.drawCIGARMatchesOnly)
                  },
                  helpText:
                    'When comparing divergent genomes, showing all insertions and deletions can clutter the view. This option filters the CIGAR visualization to show only the matching regions, providing a cleaner view of conserved syntenic blocks while hiding small-scale indels.',
                },
                {
                  label: 'Show curved lines',
                  type: 'checkbox',
                  checked: self.drawCurves,
                  icon: Curves,
                  onClick: () => {
                    self.setDrawCurves(!self.drawCurves)
                  },
                  helpText:
                    'Toggle between straight lines and smooth bezier curves for synteny connections. Curved lines can make the visualization more aesthetically pleasing and may help reduce visual clutter when many syntenic regions are displayed. Straight lines provide a more direct representation.',
                },
                {
                  label: 'Show location markers',
                  type: 'checkbox',
                  checked: self.drawLocationMarkers,
                  description:
                    'Draw periodic markers to show location within large matches',
                  onClick: () => {
                    self.setDrawLocationMarkers(!self.drawLocationMarkers)
                  },
                  helpText:
                    'Location markers add periodic visual indicators along long syntenic blocks, helping you track position and scale within large conserved regions. This is particularly useful when examining very long syntenic matches where it can be difficult to gauge relative position.',
                },
              ],
            },
            {
              label: 'Link views',
              type: 'checkbox',
              checked: self.linkViews,
              icon: LinkIcon,
              onClick: () => {
                self.setLinkViews(!self.linkViews)
              },
              helpText:
                'When linked, panning and zooming in one genome view will automatically adjust the other view to maintain the correspondence shown by synteny lines. This makes it easier to explore syntenic regions interactively. Unlink views to navigate each genome independently.',
            },
            {
              label: 'Follow synteny',
              type: 'checkbox',
              checked: self.followSynteny,
              icon: CenterFocusStrongIcon,
              onClick: () => {
                self.setFollowSynteny(!self.followSynteny)
              },
              helpText:
                'When enabled, navigating in one genome view makes the other genome views display the corresponding lifted-over region: the currently visible region is mapped through the synteny alignments (including CIGAR-level detail and inversions) and the other views jump to exactly the mapped position and zoom level. If the corresponding region is on a chromosome not currently displayed, the view switches to it automatically. After fast scrolling or long jumps the other views may catch up with a slight delay, once the synteny track finishes rendering the newly loaded alignments.',
            },
            {
              label: 'Export SVG',
              icon: PhotoCameraIcon,
              onClick: (): void => {
                getSession(self).queueDialog(handleClose => [
                  ExportSvgDialog,
                  {
                    model: self,
                    handleClose,
                  },
                ])
              },
            },
          ]
        },
        /**
         * #method
         */
        menuItems() {
          return [
            ...superMenuItems(),
            {
              label: 'Export SVG',
              icon: PhotoCameraIcon,
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  ExportSvgDialog,
                  {
                    model: self,
                    handleClose,
                  },
                ])
              },
            },
          ]
        },
      }
    })
    .views(self => ({
      /**
       * #method
       * synteny-aware follow: after a navigation in `source`, lift its visible
       * window through each level's synteny alignments (exact per-base mapping
       * of every overlapping block, merged into one envelope per target
       * chromosome) and make the other sub-views display the mapped regions
       */
      async followFromView(source: unknown) {
        let sourceIndex = self.views.findIndex(v => v === source)
        if (sourceIndex === -1) {
          sourceIndex = self.views.findIndex(
            v => getPath(v) === getPath(source as (typeof self.views)[0]),
          )
        }
        if (sourceIndex === -1) {
          return
        }
        const sourceView = self.views[sourceIndex]!
        const center = sourceView.centerLineInfo
        if (!center?.refName) {
          return
        }

        // suppress echoes of navigation we applied ourselves
        const last = self.lastApplied.get(sourceView.id)
        if (
          last &&
          last.refName === center.refName &&
          Math.abs(last.coord - center.coord) < sourceView.bpPerPx * 2
        ) {
          return
        }

        const seq = self.incFollowSeq()
        self.incFollowing()
        try {
          const { assemblyManager } = getSession(self)
          const canonicalize = (asm: string, ref: string) =>
            assemblyManager.get(asm)?.getCanonicalRefName(ref) || ref
          const levelIndexes = self.levels.map(level => {
            const fwdFeatures: Feature[] = []
            const revFeatures: Feature[] = []
            for (const track of level.tracks as {
              displays: {
                type: string
                features?: Feature[]
                mateFeatures?: Feature[]
              }[]
            }[]) {
              for (const d of track.displays) {
                if (d.type === 'LinearSyntenyDisplay') {
                  fwdFeatures.push(...(d.features ?? []))
                  revFeatures.push(...(d.mateFeatures ?? []))
                }
              }
            }
            return {
              fwd: fwdFeatures.length
                ? buildLevelIndex(fwdFeatures, canonicalize)
                : undefined,
              rev: revFeatures.length
                ? buildLevelIndex(revFeatures, canonicalize)
                : undefined,
            }
          })

          const halfWidthBp = (sourceView.bpPerPx * sourceView.width) / 2
          const leftEdge = sourceView.pxToBp(0)
          const rightEdge = sourceView.pxToBp(sourceView.width)
          const start =
            leftEdge.refName === center.refName
              ? leftEdge.coord
              : center.coord - halfWidthBp
          const end =
            rightEdge.refName === center.refName
              ? rightEdge.coord
              : center.coord + halfWidthBp
          const targets = computeFollowTargets({
            sourceIndex,
            source: {
              refName: center.refName,
              start: Math.min(start, end),
              end: Math.max(start, end),
            },
            levelIndexes,
            maxCumulativePct: self.followCumulativePct,
          })

          for (const [index, windows] of targets) {
            const view = self.views[index]!
            if (matchesWindows(view, windows)) {
              continue
            }
            if (
              windows.length === 1 &&
              view.displayedRegions.some(r => r.refName === windows[0]!.refName)
            ) {
              const target = windows[0]!
              view.zoomTo((target.end - target.start) / view.width)
              view.centerAt((target.start + target.end) / 2, target.refName)
            } else {
              try {
                // multiple windows land on different chromosomes (or on a
                // chromosome not currently displayed): navToLocString sets
                // the displayed regions to the exact mapped segments and
                // tiles them across the view
                // eslint-disable-next-line no-await-in-loop
                await view.navToLocString(
                  windows
                    .map(
                      w =>
                        `${w.refName}:${Math.max(0, Math.floor(w.start))}-${Math.ceil(w.end)}`,
                    )
                    .join(' '),
                  view.assemblyNames[0],
                )
              } catch (e) {
                console.error(e)
              }
            }
            if (seq !== self.followSeq) {
              return
            }
            const applied = view.centerLineInfo
            if (applied?.refName) {
              self.setLastApplied(view.id, {
                refName: applied.refName,
                coord: applied.coord,
              })
            }
          }
        } finally {
          self.decFollowing()
        }
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          // re-apply follow when the synteny displays finish rendering new
          // data: a navigation may fire while the alignments covering the new
          // position are not loaded yet (e.g. a jump to a distant locus), in
          // which case followFromView finds no coverage and does nothing. once
          // the render catches up, this re-runs follow from the last
          // user-navigated view. a reaction is used (not autorun) so the
          // follow application itself runs untracked and cannot retrigger the
          // observer
          reaction(
            () => {
              if (!self.followSynteny || !self.lastNavSource) {
                return undefined
              }
              // include the filter threshold so that moving the slider
              // re-applies follow immediately, without waiting for a new
              // navigation
              return `${self.levels
                .map(level =>
                  level.tracks
                    .flatMap(
                      (track: {
                        displays: {
                          type: string
                          features?: Feature[]
                          mateFeatures?: Feature[]
                        }[]
                      }) =>
                        track.displays.flatMap(d =>
                          [
                            ...(d.features ?? []),
                            ...(d.mateFeatures ?? []),
                          ].map(f => f.id()),
                        ),
                    )
                    .join(','),
                )
                .join('|')}|pct=${self.followCumulativePct}`
            },
            sig => {
              if (sig === undefined) {
                return
              }
              const src = self.lastNavSource
              if (!src || self.isFollowing > 0) {
                return
              }
              if (!self.views.includes(src as (typeof self.views)[0])) {
                self.setLastNavSource(undefined)
                return
              }
              self.followFromView(src).catch((e: unknown) => {
                console.error(e)
              })
            },
            { name: 'LinearSyntenyViewFollowResync' },
          ),
        )
        addDisposer(
          self,
          autorun(
            async function initAutorun() {
              const { init, width } = self
              if (!width || !init) {
                return
              }

              const session = getSession(self)
              const { assemblyManager } = session

              try {
                // Wait for all assemblies to be ready and get their regions
                const assemblies = await Promise.all(
                  init.views.map(async v => {
                    const asm = await assemblyManager.waitForAssembly(
                      v.assembly,
                    )
                    if (!asm) {
                      throw new Error(`Assembly ${v.assembly} failed to load`)
                    }
                    return asm
                  }),
                )

                // Set up the views with displayed regions (not using init)
                self.setViews(
                  assemblies.map(asm => ({
                    type: 'LinearGenomeView' as const,
                    bpPerPx: 1,
                    offsetPx: 0,
                    hideHeader: true,
                    displayedRegions: asm.regions,
                  })),
                )

                // Wait for child views to initialize
                await Promise.all(
                  self.views.map(view => when(() => view.initialized)),
                )

                // Navigate to locations and show tracks on child views
                await Promise.all(
                  init.views.map(async (viewInit, idx) => {
                    const view = self.views[idx]
                    if (!view) {
                      return
                    }
                    if (viewInit.loc) {
                      await view.navToLocString(viewInit.loc, viewInit.assembly)
                    } else {
                      view.showAllRegionsInAssembly(viewInit.assembly)
                    }
                    if (viewInit.tracks) {
                      for (const trackId of viewInit.tracks) {
                        view.showTrack(trackId)
                      }
                    }
                  }),
                )

                // Show synteny tracks. tracks is string[][] — outer index is
                // the level (between views[i] and views[i+1]).
                if (init.tracks) {
                  for (let i = 0; i < init.tracks.length; i++) {
                    const ids = init.tracks[i]
                    if (!ids) {
                      continue
                    }
                    for (const trackId of ids) {
                      self.showTrack(trackId, i)
                    }
                  }
                }

                // Clear init state
                self.setInit(undefined)
              } catch (e) {
                console.error(e)
                session.notifyError(`${e}`, e)
                self.setInit(undefined)
              }
            },
            { name: 'LinearSyntenyViewInit' },
          ),
        )
      },
    }))
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const {
        init,
        drawCIGAR,
        drawCIGARMatchesOnly,
        drawCurves,
        drawLocationMarkers,
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(!drawCIGAR ? { drawCIGAR } : {}),
        ...(drawCIGARMatchesOnly ? { drawCIGARMatchesOnly } : {}),
        ...(!drawCurves ? { drawCurves } : {}),
        ...(drawLocationMarkers ? { drawLocationMarkers } : {}),
      } as typeof snap
    })
}
export type LinearSyntenyViewStateModel = ReturnType<typeof stateModelFactory>
export type LinearSyntenyViewModel = Instance<LinearSyntenyViewStateModel>
