# JBrowse Agent SDK 设计文档

> 状态：草案 v1（2026-08-12)
> 本文档描述让 AI agent 以"可编程用户"身份使用 JBrowse 的完整方案。
> 当前阶段：仅设计，未实现。

---

## 修订记录

### v1.1(2026-08-12,M1 实施前的简化，已与作者确认）

v1 中的若干组件被有意砍掉，以 `products/jbrowse-agent/README.md` 为准：

- **不做 MCP server**:AI(coding agent）直接写脚本文件 → Bash 执行
  runner → 读 stdout JSON → Read 截图。AI 用 CLI 的方式用 JBrowse。
- **无状态脚本模型**：每段脚本从头写、自足执行。handle 注册表整个删
  掉——状态活在浏览器页面里，脚本间通过重新查询衔接。
- **执行通道只留 Playwright（且用 playwright-core + 系统 Chrome)**:
  headless Node 管线（jbrowse-img 复用）从方案中拿掉，真正的区别在于
  "attach 活 session" vs "自建 session",CI 批量出图 jbrowse-img 本身已
  覆盖。WS 桥同样推迟。
- **不做 undo/事务**。

保留的核心：Code-as-Interface 范式、查询纯数据/操作低风险的 API 分
层、每次执行自动附状态摘要、错误即教学、字段精简纪律、§7 风险表（除已
删组件相关项）与 §8 验证策略依然有效。M1 实际交付见 README "当前范围"。

---

## 1. 背景与目标

JBrowse 2 是一个高交互、状态复杂、探索性强的可视化工具。人类用户通过
点击、拖拽、搜索来使用它；AI agent 若要走"GUI automation"路线（模拟点
击、读 DOM)，脆弱且低效。

本方案的目标：让 AI 像写 Python 脚本一样，用少量、语义化的代码探索基因
组数据，形成闭环：

```
AI 写代码 → 在 JBrowse session 上下文中执行 → 返回 {结果, 状态摘要, 截图} → AI 继续推理
```

典型场景：

- "看看现在这个 session 里有哪些 track，哪些开着"
- "跳到 BRCA1，把 ClinVar track 打开，截图给我看"
- "这个区域 coverage 异常高的地方标出来"
- "比较人和黑猩猩在这个区域的 synteny，用 identity 模式着色"

## 2. 核心范式：Code-as-Interface

### 2.1 为什么不是"一堆窄 MCP 工具"

基因组浏览是探索性任务，固定工具集有死穴：

1. **组合性差**——"找出所有 coverage > 30 的特征并高亮"需要循环+过滤+操
   作，窄工具做不了循环。
2. **能力边界固定**——JBrowse 的 MST 状态树有几百个 action/view，逐一包
   成工具是无底洞；每加一个能力都要改 schema、重新部署。
3. **上下文膨胀**——几十个工具定义常驻上下文，每个只有几行描述，AI 反
   而用不好。
4. **不能即兴**——探索的价值在于 AI 发现意外的组合方式。

### 2.2 方案形态

不给 AI 工具列表，给 AI 一个**编程环境 + 一份类型化 API 文档**:

- MCP 保留，但退化为传输层，只暴露 3 个元工具：
  `execute_code` / `read_docs` / `get_resource`
- 所有能力通过代码表达。上下文里只有 3 个工具定义，而不是 50 个。
- SDK 的 `.d.ts` 类型定义即 AI 的 API 文档（AI 读类型比读 prose 准）,
  辅以按需读取的 skill 配方文档（渐进式披露）。

### 2.3 关键设计原则

| 原则 | 含义 |
|---|---|
| 查询返回纯数据 | AI 问状态时拿到冻结 JSON，不需要解引用 |
| 操作返回 handle | AI 永不直接持有 MST 对象，只持有 runtime 发的"票据" |
| 字段宁少勿错 | 返回 5 个 AI 决策需要的字段，而非整个 config |
| 过滤在 SDK 内做 | `tracks({ open: true })` 一次拿答案，不浪费 AI 上下文 |
| 状态变更走 MST action | facade 薄但严格，禁止绕过 action 改 observable |
| 错误即教学 | 报错信息里直接给出正确用法 |
| 每次执行附带状态摘要 | 像 IPython 的 `Out[n]`，操作结果即时可见 |

## 3. 总体架构

### 3.1 代码归属（本 monorepo，不另开 repo)

```
packages/agent-sdk/        ← AI-facing facade，纯库，环境无关
products/jbrowse-agent/    ← MCP server + agent runtime（可执行）
packages/core, plugins/    ← 零改动
```

依赖方向单向：`agent-sdk → @jbrowse/core`,core 不知道 sdk 存在。

放 monorepo 的原因：

1. **类型同步**——facade 依赖 core 的 MST 类型；workspace 依赖让 core 的
   类型变更在编译期打爆 sdk,facade 漂移不过夜。
2. **复用 jbrowse-img 的 headless 渲染管线**(setupEnv + renderRegion)。
3. **复用测试设施**(jsdom 环境、jest-fetch-mock、image snapshot)。

### 3.2 架构图

```
                 LLM
                  │  MCP（3 个元工具）
                  ▼
        ┌───────────────────┐
        │  jbrowse-agent    │  products/jbrowse-agent
        │  (agent runtime)  │  持久 session、handle 注册表、缓存
        └─────────┬─────────┘
                  │
        ┌─────────┴──────────┐
        │   执行通道（可换）   │
        │ Playwright │ Headless │ WS 桥 │
        └─────────┬──────────┘
                  ▼
        ┌───────────────────┐
        │   @jbrowse/agent-sdk │  packages/agent-sdk
        │   (facade)         │
        └─────────┬─────────┘
                  ▼
        JBrowse Session (MST store)
```

### 3.3 执行通道

三种通道下 **AI 看到的 SDK 完全一致**，只是代码运行的位置和 session 来
源不同：

| 形态 | 代码在哪跑 | 通道 | session 来源 | 场景 | 优先级 |
|---|---|---|---|---|---|
| Playwright | 浏览器页面上下文 | CDP `page.evaluate` | 活页面（dev server / 用户实例） | 本地开发 | ① 先做 |
| Headless | Node `vm` 沙箱 | 进程内 | runtime 自建 headless session | 批量、CI、数据问答 | ② |
| WebSocket 桥 | 浏览器页面上下文 | WS | 远程用户的活 session | 生产/远程 | ③ 有需求再做 |

**Playwright 形态细节**:

1. `jbrowse-agent` 启动时用 Playwright 打开（或 attach 到）JBrowse 页面。
2. agent-sdk 经 `page.addInitScript()` 注入页面，挂在隔离命名空间
   `window.__jbrowseAgent`。
3. `execute_code(code)` → 代码包成 `async (jbrowse) => {...}` →
   `page.evaluate` → 返回值（JSON 可序列化部分）带回 Node 侧。
4. 截图：`page.locator(viewSelector).screenshot()`，以 MCP image content
   返回。

**持久化：handle 注册表**。`page.evaluate` 每次是独立调用，局部变量留不
住。SDK 内部把真实 MST 对象存进页面侧注册表 `{"h1": realView}`，返回给
AI 的是只含 `{ __handle: "h1" }` 的代理；后续调用按 handle 找回真对象。
注册表生命周期由 runtime 管理。即使 AI 的代码上下文丢失，只要 handle id
还在对话历史里，状态就能接上。

**Headless 形态细节**：复用 jbrowse-img 的 `setupEnv`(node-canvas 模拟、
fetch polyfill),runtime 自己 new 一个 plugin manager + session,AI 代码
在 Node `vm` 沙箱里跑（沙箱 context 长期存活，变量真持久），渲染走
`renderRegion` 出 PNG。

## 4. SDK API 设计

### 4.1 三层心智模型

| 层 | 方法 | 返回 |
|---|---|---|
| 查询（纯数据，无副作用） | `views()` `tracks()` `region()` … | 冻结 JSON |
| 操作（改状态） | `goto()` `addTrack()` `setConfig()` `screenshot()` | handle + 状态摘要 |
| 元（自我描述） | `help()` `capabilities()` | 文档字符串 |

### 4.2 查询侧（PoC 首交付，纯读）

```ts
// ─── 顶层入口 ───
const jbrowse /* 由执行环境注入 */

// ─── View ───
await jbrowse.views()
// => ViewInfo[]
interface ViewInfo {
  id: string
  type: string              // 'LinearGenomeView' | 'LinearSyntenyView' | ...
  displayName: string
  assemblyNames: string[]
  regions: RegionInfo[]     // 线性 view 的当前显示区间
  trackIds: string[]        // 此 view 中显示的 track
}
interface RegionInfo {
  assemblyName: string
  refName: string
  start: number
  end: number
}

await jbrowse.view()          // 当前活跃 view 的 handle
// handle 上也有查询方法：
await view.region()           // => RegionInfo[]（便捷方法，拍平单区域时返回字符串如 "chr1:10000-20000"）
await view.tracks()           // => TrackInfo[]（仅本 view 显示的）
await view.assembly()         // => { name: 'hg38' }

// ─── Track ───
await jbrowse.tracks()
// => TrackInfo[] —— session 中所有已配置的 track（含未打开的）
interface TrackInfo {
  id: string
  name: string
  type: string              // 'FeatureTrack' | 'VariantTrack' | 'QuantitativeTrack' | ...
  assemblyNames: string[]
  open: boolean             // 是否在任一 view 中显示
  adapter?: string          // 'BamAdapter' | 'VcfTabixAdapter' | ...
  category?: string[]
}

// 过滤器——SDK 内做过滤，AI 一次拿答案
await jbrowse.tracks({ open: true })
await jbrowse.tracks({ name: /chip.?seq/i })
await jbrowse.tracks({ type: 'VariantTrack', assembly: 'hg38' })

// 单个 track 细节（惰性，需要时才取）
const t = await jbrowse.track('variants')   // 按 id 或名字模糊匹配，歧义时报错并列出候选
await t.describe()
// => TrackInfo & { configSummary: Record<string, unknown>, visibleIn: string[] }

// ─── Assembly ───
await jbrowse.assemblies()
// => [{ name: 'hg38', aliases: ['GRCh38'], refNameCount: 25 }, ...]
```

字段设计纪律：

- 每个接口首批字段控制在 5~8 个；想要更多走 `describe()`。
- 所有返回对象冻结（`Object.freeze` 递归），AI 代码改它不会影响真状态。
- 大结果集自动分页：`tracks()` 超过 50 条时返回前 50 条 +
  `{ truncated: true, total: 230, hint: 'use tracks({name: ...}) to filter' }`。

### 4.3 状态摘要（每次执行自动附带）

```ts
interface ExecutionResult {
  result: unknown          // AI 代码的返回值（JSON 序列化部分）
  state: StateDigest       // 执行后的状态摘要
  error?: AgentError
}

interface StateDigest {
  activeView?: {
    id: string
    type: string
    region: string          // 拍平的 locstring，如 "chr13:32315086-32400268"
  }
  openTracks: string[]      // track 名字列表（截断到 20 个）
  message?: string          // 最后操作的一句话结果，如 "navigated to BRCA1"
}
```

价值：AI 操作完立刻知道环境变成什么样，不用多花一轮查询；也是"操作了
但什么都没显示"这类问题的天然检查点。

### 4.4 操作侧（第二阶段）

```ts
// 导航——语义级，内部做 text search
await jbrowse.goto('BRCA1')
await view.goto('chr1:10000-20000')

// track 操作
await view.addTrack('variants')           // id/名字模糊匹配，同 track()
await view.hideTrack('variants')
await t.setConfig('colorMode', 'identity') // 对应 display 的 config slot
                                           // （如 synteny 的 strand/identity/rainbow）

// 数据查询——不经过 UI，直接走 adapter 层
const feats = await t.features('chr1:10000-20000', { limit: 100 })
// => SimpleFeature 的 JSON 数组（拍平 uniqueId/refName/start/end/name/score/...）

// 截图——视觉反馈一等公民
await jbrowse.screenshot()                 // 当前活跃 view
await jbrowse.screenshot({ view: v, width: 1200 })
// => MCP image content（PNG）
```

异步纪律：所有改状态的操作内部 **await 渲染稳定**(view 的
`renderingDone`/数据加载完成信号）后再返回，避免"goto 完立刻截图截到空
白"这类竞态。这是 facade 必须吞掉的复杂度，不能暴露给 AI。

### 4.5 元/自描述

```ts
await jbrowse.help()            // 所有方法的签名 + 一句话说明
await jbrowse.help('tracks')    // 单个方法的详细签名、参数、示例
await jbrowse.capabilities()    // 当前 session 支持什么（哪些 view 类型、哪些 plugin 注册了 agent descriptor）
```

`help()` 由注册的方法描述符自动生成（见 §6.1)，与实现永不脱节。

### 4.6 错误设计

```ts
interface AgentError {
  code: string        // 'TRACK_NOT_FOUND' | 'AMBIGUOUS_TRACK' | 'INVALID_LOCATION' | ...
  message: string     // 发生了什么
  hint: string        // 正确用法——错误即教学
  candidates?: string[]  // 如 AMBIGUOUS_TRACK 时的候选列表
}
```

例：AI 写 `addTrack('vcf')` 匹配到 3 个 track，错误返回：

```
AMBIGUOUS_TRACK: 'vcf' matches 3 tracks
hint: use a more specific name or the exact track id
candidates: ['population_vcf (VariantTrack)', 'clinvar_vcf (VariantTrack)', 'tumor_vcf (VariantTrack)']
```

AI 看到就能自我纠正，不需要人介入。

## 5. 使用示例（端到端剧本)

### 例 1：探索 session（纯查询——PoC 范围内）

AI 收到的任务："看看现在能打开什么 track，哪些开着"。

```js
// 第一轮：总览
await jbrowse.tracks({ open: true })
```

返回：

```json
{
  "result": [
    { "id": "genes", "name": "RefSeq genes", "type": "FeatureTrack", "open": true, "adapter": "Gff3TabixAdapter" }
  ],
  "state": {
    "activeView": { "id": "v1", "type": "LinearGenomeView", "region": "chr1:10000-20000" },
    "openTracks": ["RefSeq genes"]
  }
}
```

```js
// 第二轮：有什么可开的
await jbrowse.tracks({ open: false })
```

```json
{
  "result": [
    { "id": "variants", "name": "ClinVar variants", "type": "VariantTrack", "open": false },
    { "id": "coverage", "name": "WGS coverage", "type": "QuantitativeTrack", "open": false }
  ],
  "state": { "...": "..." }
}
```

两轮单行代码，AI 完整回答了问题。

### 例 2：导航 + 开 track + 截图（第二阶段）

任务："跳到 BRCA1，把 ClinVar 打开，给我看看"。

```js
await jbrowse.goto('BRCA1')
await jbrowse.view().addTrack('ClinVar')
await jbrowse.screenshot()
```

返回：state digest 显示 `region: "chr13:32315086-32400268 (hg38)"`,
`openTracks` 含 ClinVar，外加一张 PNG。AI 看图后可以继续："track 太矮
了"→ `await t.setConfig('height', 200)` → 再截图。

### 例 3：数据查询驱动决策

任务："这个区域 coverage 异常高的地方在哪"。

```js
const region = await jbrowse.view().region()   // "chr1:10000-20000"
const cov = await jbrowse.track('coverage')
const feats = await cov.features(region)
// feats 在 AI 代码的 JS 环境里，可以直接算：
const threshold = 30
const hot = feats.filter(f => f.score > threshold)
hot.length
```

循环、过滤、阈值计算全部在 AI 写的代码里完成——这是窄工具做不到的，
也是 Code-as-Interface 的核心论据。

### 例 4：synteny 比较（贴近当前开发）

任务："人和黑猩猩这个区域的 synteny，按 identity 着色"。

```js
const syn = await jbrowse.views()         // 找到 LinearSyntenyView
await jbrowse.view('synteny1').goto('chr1:5000000-6000000')
const disp = await jbrowse.view('synteny1').tracks()
await disp[0].setConfig('colorMode', 'identity')   // 对应最近做的着色模式功能
await jbrowse.screenshot({ view: 'synteny1' })
```

### 例 5：自我纠错

```js
await jbrowse.view().addTrack('vcf')
// error: AMBIGUOUS_TRACK ... candidates: [...]
await jbrowse.view().addTrack('clinvar_vcf')   // AI 从 candidates 里选，自我纠正
```

## 6. 可扩展性

### 6.1 Plugin descriptor 体系（最重要的扩展点)

JBrowse 的一切皆 plugin,SDK 必须尊重这一点。核心 SDK 只懂通用概念
(view/track/region);**每种 view 类型、display 类型可以注册一个
agent descriptor**:

```ts
interface AgentDescriptor {
  forType: string                          // 'LinearSyntenyView'
  summarize?: (model: unknown) => Record<string, unknown>
                                           // 贡献 ViewInfo 的额外字段，如 { colorMode, followSynteny }
  actions?: Record<string, AgentAction>    // 该类型特有的操作
  doc?: string                             // help() 里展示的说明
}
```

例：`plugin-linear-comparative-view` 注册 descriptor，让
`views()` 对 synteny view 多返回 `colorMode`、`rowCount` 字段，并新增
`setColorMode()` 操作。SDK core 不需要知道 synteny 的存在。

收益：

- 新插件自动被 AI"看见"(`capabilities()` 列出），无需改 SDK。
- `help()` 从 descriptor 自动生成，文档与实现不脱节。
- 没有 descriptor 的插件有通用 fallback（读 config slots)，不至于完全
  不可控。

### 6.2 演进路径：从 SDK 到意图工具到 DSL

```
阶段 1  查询侧 SDK（纯数据）            ← PoC
阶段 2  操作侧 SDK + handle + 截图
阶段 3  高层意图工具（可选）:find_gene() compare_samples()
        —— 在 SDK 之上组合常用配方，仍是代码
阶段 4  domain skills 配方库（markdown 文档，AI 按需读）
阶段 5  （远期/实验）领域 DSL:
        compare(sample="tumor", control="normal", region="TP53")
        DSL 编译为 SDK 调用序列
```

每阶段独立可用，后阶段不推翻前阶段。阶段 3 的依据应来自真实使用数据
（AI 反复手写同样的代码组合 → 固化成函数）。

### 6.3 多 session / 多实例

- runtime 支持命名 session:`execute_code(code, { session: 'tumor-analysis' })`。
- handle 注册表按 session 隔离。
- 远期支持 headless 批量：一个 runtime 管 N 个 headless session，并行截
  图（CI 场景）。

### 6.4 只读模式

runtime 可配置 `readOnly: true`：操作侧方法全部禁用（抛
`READ_ONLY_MODE` 错误），只开放查询 + 截图。用于把 SDK 暴露给不完全信
任的调用方，或接在用户生产实例上做"AI 助手"时防止误操作。

## 7. 风险点与缓解

| # | 风险 | 影响 | 缓解 |
|---|---|---|---|
| 1 | **facade 漂移**:core 的 MST model 变更，facade 悄悄过时 | AI 生成能编译但运行时爆炸的代码 | monorepo workspace 依赖（编译期暴露）+ contract 测试：录制的 session 状态下跑全部查询方法 |
| 2 | **AI 误用 API**：绕过 action、猜错参数 | 状态损坏、MST 保护报错 | facade 是唯一入口（AI 摸不到原始 session)；错误即教学（§4.6);`help()` 运行时可查 |
| 3 | **异步竞态**:goto 后未渲染完就截图 | 截到空白/旧画面，AI 误判 | 所有操作 await 渲染稳定信号；`screenshot({ waitFor: 'idle' })` 默认开启 |
| 4 | **大结果集撑爆上下文**:tracks() 返回几百条 | token 浪费、AI 读错 | 分页 + 截断 + hint(§4.2)；字段精简纪律 |
| 5 | **截图成本**：每次执行都回传图片 | token 成本高 | 截图默认只在显式调用时返回；digest 是纯文本 |
| 6 | **任意代码执行的安全面**:AI 代码在页面/Node 里跑 | 理论上可访问页面内一切 | 威胁模型明确：MCP server 本身就是信任边界；Node 形态用 `vm` 沙箱 + 白名单全局；浏览器形态代码本来就是同源的；提供只读模式（§6.4) |
| 7 | **插件异质性**：自定义插件的 view/track 类型 SDK 不认识 | AI 面对未知类型能力降级 | descriptor fallback：通用 config slot 读写总是可用；descriptor 缺失在 capabilities() 里显式标注 |
| 8 | **handle 泄漏/失效**:view 被关闭后 handle 悬空 | AI 操作报错 | handle 解引用时校验，失效报 `STALE_HANDLE` 并 hint 重新获取；注册表随 session 生命周期清理 |
| 9 | **session 被用户并行修改**：人也在操作同一页面 | AI 的 digest 过期 | digest 每次执行后重新生成；操作前不缓存状态，一律现取 |
| 10 | **MST fork 的行为差异**:`@jbrowse/mobx-state-tree` 与上游有分歧 | 文档/经验不适用 | facade 内聚所有 MST 交互，AI 层无感；contract 测试兜底 |

## 8. 验证策略

- **contract 测试**（对应风险 1)：在 jest 里构建标准 session（参照现有
  `jbrowse-web` 测试的 session 构建方式），对每个查询方法断言返回结
  构。core 类型变更 → sdk 编译错/测试红。
- **golden digest 测试**：固定 session 状态下，状态摘要输出快照。
- **image snapshot**：复用 jbrowse-web 的 `jest-image-snapshot`，验证
  screenshot 通道。
- **剧本回放测试**：把 §5 的示例剧本做成集成测试，既验证功能也验证
  "AI 视角的体验"没退化。

## 9. 里程碑

| 里程碑 | 内容 | 验收 |
|---|---|---|
| M1 PoC | 查询侧 API(§4.2)+ 状态摘要（§4.3)+ Playwright 通道跑通 | AI 能完成例 1；返回结构有 contract 测试 |
| M2 | 操作侧（goto/addTrack/setConfig)+ handle 注册表 + 截图 + 渲染稳定等待 | AI 能完成例 2、例 5；image snapshot 测试 |
| M3 | 数据查询（features)+ headless 通道 | AI 能完成例 3；CI 里 headless 出图 |
| M4 | descriptor 体系 + help()/capabilities() + skill 配方文档 | synteny 场景（例 4）通过 descriptor 实现，SDK core 无 synteny 代码 |
| M5（远期） | 意图工具、DSL 实验、WS 桥、只读模式 | 按真实使用数据决定 |

## 10. 开放问题

1. **MCP resources 是否值得做**:`tracks()` 这类查询是否同时暴露为 MCP
   resource（免代码直接读）？倾向：M1 不做，保持单一入口，避免两套心智。
2. **多 agent 并发控制**：两个 agent 同时操作一个 session 的冲突语义。
   当前假设单 agent。
3. **undo/事务**:AI 一串操作后想"撤销刚才所有改动"，是否需要
   session snapshot/restore(MST 的 `getSnapshot`/`applySnapshot` 天然支
   持，成本低，可能 M2 就值得做）。
4. **WS 桥的认证**：远程形态接入用户实例时的鉴权方案，随 M5 再定。
5. **digest 的详细程度**：多少信息算"够用但不吵"？需要真实 AI 使用反
   馈来调整，M1 先保守（region + openTracks + message)。
