// M2 acceptance: show a track, inspect its display config, change it, screenshot.
// Run: node run.mjs examples/track-and-config.js
const asm = 'T2T-mPanTro3v2.0_pri'
const refs = await jbrowse.refNames(asm)
await jbrowse.goto(refs[0] + ':1000000-2000000', { assembly: asm })

// show the RefSeq gene track (exact id — every assembly has its own RefSeq)
const trackId = 'T2T-mPanTro3v2.0_pri_RefSeq'
const shown = await jbrowse.showTrack(trackId)
await jbrowse.sleep(2000)
const before = await jbrowse.screenshot('m2-before.png')

// what can this display be configured with?
const cfg = await jbrowse.displayConfig(trackId)

// make a visible change: collapse overlapping gene glyphs
let changed = null
if (cfg.setters.includes('setDisplayMode')) {
  changed = { slot: 'displayMode', from: cfg.current.displayMode, to: 'compact' }
  await jbrowse.setConfig(trackId, 'displayMode', 'compact')
}
await jbrowse.sleep(1500)
const after = await jbrowse.screenshot('m2-after.png')

return {
  shown: { id: shown.id, open: shown.open },
  setterCount: cfg.setters.length,
  sampleSetters: cfg.setters.slice(0, 15),
  changed,
  before,
  after,
}
