// Example: navigate to a region and capture what the view looks like.
// Opens a LinearGenomeView automatically when the session has none.
// T2T assemblies use accession-style ref names, so discover one first.
// Run: node run.mjs examples/goto-and-shoot.js
const asm = 'T2T-mPanTro3v2.0_pri'
const refs = await jbrowse.refNames(asm)
const loc = refs[0] + ':1000000-2000000'
await jbrowse.goto(loc, { assembly: asm })
const saved = await jbrowse.screenshot('jbrowse-chimp.png')
return { loc, saved, digest: jbrowse.digest() }
