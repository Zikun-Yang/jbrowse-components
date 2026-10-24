// M3 acceptance: adapter-level feature query + native SVG/PNG export + session export.
// Run: node run.mjs examples/features-and-export.js
const asm = 'T2T-mPanTro3v2.0_pri'
const trackId = 'T2T-mPanTro3v2.0_pri_RefSeq'
const refs = await jbrowse.refNames(asm)
const region = refs[0] + ':1000000-2000000'

// 1. data question without any UI: what genes are in this window?
const feats = await jbrowse.features(trackId, region, { assembly: asm })
const geneNames = feats.map(f => f.name).filter(Boolean).slice(0, 10)

// 2. set up a view and export it with JBrowse's own renderer (not screenshot)
await jbrowse.goto(region, { assembly: asm })
await jbrowse.showTrack(trackId)
await jbrowse.sleep(2000)
const svg = await jbrowse.exportView('m3-view.svg')
const png = await jbrowse.exportView('m3-view.png')

// 3. export the session (view + open track + region all restorable)
const sessionExport = await jbrowse.exportSession('m3-session.json')

return {
  featureCount: feats.length,
  geneNames,
  svg,
  png,
  session: sessionExport,
}
