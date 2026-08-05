import { useMemo, useRef, useState } from 'react'

import { PrerenderedCanvas } from '@jbrowse/core/ui'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { observer } from 'mobx-react'

import { flatbushItemToFeatureData } from '../types.ts'
import PileupTooltip from './PileupTooltip.tsx'
import { makeRect } from './util.ts'

import type { ColorBy, FilterBy, SortedBy } from '../../shared/types.ts'
import type { FlatbushItem } from '../types.ts'
import type { Region } from '@jbrowse/core/util/types'
import type { BaseLinearDisplayModel } from '@jbrowse/plugin-linear-genome-view'

const PileupRendering = observer(function PileupRendering(props: {
  blockKey: string
  displayModel: BaseLinearDisplayModel
  width: number
  height: number
  regions: Region[]
  bpPerPx: number
  sortedBy?: SortedBy
  colorBy?: ColorBy
  filterBy?: FilterBy
  items: FlatbushItem[]
  flatbush: ArrayBufferLike
  featureNames?: Record<string, string>
}) {
  const {
    blockKey,
    displayModel,
    width,
    height,
    regions,
    bpPerPx,
    sortedBy,
    colorBy,
    filterBy,
    flatbush,
    items,
    featureNames = {},
  } = props
  const { refName } = regions[0]!
  const flatbush2 = useMemo(() => Flatbush.from(flatbush), [flatbush])
  const { featureIdUnderMouse } = displayModel

  const region = regions[0]!
  const ref = useRef<HTMLDivElement>(null)
  const [mouseIsDown, setMouseIsDown] = useState(false)
  const [movedDuringLastMouseDown, setMovedDuringLastMouseDown] =
    useState(false)
  const [itemUnderMouse, setItemUnderMouse] = useState<FlatbushItem>()
  const [featureNameUnderMouse, setFeatureNameUnderMouse] = useState<string>()
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>()
  const highlightedFeature = featureIdUnderMouse
  const highlightedRect = highlightedFeature
    ? displayModel.getFeatureByID(blockKey, highlightedFeature)
    : undefined

  const highlight = highlightedRect
    ? makeRect(highlightedRect, 0, region, bpPerPx)
    : undefined

  const canvasWidth = Math.ceil(width)
  const isClickable = itemUnderMouse || featureIdUnderMouse
  return (
    <div
      ref={ref}
      data-testid={[
        'pileup-overlay',
        sortedBy?.type,
        colorBy?.type,
        colorBy?.tag,
        filterBy?.tagFilter?.tag,
      ]
        .filter(f => !!f)
        .join('-')}
      style={{
        position: 'relative',
        width: canvasWidth,
        height,
        cursor: isClickable ? 'pointer' : 'default',
      }}
      onMouseLeave={() => {
        setItemUnderMouse(undefined)
        setFeatureNameUnderMouse(undefined)
        setMousePosition(undefined)
        displayModel.setFeatureIdUnderMouse(undefined)
      }}
      onMouseDown={(_event: React.MouseEvent) => {
        setMouseIsDown(true)
        setMovedDuringLastMouseDown(false)
      }}
      onMouseUp={() => {
        setMouseIsDown(false)
      }}
      onMouseMove={event => {
        if (!ref.current) {
          return
        }
        if (mouseIsDown) {
          setMovedDuringLastMouseDown(true)
        }
        const rect = ref.current.getBoundingClientRect()
        const offsetX = event.clientX - rect.left
        const offsetY = event.clientY - rect.top
        const px = region.reversed ? width - offsetX : offsetX
        const clientBp = region.start + bpPerPx * px
        const search = flatbush2.search(
          offsetX,
          offsetY,
          offsetX + 1,
          offsetY + 1,
        )
        const item = search.length ? items[search[0]!] : undefined
        setItemUnderMouse(item)
        const featureId = displayModel.getFeatureOverlapping(
          blockKey,
          clientBp,
          offsetY,
        )
        const featureName = featureId ? featureNames[featureId] : undefined
        setFeatureNameUnderMouse(featureName)
        setMousePosition(
          item || featureName
            ? {
                x: event.clientX,
                y: event.clientY,
              }
            : undefined,
        )
        displayModel.setFeatureIdUnderMouse(featureId)
      }}
      onClick={() => {
        if (!movedDuringLastMouseDown) {
          if (itemUnderMouse) {
            const session = getSession(displayModel)
            const view = getContainingView(displayModel)
            const sourceRead = featureIdUnderMouse
              ? featureNames[featureIdUnderMouse]
              : undefined
            const featureData = flatbushItemToFeatureData(
              itemUnderMouse,
              refName,
              sourceRead,
            )
            if (isSessionModelWithWidgets(session)) {
              const featureWidget = session.addWidget(
                'BaseFeatureWidget',
                'baseFeature',
                {
                  featureData,
                  view,
                  track: getContainingTrack(displayModel),
                },
              )
              session.showWidget(featureWidget)
            }
          } else if (featureIdUnderMouse) {
            displayModel
              .selectFeatureById(featureIdUnderMouse)
              .catch((e: unknown) => {
                console.error(e)
                getSession(displayModel).notifyError(`${e}`, e)
              })
          }
        }
      }}
    >
      <PrerenderedCanvas
        {...props}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
        }}
      />
      {highlight ? (
        <div
          style={{
            position: 'absolute',
            backgroundColor: '#0003',
            pointerEvents: 'none',
            ...highlight,
          }}
        />
      ) : null}
      {(itemUnderMouse || featureNameUnderMouse) && mousePosition ? (
        <PileupTooltip
          item={itemUnderMouse}
          featureName={featureNameUnderMouse}
          refName={refName}
          mousePosition={mousePosition}
        />
      ) : null}
    </div>
  )
})

export default PileupRendering
