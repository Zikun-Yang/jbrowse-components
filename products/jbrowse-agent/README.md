# jbrowse-agent

让 AI（或人）用一段普通 JS 脚本探索一个运行中的 JBrowse session。

没有 MCP、没有常驻服务：每次执行 = 写一段脚本 → 跑 runner → 读 stdout 的 JSON
→ （可选）Read 截图。状态活在 JBrowse 页面里，脚本本身无状态。

## 快速开始

```bash
# 1. 启动 jbrowse-web dev server（另一个终端）
cd products/jbrowse-web && pnpm start

# 2. 安装依赖（workspace 根目录，一次即可）
pnpm install

# 3. 跑示例
cd products/jbrowse-agent
node run.mjs examples/explore.js
```

stdout 输出一个 JSON envelope:

```json
{
  "ok": true,
  "result": { "assemblies": ["..."], "views": ["..."], "...": "..." },
  "state": {
    "viewCount": 1,
    "activeView": {
      "id": "...",
      "type": "LinearGenomeView",
      "region": "chr1:1-10000 (hg19)"
    },
    "openTracks": ["RefSeq genes"]
  }
}
```

`state`（状态摘要）由 runner 在每次执行后自动附加，脚本不用自己查。

## 写脚本

脚本是 async 函数体：可以用顶层 `await`，用 `return` 决定 `result`
字段。脚本里有一个全局 `jbrowse` 对象：

```js
// 查：返回冻结的纯 JSON
await jbrowse.views()
await jbrowse.viewTypes() // 可打开的 view 类型(运行时从插件管理器枚举)
await jbrowse.tracks() // 全部 track（默认上限 50)
await jbrowse.tracks({ open: true }) // 只看开着的
await jbrowse.tracks({ name: 'clinvar' }) // 名字/ID 模糊过滤
await jbrowse.track('variants') // 单个；歧义时报错并给候选
await jbrowse.track('FC').info // 这个 track 的说明（markdown 原文）
await jbrowse.track('FC').infoText // 同上，去掉 markdown（适合塞进 prompt）
await jbrowse.chartDrawers() // 图表 drawer 目录（内置 + 插件）
await jbrowse.chartDrawer('rawBoxPlot') // 目录里的一条
await jbrowse.chartSpecSchema() // renderer.spec 的词汇表（kind/dataForm 等）
await jbrowse.assemblies()
await jbrowse.refNames('T2T-mPanTro3v2.0_pri') // 参考序列名(T2T 是 accession,不是 chr1!)

// 操作（M1 低风险集合）
await jbrowse.goto('chr1:1000000-2000000', { assembly: 'GRCh38 (hg38)' })
// 导航;无线性 view 时自动开一个
await jbrowse.openView() // 显式开 LinearGenomeView,返回 ViewInfo

// 操作（M2:track 与显示配置）
await jbrowse.showTrack('T2T-mPanTro3v2.0_pri_RefSeq') // 开 track(默认第一个线性 view)
await jbrowse.hideTrack('RefSeq') // 关 track
await jbrowse.displayConfig('RefSeq') // 探查:有哪些 set* 可配、当前值
await jbrowse.setConfig('RefSeq', 'displayMode', 'compact') // 改配置
await jbrowse.setConfig('synteny', 'colorBy', 'identity') // synteny 着色同理

// 数据查询与导出（M3)
await jbrowse.features('RefSeq', 'chr1_hap1_hsa1:1000000-2000000', {
  assembly: 'T2T-mPanTro3v2.0_pri',
})
// 直接查 adapter,不用开 track 不用渲染
await jbrowse.exportView('/tmp/view.svg') // JBrowse 原生导出(非截图):矢量 SVG
await jbrowse.exportView('/tmp/view.png') // 同一渲染管线的 PNG 栅格化
await jbrowse.exportSession('/tmp/session.json') // 完整 session 状态(JSON,可恢复)
await jbrowse.screenshot('out.png') // 截图存盘，返回绝对路径。
// 默认截整个 workspace 区(所有 view 一起,
// 不含 app 顶栏/侧栏);截图前自动等待
// 加载完成(waitForIdle,{ noWait: true } 跳过);
// { view: viewId } 只截指定 view,
// { fullPage: true } 截整页,
// { selector: css } 截任意元素
await jbrowse.waitForIdle() // 等待 workspace 无加载指示(失败/空也算完成);
// 返回 { idle, waitedMs, stillLoading? }
await jbrowse.sleep(500) // 等异步渲染

// 元
jbrowse.help() // 所有方法一句话说明
jbrowse.help('tracks') // 单个方法详细签名
```

错误自带"正确用法"，AI 可以自我纠正：

```
AMBIGUOUS_TRACK: 'vcf' matches 3 tracks
hint: use a more specific name or the exact track id
(error.candidates = ['population_vcf', 'clinvar_vcf', 'tumor_vcf'])
```

## 图表：从 track 说明到 drawer / spec

FeatureChartTrack 的能力对这个 SDK 是**可枚举**的，不是靠 AI 猜 drawer 名字。一段真实的对话式用法（脚本一次跑完，AI 读 stdout 的 JSON 决定下一步）：

```js
// 1. 读 track 说明：它是什么数据、谁维护的、口径是什么
//    （脚本是 async 函数体：顶层 await，return 的值进 stdout 的 result）
const fc = await jbrowse.track('fc_raw_box')
return { info: fc.infoText ?? fc.info } // 没写说明的 track 不会出现这两个字段
```

```js
// 2. 看有哪些 drawer：dataShape 决定哪个能画这份数据（'grouped-values' 等）
return jbrowse.chartDrawers()
// [{ name: 'rawBoxPlot', displayName: 'Box plot', dataShape: 'grouped-values',
//    builtin: true, description: '…' }, …,
//  { name: 'samplePlugin/heatmap', builtin: false, … }]
```

```js
// 3. 写配置：要么给 drawer 名字（+ drawerOptions），要么用声明式 spec
const schema = jbrowse.chartSpecSchema()
// schema.kindDataForms = { box: ['grouped-values', …], bar: ['category-values'], … }
return schema.kindDataForms.box // 先确认这个 kind 接受哪种 data.form
```

```json
{
  "type": "FeatureChartTrack",
  "trackId": "fc_spec_box",
  "adapter": { "type": "FeatureChartTabixAdapter", "uri": "bars.tsv.gz" },
  "renderer": {
    "type": "FeatureChartRenderer",
    "drawer": "spec",
    "spec": {
      "specVersion": 1,
      "kind": "box",
      "data": { "form": "grouped-values", "path": "tissues" },
      "axes": { "yLabel": "expression" }
    }
  }
}
```

```js
// 4. 校验：配置加载后绘图失败不会炸 track，而是画一个说明原因的占位
return jbrowse.tracks({ type: 'FeatureChartTrack' })
```

规则：

- `chartDrawer(name)` 名字打错时抛 `UNKNOWN_DRAWER`，`error.candidates`
  是完整目录
- `builtin: false`
  表示实现来自已加载的插件（可能覆盖了同名内置 drawer)，不要因为名字眼熟就假定行为
- drawer 的 `optionsSchema` 只是**提示**（它读哪些 `drawerOptions`
  键），不是校验契约；写错了不会报错，只是不生效
- `chartDrawers()` / `chartSpecSchema()`
  在没有加载 feature-chart 的页面（例如嵌入的环形基因组视图）抛
  `FEATURE_CHART_UNAVAILABLE`
- 同一份 spec 在 canvas 与 Plotly 两个后端渲染结果一致；「同一个 track 换了后端图形就变了」是 bug，不是配置问题

## Runner 参数

```
node run.mjs <script.js> [--url URL] [--headed] [--chrome PATH]
                         [--timeout MS] [--keep-open]
```

| 参数               | 默认                    | 说明                                                |
| ------------------ | ----------------------- | --------------------------------------------------- |
| `--url`            | `http://localhost:3000` | JBrowse 地址（可以是任何部署的实例）                |
| `--headed`         | headless                | 显示浏览器窗口，方便观察 AI 操作                    |
| `--chrome`         | 自动探测                | Chrome/Chromium 路径，也可用 `CHROME_PATH` 环境变量 |
| `--timeout`        | 120000                  | 页面加载和 session 就绪的超时（NFS 上首次启动慢）   |
| `--script-timeout` | 90000                   | 脚本执行超时，防导航挂死                            |
| `--out-dir`        | /tmp/jbrowse-agent-out  | 所有文件输出的限制目录（安全边界）                  |
| `--keep-open`      | 关                      | 脚本结束后保持浏览器，便于人工检查现场              |

调试输出（页面 console、截图路径）走 stderr;stdout 永远是单个 JSON。

## 给 AI 的用法（Claude Code 等 coding agent)

1. 把脚本写到临时文件，如 `/tmp/jbrowse-task.js`
2. `node products/jbrowse-agent/run.mjs /tmp/jbrowse-task.js`(Bash)
3. 读 stdout 的 JSON 回答数据问题
4. 需要"看"时：脚本里
   `await jbrowse.screenshot('/tmp/shot.png')`，然后用 Read 工具读那张 PNG

API 的完整类型文档在 `packages/agent-sdk/index.d.ts`；设计背景见
`packages/agent-sdk/DESIGN.md`（注意：其中 MCP/handle 持久化方案已被简化掉，以本 README 的无状态脚本模型为准）。

## 当前范围与已知边界

- ✅ 查询：views / viewTypes / tracks / track / assemblies / refNames / digest；
  `tracks()`/`track()` 带
  `info`/`infoText`（track 说明的 markdown 原文与纯文本，没写说明时字段不出现）
- ✅ 图表目录：chartDrawers / chartDrawer /
  chartSpecSchema（运行时从插件经理枚举，内置 + 插件 drawer；没有 feature-chart 的页面报
  `FEATURE_CHART_UNAVAILABLE`）
- ✅ 低风险操作：goto（自动开 view + 自动切 workspace 路由）/ openView /
  screenshot / sleep
- ✅ track 与显示配置（M2):showTrack / hideTrack / displayConfig /
  setConfig（调 display 的 set\* action，含发现机制）
- ✅ 数据查询与导出（M3):features(CoreGetFeatures RPC,不开 track 不渲染）/
  exportView(JBrowse 原生 SVG/PNG，经下载捕获）/ exportSession
- ⬜ plugin descriptor 体系、skill 配方文档 —— M4
- `goto` 后的"渲染稳定"目前是固定等待（默认 1s)，复杂视图可加大 `settleMs`
  或追加 `sleep`；更可靠的是 `waitForIdle()`——screenshot/
  exportView 已内置该等待（默认最长 30s，超时不报错但会在 digest 里带 warning)。空闲判定是 DOM 启发式：workspace 内无
  `[role=progressbar]` 且无 "Loading..." 文本，连续静默 500ms 才算空闲
- `screenshot`
  默认截整个 workspace 区（`[data-testid="workspace-views"]`, 所有 view 一起，不含 app 顶栏/侧栏）；旧部署没有这个 testid 时回退 dockview 的
  `.dv-dockview` 类。单个 view 用 `{ view: viewId }`，整页用
  `{ fullPage: true }`。元素截图会自动处理内部滚动裁剪：截图前把目标子树内所有 overflow 裁剪容器临时展开到完整内容尺寸并按需放大 viewport(≤8000×12000)，截完恢复——高 track、多行 synteny 的溢出部分不会被丢掉
- `ViewInfo.visible` 才是"正在看的窗口";`regions` 可能覆盖整条染色体
- `displayConfig` 探查的是
  `view.tracks[i].displays[0]`（真 display 模型）;track 条目本身的 setPinned/setMinimized 不在其中
- `info`/`infoText` 由页面里的 `window.__jbrowseTrackInfo`
  提供（jbrowse-web 安装，与 About 弹窗同一个
  `resolveTrackInfo`）——所以 agent 眼里的 track 说明和用户在 UI 里看到的**必然一致**；其他宿主没有这个桥时字段直接缺席
- `info` 只在 `formatAbout.showInfo: false`
  时仍然可读（UI 隐藏 ≠ 数据隐藏)；想看"面板会不会显示"没有接口，那是 UI 决定
- 远程 assembly 的导航受网络影响，超时走 `--script-timeout` 报错自愈

## 远程部署的实例能用吗？

能。`window.JBrowseSession`
在 jbrowse-web 里是无条件暴露的（不区分 dev/prod 构建），所以任何部署的 jbrowse-web 站点都可以：

```bash
node run.mjs my-script.js --url https://your-remote-jbrowse.example.com
```

注意语义：runner 是"AI 自己开浏览器访问这个网站"——每次都是全新session（不带任何用户的登录态/localStorage)。它**不是**控制某个用户已经打开的浏览器页面；那种场景需要 WS 桥（远期里程碑）。数据在远程服务器上时导航和 features 查询受网络影响，必要时加大
`--script-timeout`。

## 安全模型

AI 写的脚本在目标页面的 JS 上下文里**全权限执行**，三个文件桥 (screenshot/saveFile/download）对页面里的所有脚本可见。约定与防护：

- **只把 `--url`
  指向你信任的部署**。指向恶意站点时，站点自己的 JS 可以调用桥函数——所以：
- **所有文件写入被限制在 `--out-dir`**（默认 `/tmp/jbrowse-agent-out`): `..`
  逃逸被拒绝，绝对路径按相对路径重定基到 out-dir 内，下载文件名经过 sanitize。脚本里的
  `'a/b.png'` 会落到 `<out-dir>/a/b.png`。
- **浏览器每次都是全新 profile**（无 cookie/登录态），所以脚本读不到任何用户凭据。这也意味着：如果未来实现
  `--attach`（连你日常登录的浏览器）,OAuth
  token 等凭据将暴露给脚本——那是个需要重新评估安全模型的时刻。
- **间接 prompt injection 是残留风险**：远程数据（feature 属性、hub
  config）会进入 AI 上下文，恶意内容可能诱导 AI 写出恶意脚本。当前没有技术缓解，靠"可信数据源 + 重要操作人工审脚本"的流程纪律。
- **查询行为会留在远程服务器日志里**（查了哪个区域/基因），涉及未发表数据时自行评估。
