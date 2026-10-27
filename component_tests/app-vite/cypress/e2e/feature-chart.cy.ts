/**
 * FeatureChart E2E — runs the real app (`@jbrowse/react-app2`) against a
 * bgzip+tabix fixture, **through the RPC worker**:
 * `App.tsx` sets `configuration.rpc.defaultDriver: 'WebWorkerRpcDriver'` for
 * this fixture and the first test asserts it, so a broken worker path cannot
 * silently fall back to `MainThreadRpcDriver` and still pass.
 *
 * Track order in the fixture view (and therefore in the DOM) is
 * `[named drawer, spec, unknown drawer, invalid spec]`, so a test targets a
 * display with `.eq(index)` instead of guessing from text.
 *
 * Kept deliberately small (the issue's flake constraint): one page load per
 * test, testid assertions, one screenshot at the end.
 */

const FIXTURE = '/?e2e=feature-chart'
const CHART_DISPLAY = '[data-testid=feature-chart-display]'
const BLOCK_DONE = '[data-testid^="prerendered_canvas"][data-testid$="_done"]'
const MAXIMIZE = '[data-testid=feature-chart-maximize]'

const TRACK = { drawer: 0, spec: 1, unknownDrawer: 2, brokenSpec: 3 } as const

type JbrowseState = {
  session: {
    rpcManager: { mainConfiguration: { defaultDriver?: string } }
  }
  jbrowse: { tracks: { trackId?: string }[] }
}

function visitFixture(query = '') {
  cy.visit(`${FIXTURE}${query}`)
  // the worker render of at least one block is the "app is usable" signal
  return cy.get(BLOCK_DONE, { timeout: 60000 })
}

/**
 * Hover a chart so its display mounts the maximize affordance, then open the
 * dialog. `x = 110` lands inside the chart anchored at the first gene of the
 * fixture file, which is the first chart in every fixture track.
 */
function openMaximizeDialog(track: number) {
  cy.get(CHART_DISPLAY, { timeout: 60000 })
    .eq(track)
    .trigger('mousemove', 110, 90, { force: true })
  cy.get(CHART_DISPLAY)
    .eq(track)
    .find(MAXIMIZE, { timeout: 20000 })
    .click({ force: true })
  return cy.get('[role=dialog]', { timeout: 20000 })
}

describe('FeatureChart tracks (real worker RPC)', () => {
  it('renders charts from a tabix adapter without a main-thread fallback', () => {
    visitFixture()

    cy.get(CHART_DISPLAY).should('have.length', 4)
    // the spec track renders through the same worker path
    cy.get(BLOCK_DONE).its('length').should('be.greaterThan', 0)

    cy.window().then(win => {
      const state = (win as unknown as { __jbrowseState: JbrowseState })
        .__jbrowseState
      expect(
        state.session.rpcManager.mainConfiguration.defaultDriver,
        'RPC driver',
      ).to.equal('WebWorkerRpcDriver')
      expect(
        state.jbrowse.tracks
          .map(track => track.trackId)
          .filter(id => id?.startsWith('fc_e2e')),
      ).to.have.length(4)
    })
  })

  it('renders formatAbout.info in the About dialog', () => {
    visitFixture('&about=1')

    // WP1: the Track info card sits above the configuration dump
    cy.get('[role=dialog]', { timeout: 60000 }).should(
      'contain.text',
      'Track info',
    )
    // markdown is rendered, not printed literally: `**{{track.name}}**`
    cy.get('[role=dialog] strong', { timeout: 20000 }).should(
      'contain.text',
      'FC · named drawer (rawBoxPlot)',
    )
    cy.get('[role=dialog]').should(
      'contain.text',
      'This sentence comes from formatAbout.info and proves the Track info card renders.',
    )
    // the site-wide fallback must not win over the track-level text
    cy.get('[role=dialog]').should(
      'not.contain.text',
      'Site-wide fallback text',
    )
  })

  it('shows a placeholder and an Alert for an unknown drawer', () => {
    visitFixture()
    openMaximizeDialog(TRACK.unknownDrawer)
      .find('[role=alert]', { timeout: 20000 })
      .should('contain.text', 'Unknown FeatureChart drawer "nopeNotADrawer"')
      // the message names what is available, so the typo is fixable from it
      .and('contain.text', 'precomputedBoxPlot')
    // the track itself survived: its display is still mounted
    cy.get(CHART_DISPLAY).should('have.length', 4)
  })

  it('lists the problems of an invalid spec instead of a blank chart', () => {
    visitFixture()
    openMaximizeDialog(TRACK.brokenSpec)
    cy.get('[data-testid=feature-chart-spec-error]', { timeout: 20000 })
      .should('contain.text', 'spec.data.form')
      .and('contain.text', 'grouped-values')
    cy.get('[role=dialog]').find('[role=alert]').should('exist')
    // the description / buttons still work
    cy.get('[role=dialog]').should('contain.text', 'Zoom to region')
  })

  it('maximizes, switches to the interactive view and exports non-empty files', () => {
    visitFixture()
    openMaximizeDialog(TRACK.drawer)

    // static canvas view is the default: opening the dialog must not pull the
    // Plotly chunk
    cy.get('[data-testid=feature-chart-maximize-canvas]', {
      timeout: 20000,
    }).should('exist')

    // canvas → PNG: assert bytes, not a browser download folder
    cy.get('[data-testid=feature-chart-export-png]').click()
    cy.get('[data-testid=feature-chart-export-status]')
      .should('have.attr', 'data-format', 'png')
      .and('have.attr', 'data-filename')
      .and('match', /^fc_e2e_drawer-.+-static\.png$/)
      .then(status => {
        expect(Number(status.attr('data-bytes'))).to.be.greaterThan(0)
      })

    // interactive view: same model, Plotly traces, true vector SVG
    cy.get('[data-testid=feature-chart-view-interactive]').click()
    cy.get('[data-testid=feature-chart-maximize-plotly]', {
      timeout: 30000,
    }).should('exist')

    cy.get('[data-testid=feature-chart-export-svg]').click()
    cy.get('[data-testid=feature-chart-export-status]')
      .should('have.attr', 'data-format', 'svg')
      .and('match', /^fc_e2e_drawer-.+-interactive\.svg$/)
      .then(status => {
        expect(Number(status.attr('data-bytes'))).to.be.greaterThan(0)
      })

    cy.screenshot('feature-chart-maximize')
  })
})
