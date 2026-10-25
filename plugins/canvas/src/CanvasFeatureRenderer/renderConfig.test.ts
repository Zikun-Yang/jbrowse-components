import { readConfObject } from '@jbrowse/core/configuration'

import { readCachedConfig } from './renderConfig.ts'

import type { CachedConfig } from './renderConfig.ts'

jest.mock('@jbrowse/core/configuration', () => ({
  readConfObject: jest.fn(() => 'evaluated-color'),
}))

const mockReadConfObject = readConfObject as jest.MockedFunction<
  typeof readConfObject
>

describe('CachedConfig', () => {
  const mockFeature = {
    get: (key: string) => (key === 'name' ? 'TestFeature' : undefined),
  }
  const config = {} as any

  beforeEach(() => {
    mockReadConfObject.mockClear()
  })

  describe('readCachedConfig', () => {
    it('returns the cached value when the slot is not a callback', () => {
      const cached: CachedConfig<string> = {
        value: 'cachedColor',
        isCallback: false,
      }

      const result = readCachedConfig(
        cached,
        config,
        'color1',
        mockFeature as any,
      )

      expect(result).toBe('cachedColor')
      expect(mockReadConfObject).not.toHaveBeenCalled()
    })

    it('evaluates a callback per feature with the feature as context', () => {
      const cached: CachedConfig<string> = { isCallback: true }

      const result = readCachedConfig(
        cached,
        config,
        'color1',
        mockFeature as any,
      )

      expect(result).toBe('evaluated-color')
      expect(mockReadConfObject).toHaveBeenCalledWith(config, 'color1', {
        feature: mockFeature,
      })
    })

    it('supports nested config paths', () => {
      const cached: CachedConfig<number> = { isCallback: true }

      readCachedConfig(
        cached,
        config,
        ['labels', 'fontSize'],
        mockFeature as any,
      )

      expect(mockReadConfObject).toHaveBeenCalledWith(
        config,
        ['labels', 'fontSize'],
        { feature: mockFeature },
      )
    })

    it('returns a cached number value', () => {
      const cached: CachedConfig<number> = { value: 10, isCallback: false }

      expect(
        readCachedConfig(cached, config, 'height', mockFeature as any),
      ).toBe(10)
    })
  })
})
