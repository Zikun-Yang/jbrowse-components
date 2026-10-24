import { readFileSync } from 'node:fs'
import path from 'node:path'

// Source sentinels for the host-app internals that @jbrowse/agent-sdk relies
// on at runtime. A rename/removal upstream fails loudly here instead of
// silently degrading agent output (empty viewTypes, mistimed screenshots).
// The live/browser-side equivalent is jbrowse.selfTest().
const root = path.resolve(__dirname, '../../..')
const read = (p: string) => readFileSync(path.join(root, p), 'utf8')

describe('agent-sdk host contracts (source sentinels)', () => {
  it('workspace area keeps data-testid="workspace-views"', () => {
    // default screenshot() scope
    expect(
      read('packages/app-core/src/ui/App/TiledViewsContainer.tsx'),
    ).toContain('workspace-views')
  })

  it('view containers keep data-testid="view-container-<id>"', () => {
    // screenshot({ view }) scope
    expect(read('packages/app-core/src/ui/App/ViewContainer.tsx')).toContain(
      'view-container-',
    )
  })

  it('track rendering containers keep data-testid="trackRenderingContainer-"', () => {
    expect(
      read(
        'plugins/linear-genome-view/src/LinearGenomeView/components/TrackRenderingContainer.tsx',
      ),
    ).toContain('trackRenderingContainer')
  })

  it('server-side blocks keep the state fields waitForIdle() reads', () => {
    const src = read(
      'plugins/linear-genome-view/src/BaseLinearDisplay/models/serverSideRenderedBlock.ts',
    )
    for (const field of ['filled', 'isRenderingPending', 'blockStatusMessage']) {
      expect(src).toContain(field)
    }
  })

  it('LoadingOverlay keeps its decoy text mounted and opacity-hidden', () => {
    const src = read(
      'plugins/linear-genome-view/src/BaseLinearDisplay/components/LoadingOverlay.tsx',
    )
    expect(src).toContain('Loading')
    expect(src).toMatch(/opacity:\s*0/)
  })
})
