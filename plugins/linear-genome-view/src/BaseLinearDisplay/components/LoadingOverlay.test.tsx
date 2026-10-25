import { render } from '@testing-library/react'

import LoadingOverlay from './LoadingOverlay.tsx'

// Contract anchor for @jbrowse/agent-sdk: the SDK's waitForIdle() assumes
// the idle LoadingOverlay keeps its "Loading" text node MOUNTED and hides it
// purely via CSS (opacity/display/visibility). If that changes upstream, the
// SDK's isShown() filter must be updated — this test failing is the signal.
// The live/browser-side equivalent is jbrowse.selfTest().
describe('LoadingOverlay (agent-sdk contract anchor)', () => {
  it('keeps the "Loading" decoy text mounted when idle, hidden via CSS opacity', () => {
    const { getByText } = render(
      <LoadingOverlay height={100}>
        <div />
      </LoadingOverlay>,
    )
    // decoy text stays in the DOM…
    const text = getByText('Loading')
    expect(text).toBeTruthy()
    // …but the overlay is not marked as actively loading
    expect(text.parentElement?.getAttribute('data-testid')).not.toBe(
      'loading-overlay',
    )
    // …and hiding happens via an opacity:0 rule (which the SDK's isShown()
    // ancestor walk knows how to detect)
    const cssText = Array.from(document.styleSheets)
      .flatMap(s => {
        try {
          return Array.from(s.cssRules).map(r => r.cssText)
        } catch {
          return []
        }
      })
      .join('\n')
    expect(cssText).toMatch(/opacity:\s*0/)
  })

  it('marks the overlay with data-testid only while actually loading', () => {
    const { container, queryByTestId } = render(
      <LoadingOverlay statusMessage="Computing feature layout" height={100}>
        <div />
      </LoadingOverlay>,
    )
    expect(queryByTestId('loading-overlay')).toBeTruthy()
    expect(container.textContent).toContain('Computing feature layout')
  })
})
