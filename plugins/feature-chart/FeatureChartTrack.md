# FeatureChartTrack 需求与实现 TODO

> 文档用途：记录 `FeatureChartTrack`
> 的设计方案、数据格式和实现任务清单。状态：需求讨论已完成，待开工实现。

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

目前内置五个 drawer：

| Drawer               | 输入格式       | 说明                                   |
| -------------------- | -------------- | -------------------------------------- |
| `precomputedBoxPlot` | `data.boxes`   | 处理后数据：预计算 boxplot 统计量      |
| `rawBoxPlot`         | `data.tissues` | 原始数据：boxplot，自动计算五数概括    |
| `rawViolinPlot`      | `data.tissues` | 原始数据：violin plot，用 KDE 估计分布 |
| `barPlot`            | `data.bars`    | 每个分类一个柱子                       |
| `histogram`          | `data.values`  | 单组数值的频数直方图                   |

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

采用 JBrowse 标准四层架构：

```
FeatureChartTrack (TrackType)
  → LinearFeatureChartDisplay (DisplayType)
    → FeatureChartRenderer (RendererType)
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
- 通过 drawer 名称从注册表获取 drawer 函数并调用
- 当视图内 chart 数量超过阈值或空间过挤时，渲染"数据太多，请放大查看"的提示（黄色），不绘制单个 chart

### 3.3 LinearFeatureChartDisplay

- 继承 `BaseLinearDisplay`
- 指定 `rendererTypeName` 为 `FeatureChartRenderer`
- 提供自定义 `TooltipComponent`
- `chartHeight`、`chartWidth`、`align` 作为显示配置
- hover chart 时显示 maximize 图标
- 点击 maximize 图标打开详情 Dialog

### 3.4 Drawer 注册表

模块级单例，主线程和 worker 共享：

```typescript
const registry = new Map<string, DrawerFunction>()

export function registerFeatureChartDrawer(name: string, drawer: DrawerFunction)
export function getFeatureChartDrawer(name: string): DrawerFunction | undefined
```

内置 drawer：

- `precomputedBoxPlot`
- `rawBoxPlot`
- `rawViolinPlot`
- `barPlot`
- `histogram`

第三方插件通过
`import { registerFeatureChartDrawer } from '@jbrowse/plugin-feature-chart'`
注册自定义 drawer。

---

## 4. 配置示例

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

---

## 5. "数据太多" 提示行为

当当前视图内 chart 数量过多，或 chart 之间重叠严重时（例如每像素需要展示多个 chart），renderer 不绘制单个 chart，而是渲染一条黄色提示带：

```
Too many charts in this region — zoom in to view individual charts
```

判定条件（可选配置，默认自适应）：

- chart 数量超过 `maxChartsPerView`
- 或相邻 chart 的像素间距小于 `minChartSpacingPx`

用户放大视图后，重新渲染单个 chart。

---

## 6. Maximize 详情窗口

### 6.1 触发方式

- 鼠标 hover 到某个 chart 上时，在 chart 右上角显示 `FullscreenIcon`
- 点击图标打开详情 Dialog
- 同时支持点击 chart 主体触发（可选，需避免和 tooltip 冲突）

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

---

## 7. 实现任务清单

### Phase 1：基础框架

- [ ] 创建 `FeatureChartDrawer/drawerRegistry.ts` 和 `types.ts`
- [ ] 实现内置 `tissueBoxPlot` drawer（`FeatureChartDrawer/tissueBoxPlot.ts`）
- [ ] 创建 `FeatureChartTabixAdapter/configSchema.ts`
- [ ] 实现 `FeatureChartTabixAdapter/FeatureChartTabixAdapter.ts`
  - 复用 JBrowse Tabix 读取能力
  - 解析 TSV 行，提取 JSON payload 和 description
  - 返回携带 `contextData` 的 SimpleFeature
- [ ] 创建 `FeatureChartRenderer/configSchema.ts`
- [ ] 实现 `FeatureChartRenderer/FeatureChartRenderer.ts`
- [ ] 实现 `FeatureChartRenderer/renderFeatureChart.ts`
  - 支持 `chartWidth`、`chartHeight`、`align` 计算 chart 位置和大小
  - 支持 "数据太多" 提示渲染
- [ ] 创建 `LinearFeatureChartDisplay/configSchema.ts` 和 `model.ts`
- [ ] 创建 `FeatureChartTrack/configSchema.ts` 和 `index.ts`
- [ ] 在 `plugins/single-cell/src/index.ts` 注册所有元素并调用
      `initBuiltInDrawers()`

### Phase 2：交互与测试

- [ ] 实现 Markdown 模板渲染工具（`{{variable}}` 替换）
- [ ] 实现 `LinearFeatureChartDisplay/components/Tooltip.tsx`
- [ ] 支持鼠标 hover 时显示 maximize 图标
- [ ] 实现详情 Dialog（放大图 + description）
- [ ] 编写 `FeatureChartTabixAdapter.test.ts`
- [ ] 编写 `tissueBoxPlot.test.ts`
- [ ] 编写 `FeatureChartRenderer.test.ts`
- [ ] 编写 Markdown 模板渲染测试
- [ ] 在 `products/jbrowse-web` 中手动验证 track 渲染和 maximize 功能

### Phase 3：增强（可选）

- [ ] 支持 `descriptionId` + 单独 descriptions 查找表，优化重复 description
- [ ] 支持从 LGV feature 右键菜单自动生成 FeatureChartTrack
- [ ] 支持 drawer 通过扩展点注册
- [ ] 支持更多内置 drawer：`violinPlot`、`barPlot`
- [ ] 支持 BED + 外部 JSON 文件引用格式
- [ ] 支持长格式 TSV（非 JSON payload）

---

## 8. 关键设计决策

| 决策               | 选择                                       | 原因                                                           |
| ------------------ | ------------------------------------------ | -------------------------------------------------------------- |
| Track 名称         | `FeatureChartTrack`                        | 清晰表达“feature 上的 chart”                                   |
| 数据文件格式       | Tabix 索引 TSV + JSON payload              | 按坐标随机读取，一行一个 chart，JSON 灵活                      |
| 坐标来源           | 数据文件自身包含 chrom/start/end           | 不需要额外 BED 文件，天然可索引                                |
| chart 高度         | `chartHeight` 像素高度                     | 用户精确控制视觉高度                                           |
| chart 宽度         | `chartWidth` 像素宽度，与 start/end 无关   | 用户精确控制视觉宽度                                           |
| chart 对齐         | `align: left/right/center` 相对 start/end  | 灵活锚定                                                       |
| 绘图包             | D3 + Canvas 2D                             | 适配 JBrowse `renderToAbstractCanvas`，支持 worker 和 SVG 导出 |
| 自定义绘图         | Drawer 注册表（模块级单例）                | 主线程和 worker 共享，避免函数序列化问题                       |
| 数据与 drawer 关系 | 一个文件一种图表，不同 track 用不同 drawer | 清晰分离，避免一个文件里混多种数据结构                         |
| description 格式   | Markdown + `{{variable}}` 模板             | 丰富且可复用，减少重复文本                                     |
| 数据过载展示       | 黄色提示带，提示用户放大查看               | 避免 overcrowded 时强行渲染导致混乱                            |

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

1. **模板变量范围**：除了
   `name`、`chrom`、`start`、`end`、`data.*`，还需要哪些变量？
2. **"数据太多" 判定阈值**：默认按 chart 数量还是按像素密度？是否暴露为配置项？
3. **Maximize Dialog 尺寸**：固定 800×400 还是可配置？
4. **Drawer 是否需要知道自己在 maximize 模式**：大图可能需要不同布局（如显示坐标轴标签）。
5. **第一期 drawer 范围**：是否只做 `tissueBoxPlot`，还是需要同时做 `violinPlot`
   / `barPlot`？

---

## 11. 参考文件

- `packages/core/src/pluggableElementTypes/renderers/FeatureRendererType.ts`
- `packages/core/src/util/renderToAbstractCanvas.ts`
- `plugins/wiggle/src/XYPlotRenderer/XYPlotRenderer.ts`
- `plugins/alignments/src/AlignmentsTrack/index.ts`
- `plugins/linear-genome-view/src/BaseLinearDisplay/model.ts`
- `plugins/linear-genome-view/src/LinearGenomeView/util.ts`（`expandRegion`）
