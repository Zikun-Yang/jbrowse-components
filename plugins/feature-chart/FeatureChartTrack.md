# FeatureChartTrack 需求与实现 TODO

> 文档用途：记录 `FeatureChartTrack`
> 的设计方案、数据格式和实现任务清单。状态：已落地并接入三个产品（jbrowse-web /
> jbrowse-desktop / jbrowse-react-app）。
>
> **契约速查请先读
> [`ARCHITECTURE.md`](./ARCHITECTURE.md)**：drawer 目录形状、失败语义、"renderer 只从自己 config 读"的原因都在那里。本文保留需求、数据格式与配置示例。

---

## 1. 背景与目标

在 LinearGenomeView 中新增一种 track：`FeatureChartTrack`。它可以在任意基因组坐标位置绘制一个自定义数据可视化小图标（chart），例如：

- 在基因位置绘制该基因在不同组织中的表达量 box plot
- 在 variant 位置绘制跨样本统计图
- 任意以坐标为锚点的自定义绘图

核心需求：

1. 数据以文件形式提供，支持坐标索引和随机读取
2. 一个文件只放一种图表类型
3. 一个 chart 占文件中的一行
4. chart 的像素高度由配置 `chartHeight` 决定
5. chart 的像素宽度由配置 `chartWidth` 决定，与 `start/end` 无关
6. chart 的水平位置由 `start/end` 和 `align`（`left`/`right`/`center`）共同决定
7. 自定义绘图逻辑通过注册 drawer 函数实现
8. 支持 Markdown 描述文本，并支持模板变量
9. hover 时显示 maximize 图标，点击弹出详情窗口展示放大图和描述

---

## 2. 数据格式

### 2.1 推荐格式：Tabix 索引 TSV + JSON payload

每行一个 chart，列结构：

```tsv
chrom\tstart\tend\tname\tdata\tdescription
```

- `chrom` / `start` / `end`：chart 的锚定坐标区间，也用于 Tabix 索引查询
- `name`：chart 标签（如基因名）
- `data`：JSON 字符串，包含该 chart 所需的全部数据
- `description`：Markdown 文本，可能包含模板变量，用于详情窗口展示

**示例：**

```tsv
chrom	start	end	name	data	description
chr17	43044295	43125364	BRCA1	{"tissues": {"Brain": [1,2,3,4,5], "Liver": [0.5,1,1.5]}}	**{{name}}** expression across {{tissueCount}} tissues.
chr17	7668402	7687550	TP53	{"tissues": {"Brain": [3,4,5], "Liver": [1,1,2]}}	**{{name}}** expression across {{tissueCount}} tissues.
```

建索引：

```bash
bgzip expression.tsv
tabix -p bed expression.tsv.gz
```

### 2.2 JSON 内容约定

`data`
列的 JSON 内部结构由具体 drawer 决定，adapter 不做解析，原样透传给 drawer。

内置五个 drawer。下表是 **当前** 的内置集合，权威来源是
`listFeatureChartDrawers()`（见
[`ARCHITECTURE.md`](./ARCHITECTURE.md#drawer-目录)）：

| Drawer               | 数据形状（`dataShape`） | 输入格式       | 说明                                      | 默认尺寸 |
| -------------------- | ----------------------- | -------------- | ----------------------------------------- | -------- |
| `precomputedBoxPlot` | `matrix`                | `data.boxes`   | 处理后数据：预计算 boxplot 统计量（默认） | 120×180  |
| `rawBoxPlot`         | `tissues`               | `data.tissues` | 原始数据：boxplot，自动计算五数概括       | 120×180  |
| `rawViolinPlot`      | `tissues`               | `data.tissues` | 原始数据：violin plot，用 KDE 估计分布    | 120×180  |
| `barPlot`            | `matrix`                | `data.bars`    | 每个分类一个柱子                          | 120×180  |
| `histogram`          | `series`                | `data.values`  | 单组数值的频数直方图                      | 120×180  |

未显式配置 `drawer` 时使用
`precomputedBoxPlot`。配置了不存在的名字不会让 track 报错：canvas 与放大弹窗都会显示一个可读的占位块，并在 console 里
`warn` 一次。

#### `precomputedBoxPlot`：标准 boxplot 模板格式（推荐）

直接提供每个 box 的预计算统计量，格式通用、可复现：

```json
{
  "boxes": [
    { "name": "Brain", "min": 0.1, "q1": 1, "median": 2, "q3": 3, "max": 5 },
    {
      "name": "Liver",
      "min": 0.2,
      "q1": 1.2,
      "median": 2.2,
      "q3": 3.2,
      "max": 5.2,
      "color": "#e15759"
    }
  ]
}
```

字段说明：

- `name`：X 轴分类标签
- `min` / `q1` / `median` / `q3` /
  `max`： whisker 下端、下四分位、中位、上四分位、whisker 上端
- `color`（可选）：自定义颜色，例如 `"#e15759"`

#### `rawBoxPlot`：原始值数组

如果只有原始观测值，`rawBoxPlot` 会自动按组计算五数概括：

```json
{
  "tissues": {
    "Brain": [1, 2, 3, 4, 5],
    "Liver": [0.5, 1, 1.5]
  }
}
```

#### `rawViolinPlot`：原始值数组 violin plot

输入格式与 `rawBoxPlot` 完全相同，但 `rawViolinPlot`
会用高斯核密度估计（KDE）画出每个组的分布形状：

```json
{
  "tissues": {
    "Brain": [1, 2, 3, 4, 5],
    "Liver": [0.5, 1, 1.5, 2, 2.5]
  }
}
```

每组会画成一个左右对称的 violin，中心用短横线标出中位数。

#### `barPlot`：柱状图

每个分类提供一个数值，画成柱子：

```json
{
  "bars": [
    { "name": "Brain", "value": 12.5 },
    { "name": "Liver", "value": 8.3, "color": "#e15759" }
  ]
}
```

- `name`：X 轴分类标签
- `value`：柱子高度
- `color`（可选）：自定义颜色

#### `histogram`：直方图

传入一组数值，自动分 bin 画直方图：

```json
{
  "values": [1, 2, 2, 3, 3, 3, 4, 4, 5],
  "bins": 4
}
```

- `values`：原始数值数组
- `bins`（可选）：bin 数量，默认 10

**自定义 drawer 可以定义自己的 schema。**

### 2.3 Description 与 Markdown 模板

`description` 列默认使用 **Markdown** 格式渲染。

支持模板变量，语法为 `{{variableName}}`。可用变量包括：

| 变量         | 来源                                              |
| ------------ | ------------------------------------------------- |
| `{{name}}`   | 数据文件的 `name` 列                              |
| `{{chrom}}`  | 数据文件的 `chrom` 列                             |
| `{{start}}`  | 数据文件的 `start` 列                             |
| `{{end}}`    | 数据文件的 `end` 列                               |
| `{{data.*}}` | `data` JSON 中的字段，例如 `{{data.tissueCount}}` |

模板渲染在打开详情窗口时进行，避免在数据文件里重复写死相同描述。

**重复 description 优化（Phase 2）：**

如果大量 chart 共享相同 description，可改用 `descriptionId` 列引用单独的
`descriptions.tsv.gz` 查找表，减少文件体积。

### 2.4 一个文件一种图表

不同图表类型使用不同 track 和不同数据文件：

| Track                | 数据文件                | Drawer               |
| -------------------- | ----------------------- | -------------------- |
| 组织表达 box plot    | `expression.tsv.gz`     | `precomputedBoxPlot` |
| 组织表达 box plot    | `expression.tsv.gz`     | `rawBoxPlot`         |
| 组织表达 violin plot | `expression.tsv.gz`     | `rawViolinPlot`      |
| 组织表达柱状图       | `expression_mean.tsv`   | `barPlot`            |
| 表达量分布直方图     | `expression_values.tsv` | `histogram`          |
| 突变计数柱状图       | `mutation_count.tsv.gz` | `barPlot`            |
| 剪接 PSI violin      | `splicing_psi.tsv.gz`   | `violinPlot`         |

---

## 3. 架构设计

采用 JBrowse 标准四层架构，display 现在支持多种 renderer：

```
FeatureChartTrack (TrackType)
  → LinearFeatureChartDisplay (DisplayType)
    → FeatureChartRenderer (RendererType, canvas/D3)
    → FeatureChartPlotlyRenderer (RendererType, DOM/Plotly)
      → FeatureChartTabixAdapter (AdapterType)
```

### 3.1 FeatureChartTabixAdapter

- 读取 Tabix 索引的 TSV 文件
- 按当前 LGV 区域查询行
- 对每一行解析坐标、`name`、JSON payload 和 description
- 返回携带 `contextData`（含
  `data`、`description`、模板变量）的合成 SimpleFeature

### 3.2 FeatureChartRenderer

- 继承 `FeatureRendererType`
- 使用 `renderToAbstractCanvas` 绘制
- 每个 feature 渲染为一个固定像素尺寸 `chartWidth` × `chartHeight` 的 chart
- chart 水平位置由 `start/end` 和 `align` 决定：
  - `left`：chart 左边缘对齐 `start`
  - `right`：chart 右边缘对齐 `end`
  - `center`：chart 中心对齐 `(start + end) / 2`
- **所有绘图参数都从自己的 `config` 读取**
  （`drawer / chartWidth / chartHeight / align / maxChartsPerView / minChartSpacingPx / colorScheme`，见
  `src/renderSettings.ts`）；display 只负责把 `config` 传下来
- 通过 drawer 名称从注册表获取 drawer 函数并调用，同时把
  `resolveColorScheme(theme, colorScheme)` 的结果作为 `props.colorScheme` 传入
- 当视图内 chart 数量超过阈值或空间过挤时，渲染"数据太多，请放大查看"的提示（黄色），不绘制单个 chart
- drawer 名字无法解析时 **不抛错**：`renderToAbstractCanvas`
  里画一个占位块（错误文本 + 前 5 个可用 drawer 名），并在结果里带上
  `drawerError` 字段

### 3.3 FeatureChartPlotlyRenderer

- 继承 `FeatureRendererType`，client-side React 渲染
- 使用 [Plotly.js](https://plotly.com/javascript/) 绘制交互式图表
- `plotly.js-dist-min` 按需 lazy load，未使用 Plotly renderer 的 track 不会加载
- 支持 `box`、`violin`、`bar`、`scatter`、`line` 等常见图表类型
- 每个 feature 对应一个独立 Plotly 图表，位置计算与 canvas renderer 一致
- 图表支持 Plotly 内置悬停、缩放等交互
- 与 canvas renderer 一样从自身 config 读取尺寸/对齐/密度阈值与
  `colorScheme`（共用
  `resolveFeatureChartRenderSettings()`），并把 palette 写进 trace 颜色与
  `layout.colorway`；深色主题会切到深色面板并提亮 palette

### 3.4 LinearFeatureChartDisplay

- 继承 `BaseLinearDisplay`
- `rendererTypeName` 从 display 配置读取，可切换 `FeatureChartRenderer` 或
  `FeatureChartPlotlyRenderer`
- 提供自定义 `TooltipComponent`
- `renderProps()` **只**额外传 `config`（renderer 配置）与 `theme`；
  `drawer / chartWidth / chartHeight / align / maxChartsPerView / minChartSpacingPx / colorScheme`
  一律不再手抄，由 renderer 自读
- hover chart 时显示 maximize 图标
- 点击 maximize 图标打开详情 Dialog

### 3.5 Drawer 目录（注册表）

模块级单例，主线程和 worker 共享。内部结构是
`Map<string, { meta, draw }>`，对外暴露"目录 + 解析"两组 API：

```typescript
interface FeatureChartDrawerMeta {
  name: string
  displayName: string
  description: string // 一句话：画什么、吃什么数据
  dataShape: 'tissues' | 'matrix' | 'series' | 'any'
  defaultSize?: { width: number; height: number }
  optionsSchema?: unknown // 预留：WP2 的 drawerOptions 文档化
}

registerFeatureChartDrawer(name, draw, meta?)
getFeatureChartDrawer(name): DrawerFunction | undefined
getFeatureChartDrawerMeta(name): FeatureChartDrawerMeta | undefined
listFeatureChartDrawers(): FeatureChartDrawerMeta[] // 按 name 稳定排序
listFeatureChartDrawerNames(): string[]
resolveFeatureChartDrawer(name): { drawer, meta } | { error, available }
initBuiltInDrawers()
```

要点：

- `registerFeatureChartDrawer` 的前两个参数与旧版一致，`meta` 可省略；省略时补
  `displayName = name`、`dataShape = 'any'`，老调用方不会失效。
- `getFeatureChartDrawer` 的签名保持不变，仍返回绘制函数本身。
- 解析失败不抛错，返回 `{ error, available }`，由渲染层决定怎么展示。
- 内置抽屉：`precomputedBoxPlot`、`rawBoxPlot`、`rawViolinPlot`、`barPlot`、
  `histogram`（`initBuiltInDrawers()` 在插件 install 时调用，可重复调用）。

#### 第三方注册 drawer

> WP2 会把"插件贡献 drawer"升级为正式扩展点。在扩展点落地前，包内的
> `registerFeatureChartDrawer(name, draw, meta?)`
> 已经可以注册自定义 drawer，但**不推荐**第三方直接 import 本包并调用：请在 WP2 的扩展点规范下注册，这样 drawer 才能被目录、`configdocs`
> 和 agent-sdk 看到。详见
> [`ARCHITECTURE.md`](./ARCHITECTURE.md#扩展点留给-wp2wp3-的接缝)。

## 4. 配置示例

> `drawer`、`chartWidth`、`chartHeight`、`align`、`maxChartsPerView`、
> `minChartSpacingPx`、`colorScheme`
> 都是 renderer 的 slot；省略时取 schema 默认值（`drawer` 默认
> `precomputedBoxPlot`，`colorScheme` 默认 `tableau10`）。

### 4.1 Canvas renderer 配置示例

```json
{
  "type": "FeatureChartTrack",
  "trackId": "tissue_expression",
  "name": "Tissue expression",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "FeatureChartTabixAdapter",
    "dataLocation": {
      "uri": "expression.tsv.gz",
      "locationType": "UriLocation"
    },
    "index": {
      "location": {
        "uri": "expression.tsv.gz.tbi",
        "locationType": "UriLocation"
      }
    },
    "format": "tsv-json-payload"
  },
  "displays": [
    {
      "type": "LinearFeatureChartDisplay",
      "renderer": {
        "type": "FeatureChartRenderer",
        "drawer": "rawBoxPlot",
        "chartHeight": 180,
        "chartWidth": 120,
        "align": "center"
      }
    }
  ]
}
```

### 4.2 Plotly renderer 配置示例

使用 Plotly 绘制交互式 box plot，数据格式与 `rawBoxPlot`
一致（`{ tissues: { Brain: [...], Liver: [...] } }`）：

```json
{
  "type": "FeatureChartTrack",
  "trackId": "tissue_expression_plotly",
  "name": "Tissue expression (Plotly)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "FeatureChartTabixAdapter",
    "dataLocation": {
      "uri": "expression.tsv.gz",
      "locationType": "UriLocation"
    },
    "index": {
      "location": {
        "uri": "expression.tsv.gz.tbi",
        "locationType": "UriLocation"
      }
    },
    "format": "tsv-json-payload"
  },
  "displays": [
    {
      "type": "LinearFeatureChartDisplay",
      "renderer": {
        "type": "FeatureChartPlotlyRenderer",
        "plotType": "box",
        "chartHeight": 180,
        "chartWidth": 140,
        "align": "center"
      }
    }
  ]
}
```

`plotType` 可选值：`box`、`violin`、`bar`、`scatter`、`line`。

### 4.3 最小配置（省略 drawer）与配色

只写 `renderer.type` 也能出图，默认用 `precomputedBoxPlot`（`data.boxes`）：

```json
{
  "displays": [
    {
      "type": "LinearFeatureChartDisplay",
      "renderer": { "type": "FeatureChartRenderer" }
    }
  ]
}
```

换配色只需加一个 slot（可选值：`tableau10` / `viridis` / `set2` / `dark2` /
`blues`，未知值回退到 `tableau10` 并 `warn` 一次）：

```json
{
  "renderer": {
    "type": "FeatureChartRenderer",
    "drawer": "rawBoxPlot",
    "colorScheme": "viridis"
  }
}
```

---

## 5. "数据太多" 提示行为

判定条件（可选配置，默认自适应）：

- chart 数量超过 `maxChartsPerView`
- 或相邻 chart 的像素间距小于 `minChartSpacingPx`

用户放大视图后，重新渲染单个 chart。

---

## 6. Maximize 详情窗口

### 6.1 触发方式

- 鼠标 hover 到某个 chart 上时，在**该 chart** 的右上角显示 `FullscreenIcon`
- 点击图标打开详情 Dialog
- 同时支持点击 chart 主体触发（可选，需避免和 tooltip 冲突）

实现约束（2026-10 浏览器验收后固化，见
[`ARCHITECTURE.md`](./ARCHITECTURE.md#hover-and-the-maximize-affordance)）：

- hover 命中判定用
  **chart 的像素矩形**，不是 feature 的 bp 区间——一个 chart 固定 `chartWidth`
  像素宽，而 bp 区间在缩小视图下可能只有几像素；
- 图标画在**被 hover 的 chart 内部**，hover 状态由 display 组件持有；否则从 chart 移向图标的过程会清空 hover 状态，图标在点击前就消失（多 chart 时也无法判断会放大哪一个）。

### 6.2 Dialog 内容

- 标题：`name`
- 上方：用同一个 drawer 以更大尺寸（如 800×400）重新绘制的 chart
- 下方：渲染后的 Markdown description（含模板变量替换结果）
- 可选按钮：
  - "Zoom to region"：跳转到该 chart 的 `start/end` 区域
  - "Close"

### 6.3 数据复用

Dialog 中的放大图复用当前 renderer 已加载的 `data` 和
`description`，不需要重新 fetch。

### 6.4 失败语义

`drawer` 名字无法解析时，Dialog **不再静默空白**：改为显示 MUI `Alert`
（`severity="warning"`），文案与 canvas 占位块一致，例如
`Unknown FeatureChart drawer "boxplot". Available: barPlot, histogram, …`。description 仍然照常渲染，"Zoom
to region" / "Close" 仍然可用。

---

## 7. 实现任务清单

状态（WP0 收口）：全部完成。后续工作见 WP2（插件贡献 drawer /
`drawerOptions`）与 WP3（声明式 `spec`）。

### Phase 0：产品接入与地基加固（已完成）

- [x] 三个产品注册 `@jbrowse/plugin-feature-chart` （`corePlugins.ts` +
      `package.json`，worker 复用同一份 `corePlugins`）
- [x] `drawer` 默认值修正为 `precomputedBoxPlot`，并加默认值回归测试
- [x] renderer 从自身 `config` 读取全部绘图参数，display 不再手抄
- [x] drawer 目录（`FeatureChartDrawerMeta` + `listFeatureChartDrawers()`）
- [x] 失败语义：`resolveFeatureChartDrawer()` + canvas 占位块 + Dialog `Alert`
- [x] `colorScheme` 落地（5 个 palette + 深色主题可读性）
- [x] 本文件与 `configdocs` 重新生成；新增 `ARCHITECTURE.md`

### Phase 1：基础框架（已完成）

- [x] `FeatureChartDrawer/drawerRegistry.ts`、`types.ts`
- [x] 内置 drawer：`precomputedBoxPlot`、`rawBoxPlot`、`rawViolinPlot`、
      `barPlot`、`histogram`
- [x] `FeatureChartTabixAdapter`（configSchema + 实现）
- [x] `FeatureChartRenderer`（configSchema + canvas 渲染 + "数据太多"提示）
- [x] `LinearFeatureChartDisplay`（configSchema + model）
- [x] `FeatureChartTrack`
- [x] `FeatureChartPlugin` 注册全部元素并调用 `initBuiltInDrawers()`

### Phase 2：交互与测试（已完成）

- [x] Markdown 模板渲染（`{{variable}}`）
- [x] `Tooltip` 与 hover maximize 图标
- [x] 详情 Dialog（放大图 + description）
- [x] adapter / drawer / renderer / markdown 模板单测
- [x] 目录、默认值、失败语义、config-only 渲染单测

### Phase 3：增强（后续工作包）

- [ ] 插件贡献 drawer 的正式扩展点、`drawerOptions`（WP2）
- [ ] 声明式 `spec`（WP3）
- [ ] Plotly 与 canvas 模型统一（WP4）
- [ ] agent-sdk 字段（WP5）
- [ ] `descriptionId` + 单独 descriptions 查找表
- [ ] 从 LGV feature 右键菜单生成 FeatureChartTrack
- [ ] BED + 外部 JSON 文件引用格式；长格式 TSV

## 8. 关键设计决策

| 决策                | 选择                                       | 原因                                                           |
| ------------------- | ------------------------------------------ | -------------------------------------------------------------- |
| Track 名称          | `FeatureChartTrack`                        | 清晰表达“feature 上的 chart”                                   |
| 数据文件格式        | Tabix 索引 TSV + JSON payload              | 按坐标随机读取，一行一个 chart，JSON 灵活                      |
| 坐标来源            | 数据文件自身包含 chrom/start/end           | 不需要额外 BED 文件，天然可索引                                |
| chart 高度          | `chartHeight` 像素高度                     | 用户精确控制视觉高度                                           |
| chart 宽度          | `chartWidth` 像素宽度，与 start/end 无关   | 用户精确控制视觉宽度                                           |
| chart 对齐          | `align: left/right/center` 相对 start/end  | 灵活锚定                                                       |
| 绘图包              | D3 + Canvas 2D                             | 适配 JBrowse `renderToAbstractCanvas`，支持 worker 和 SVG 导出 |
| 自定义绘图          | Drawer 注册表（模块级单例）                | 主线程和 worker 共享，避免函数序列化问题                       |
| Plotly 支持         | 可选 `FeatureChartPlotlyRenderer`          | 需要交互/美观图表时启用，按需加载                              |
| 数据与 drawer 关系  | 一个文件一种图表，不同 track 用不同 drawer | 清晰分离，避免一个文件里混多种数据结构                         |
| description 格式    | Markdown + `{{variable}}` 模板             | 丰富且可复用，减少重复文本                                     |
| 数据过载展示        | 黄色提示带，提示用户放大查看               | 避免 overcrowded 时强行渲染导致混乱                            |
| 绘图参数读取        | renderer 只读自己的 `config`               | 新增 slot 不必改 display；worker 序列化面只有 `config` 一处    |
| drawer 目录         | `Map<string,{meta,draw}>` + 稳定排序       | UI/agent 需要可枚举、可过滤的元数据，且顺序可复现              |
| 未知 drawer         | 画占位块 + `console.warn`，不抛错          | worker 抛错会让整条 track 报错，用户看不到其他正常图表         |
| 放大弹窗未知 drawer | MUI `Alert`                                | 静默空白无法排查，Alert 复用同一套文案                         |
| 配色                | `colorScheme` slot + `resolveColorScheme`  | 配了要有效果；深色主题下自动切换面板与提亮 palette             |

---

## 9. 视觉风格

默认视觉风格参考 **ggplot2**：

- **背景**：透明或接近白色的浅灰底（`#fafafa`），不抢戏
- **网格线**：浅灰色虚线/细实线（`#e0e0e0`），帮助读数但不突兀
- **坐标轴**：深灰色实线（`#333333`），轴标签清晰
- **配色**：默认使用柔和的分类调色板，如 Tableau 10 或色盲友好的 Okabe-Ito
- **字体**：无衬线系统字体，大小适中（默认 12px）
- **箱体/柱状**：白色或浅灰填充 + 彩色描边，或半透明彩色填充
- **Whitespace**：充足的 padding 和间距，避免元素拥挤

所有视觉参数均有默认值，数据文件不需要包含任何样式信息。进阶用户可通过 renderer
config 覆盖。

---

## 10. 待确认问题

已在 WP0 收口的条目：

1. ~~模板变量范围~~：仍为 `name` / `chrom` / `start` / `end` / `data.*`。
2. ~~"数据太多" 判定阈值~~：按数量（`maxChartsPerView`）与像素间距（`minChartSpacingPx`）双条件，均已暴露为 renderer
   slot。
3. ~~Maximize Dialog 尺寸~~：固定 800×400（drawer 目录里的 `defaultSize`
   预留给 WP2 的按 drawer 定制）。
4. ~~Drawer 是否需要知道自己在 maximize 模式~~：`DrawerProps.isMaximize`，放大弹窗里传入
   `true`。
5. ~~第一期 drawer 范围~~：五个内置 drawer 均已实现（见 §2.2 目录）。

仍待 WP2/WP3 决定：

- 插件贡献 drawer 的扩展点形状（`drawerOptions` 如何文档化/校验）。
- 声明式 `spec` 与 `drawer` / `track info` 的关系。

## 11. 参考文件

- `packages/core/src/pluggableElementTypes/renderers/FeatureRendererType.ts`
- `packages/core/src/util/renderToAbstractCanvas.ts`
- `plugins/wiggle/src/XYPlotRenderer/XYPlotRenderer.ts`
- `plugins/alignments/src/AlignmentsTrack/index.ts`
- `plugins/linear-genome-view/src/BaseLinearDisplay/model.ts`
- `plugins/linear-genome-view/src/LinearGenomeView/util.ts`（`expandRegion`）
