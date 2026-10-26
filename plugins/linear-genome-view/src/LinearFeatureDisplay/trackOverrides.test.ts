import { getConf } from '@jbrowse/core/configuration'

import {
  pruneTrackOverrides,
  trackOverrideActions,
  trackOverrideViews,
  withTrackOverrides,
} from './trackOverrides.ts'

import type { TrackOverride } from './trackOverrides.ts'

jest.mock('@jbrowse/core/configuration', () => ({
  getConf: jest.fn(),
}))

const mockGetConf = getConf as jest.MockedFunction<typeof getConf>

// trackOverrideViews calls getConf, which expects a configuration prop
function host(props: Record<string, unknown> = {}) {
  return { configuration: {}, ...props } as any
}

const overrides: readonly TrackOverride[] = [
  {
    trackProp: 'trackShowLabels',
    getter: 'showLabels',
    slot: 'showLabels',
    action: 'toggleShowLabels',
    kind: 'toggle',
  },
  {
    trackProp: 'trackDisplayMode',
    getter: 'displayMode',
    slot: 'displayMode',
    action: 'setDisplayMode',
    kind: 'set',
  },
]

describe('trackOverrides', () => {
  beforeEach(() => {
    mockGetConf.mockReset()
  })

  describe('trackOverrideViews', () => {
    test('reads the override when it is set, without touching the config', () => {
      const views = trackOverrideViews(
        {},
        overrides,
        host({ trackShowLabels: false }),
      ) as any
      expect(views.showLabels).toBe(false)
      expect(mockGetConf).not.toHaveBeenCalled()
    })

    test('falls back to the renderer config slot', () => {
      mockGetConf.mockReturnValue(true)
      const self = host()
      const views = trackOverrideViews({}, overrides, self) as any
      expect(views.showLabels).toBe(true)
      expect(mockGetConf).toHaveBeenCalledWith(self, ['renderer', 'showLabels'])
    })

    test('does not clobber a view that is already defined', () => {
      const views = trackOverrideViews(
        { showLabels: 'custom' },
        overrides,
        host(),
      )
      expect((views as any).showLabels).toBe('custom')
    })
  })

  describe('trackOverrideActions', () => {
    test('toggle actions flip the value the getter reports', () => {
      const self: any = { trackShowLabels: true }
      // the real model has the generated getter installed on the instance
      Object.defineProperty(self, 'showLabels', {
        configurable: true,
        get: () => self.trackShowLabels,
      })
      self.configuration = {}
      const actions = trackOverrideActions({}, overrides, self) as any
      actions.toggleShowLabels()
      expect(self.trackShowLabels).toBe(false)
      actions.toggleShowLabels()
      expect(self.trackShowLabels).toBe(true)
    })

    test('set actions store the given value', () => {
      const self: any = { configuration: {} }
      const actions = trackOverrideActions({}, overrides, self) as any
      actions.setDisplayMode('compact')
      expect(self.trackDisplayMode).toBe('compact')
    })

    test('does not clobber an action that is already defined', () => {
      const setDisplayMode = () => {}
      const actions = trackOverrideActions(
        { setDisplayMode },
        overrides,
        host(),
      ) as any
      expect(actions.setDisplayMode).toBe(setDisplayMode)
    })
  })

  describe('withTrackOverrides', () => {
    test('merges the override over the renderer config', () => {
      expect(
        withTrackOverrides(
          overrides,
          host({ trackShowLabels: false }),
          { showLabels: true, displayMode: 'normal', other: 1 },
        ),
      ).toEqual({ showLabels: false, displayMode: 'normal', other: 1 })
    })

    test('keeps the config value when there is no override', () => {
      expect(
        withTrackOverrides(overrides, host(), { showLabels: true, other: 1 }),
      ).toEqual({ showLabels: true, displayMode: undefined, other: 1 })
    })
  })

  describe('pruneTrackOverrides', () => {
    test('drops unset overrides and keeps everything else', () => {
      expect(
        pruneTrackOverrides(overrides, {
          trackShowLabels: undefined,
          trackDisplayMode: 'compact',
          other: 1,
        }),
      ).toEqual({ trackDisplayMode: 'compact', other: 1 })
    })

    test('keeps explicit falsy values', () => {
      expect(
        pruneTrackOverrides(overrides, {
          trackShowLabels: false,
          trackDisplayMode: undefined,
        }),
      ).toEqual({ trackShowLabels: false })
    })
  })
})
