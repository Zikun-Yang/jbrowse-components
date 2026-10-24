// Example: explore what a fresh JBrowse session has to offer.
// Run: node run.mjs examples/explore.js
const [assemblies, views, openTracks, hiddenTracks] = [
  await jbrowse.assemblies(),
  await jbrowse.views(),
  await jbrowse.tracks({ open: true }),
  await jbrowse.tracks({ open: false }),
]

return {
  assemblies,
  views,
  openTracks,
  hiddenTrackCount: hiddenTracks.length,
  sampleHidden: hiddenTracks.slice(0, 10),
}
