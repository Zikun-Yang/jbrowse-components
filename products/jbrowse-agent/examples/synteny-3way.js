// examples/synteny-3way.js — 打开三基因组共线性视图
//
// LinearSyntenyView 的 model 继承自 LinearComparativeView,内部是 N 个
// 线性子视图 + N-1 个"level"(相邻子视图之间的共线性轨道层)。
// init 快照:
//   views: [{ loc, assembly, tracks? }]   — 每个基因组一行,数量任意
//   tracks: string[][]                    — 每个 level 的共线性 trackId 列表;
//                                           tracks[i] 画在 views[i] 和 views[i+1] 之间
// 技巧:把"锚点"基因组放中间,这样两个 level 都有轨道可画
// (本配置里所有 synteny track 都是 vs T2T-CHM13v2.0 的)。

const view = await jbrowse.openView('LinearSyntenyView', {
  init: {
    views: [
      { loc: 'chr1:10000000-20000000', assembly: 'GRCh38 (hg38)' },
      { loc: 'chr1:10000000-20000000', assembly: 'T2T-CHM13v2.0' },
      {
        loc: 'chr1_pat_hsa1:10000000-20000000',
        assembly: 'T2T-mPanPan1v2.0_pri',
      },
    ],
    tracks: [
      ['GRCh38__T2T-CHM13v2.0'], // level 0: views[0] ↔ views[1]
      ['mPanPan1v2.0-pri__T2T-CHM13v2.0'], // level 1: views[1] ↔ views[2]
    ],
  },
  settleMs: 8000, // 共线性轨道加载量大,多等一会
})

await jbrowse.screenshot('synteny-3way.png', { view: view.id })
return view
