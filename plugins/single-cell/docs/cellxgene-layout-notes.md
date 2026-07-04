# CellXGene 布局参考笔记

> 来源：CZ CELLxGENE Explorer 开源代码（`chanzuckerberg/cellxgene`），主要参考
> `client/src/components/leftSidebar`、`client/src/components/categorical`
> 等目录。用途：为 SingleCellView 的左侧面板、UMAP 绘图区布局提供实现参考。

---

## 1. 整体布局

CellXGene Explorer 采用经典的三栏布局：

```
+----------------+----------------------+----------------+
|  Left Sidebar  |    UMAP Plot (center)|  Right Sidebar |
|  (obs metadata)|    (square, axes)    |  (gene expr)   |
+----------------+----------------------+----------------+
```

- **左侧栏**：展示所有 `obs` 注释列（categorical /
  continuous），支持勾选、颜色映射、统计。
- **中间**：UMAP 散点图，绘图区为正方形，左下角有坐标轴。
- **右侧栏**：基因表达、选择细胞信息、差异表达等（当前需求中先留空）。

---

## 2. 左侧栏（Left Sidebar）

文件位置：`client/src/components/leftSidebar/index.js`

### 2.1 容器

- 固定或可调节宽度（`globals.leftSidebarWidth`）。
- 内边距 `globals.leftSidebarSectionPadding`。
- 顶部可放置标题、创建新分类按钮等。

### 2.2 Categorical 列展示

文件位置：`client/src/components/categorical/index.js`、`client/src/components/categorical/category/index.js`

每个 `obs` 列渲染为一个可折叠的 **Category** 组件：

#### Category Header

```
[□]  cell_type            [🎨]
      ▼
```

- **Checkbox**：三态（全选 / 部分 / 不选）。
  - `checked`：所有 label 都被选中。
  - `indeterminate`：部分 label 被选中。
  - `unchecked`：没有 label 被选中。
  - 点击可切换“全选 / 全不选”。
- **列名**：可点击展开/折叠，右侧有 ▼/▶ 图标。
- **Color-by 按钮**（`icon="tint"`）：点击后将 UMAP 按该列着色。

#### Category Value List（展开后）

每个 label 渲染为一行：

```
[□]  B cell          [mini stacked bar/histogram]   1234
```

- **Checkbox**：单独选中/取消该 label。
- **Label 名称**：截断显示（`Truncate`）。
- **Mini chart**（可选）：
  - 当 UMAP 按另一 categorical 列着色时，显示 **堆叠条形图**（stacked
    bar），展示该 label 内各颜色类别的分布。
  - 当 UMAP 按 continuous 列着色时，显示 **mini histogram**。
- **Count**：该 label 的细胞数量。
- **Color swatch**：如果当前正在按该列着色，label 行末尾显示对应颜色方块。

#### 行交互

- `onMouseEnter` / `onMouseLeave`：触发
  `category value mouse hover`，可用于临时高亮对应细胞。
- 勾选 label 会更新全局 categorical selection（crossfilter）。

### 2.3 Continuous 列展示

Continuous 列同样作为一个 Category 卡片，但展开后通常显示：

- 一个整体 **histogram / mini histogram**。
- 可能包含范围滑块（brush）用于按数值区间筛选细胞。
- 本阶段可以先只展示最小值 / 最大值 / 中位数，或简单直方图。

### 2.4 排序与过滤

- 列名按字母顺序排序：`ControlsHelpers.selectableCategoryNames(schema).sort()`。
- 顶部可加入搜索框过滤列名或 label。

---

## 3. 中间 UMAP 绘图区

### 3.1 绘图区形状与投影变换

- CellXGene 中 UMAP 绘图区采用 **三段式变换**：`modelTF`（数据 → 世界）×
  `camera`（平移/缩放）× `projectionTF`（世界 → 屏幕）。
- 本实现完全沿用该 pipeline：
  - `modelTF` 固定为 1:1，将归一化到 `[0,1]` 的数据映射到 WebGL 世界空间
    `[-1,1]`。
  - `camera.view()` 仅负责平移/缩放，操作空间始终是世界 `[-1,1]`。
  - `projectionTF` 负责把方形世界适配到矩形画布：取 `fractionToUse = 0.85`
    的较小 viewport 维度进行**等比缩放**，并将结果居中。因此初始加载时细胞团占据画布中央约 70% 面积。
- **改变窗口高度或拖拽左右侧边栏时，只重新计算
  `projectionTF`**（通过平移让细胞团保持在可视区中央），`modelTF` 与 `camera`
  不变。每个像素代表的数值范围不变，图像不会拉伸或压缩，只是可见边距变化。
- 为避免极少数离群细胞把主体细胞团挤到中间，embedding 先按 1%–99% 分位数边界归一化到
  `[0, 1]`，再应用上述变换。
- 左下角绘制黑色坐标轴（X 轴、Y 轴）。

### 3.2 坐标轴比例

- 当前实现固定为
  **1:1**，即 x 轴与 y 轴的分辨率相同（1 数据单位 = 相同像素数）。
- 不再提供 `Fit to data` / `Fit to view` / `Custom`
  等轴比调节控件；如有需要可在后续版本中重新引入，但默认行为应保持 1:1。

### 3.3 点的大小与颜色

- 点大小根据细胞总数、viewport 尺寸动态计算。
- 未选择任何 label 时，所有点使用默认颜色（CellXGene 为灰色或按 color-by 着色）。
- 选择某些 label 后：
  - 选中的点保持不透明/高亮。
  - 未选中的点变暗/半透明。

---

## 4. 与 JBrowse SingleCellView 的对应

| CellXGene                     | JBrowse SingleCellView                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| `obs` 列 → `Category`         | `model.data.obsColumns` + `model.data.metadata`                                             |
| Label checkbox selection      | `model.selectedCells`（Set<number>）                                                        |
| Color-by button               | `model.colorBy`                                                                             |
| Crossfilter / hover highlight | `model.highlightedCells`                                                                    |
| Square UMAP plot              | `EmbeddingCanvas` + `modelTF × camera × projectionTF`；resize 仅改变 projection，数据不拉伸 |
| Axis ratio                    | 固定 1:1，不再提供调节下拉/滑块                                                             |
| Left sidebar width            | 可拖拽调整的容器                                                                            |

---

## 5. 实现要点

1. **数据准备**：`loadDataset` 已经加载
   `metadata`（`Record<string, CategoricalColumn | ContinuousColumn | StringColumn>`），可直接用于左侧栏渲染。
2. **选择状态**：
   - 每个 label 的 checkbox 对应一组细胞索引。
   - 全选/全不选通过 category 头部的三态 checkbox 控制。
   - 选择结果写入 `model.selectedCells`（不自动刷新 BAM
     track，后续由按钮触发）。
3. **颜色映射**：
   - 点击列名旁的 color-by 按钮时，设置 `model.colorBy`。
   - `EmbeddingCanvas.computeColors()` 已经支持 categorical / continuous /
     string 三种类型。
4. **布局与渲染**：
   - 使用 CSS Grid 或 Flex 实现三栏。
   - 左栏宽度可拖拽（MouseDown/MouseMove/MouseUp 调整宽度）。
   - 中间绘图区填满剩余矩形空间，`EmbeddingCanvas`
     的 canvas 元素与 CSS 尺寸一致。
   - 采用 CellXGene 三段式变换：`modelTF`（固定 1:1）→ `camera.view()` →
     `projectionTF`（随 resize 重新计算）。resize 时只改变 projection，数据不会拉伸。
   - 因 `regl` 会缓存创建时的 WebGL viewport，每次 render 前需调用 `regl.poll()`
     以同步当前 canvas 尺寸，否则会出现只渲染左下角正方形的问题。
5. **坐标轴**：
   - 在 canvas 上额外绘制两条黑色轴线，或作为叠加 SVG。

---

## 6. 直方图坐标轴变换

所有连续变量（obs continuous 列、单个基因、基因集合）的展开直方图顶部均提供 **X
/ Y 轴变换切换**：

```
X: linear | log      Y: linear | log
```

### 6.1 X 轴变换

- `linear`：原始数值。
- `log`：对数值做 `log1p` 变换。
  - 为防止负数导致 `log` 报错，**先按该列最小值平移到 0，再统一 `log1p`**。
  - 即 `shift = min < 0 ? -min : 0`，变换后为 `log1p(value + shift)`。
  - 平移仅针对含负数的列；非负列保持原有 `log1p` 语义。
- X 轴切换后，该列已选中的 brush range 会被清空，并重新计算 `selectedCells`。
- `EmbeddingCanvas`
  的颜色映射同步使用 X 轴变换后的值，因此 UMAP 着色会随变换立即更新。

### 6.2 Y 轴变换

- `linear`：纵轴为细胞计数。
- `log`：纵轴为 `log1p(count)`。
- 仅影响直方图柱子高度，不影响选择与颜色映射。

### 6.3 涉及的组件与状态

| 目标                                | 状态                                        | 切换组件                                     | 直方图组件                        |
| ----------------------------------- | ------------------------------------------- | -------------------------------------------- | --------------------------------- |
| obs continuous 列                   | `model.obsTransforms`                       | `ObsSidebar` 中的 `HistogramTransformToggle` | `HistogramBrush`                  |
| 单个基因                            | `model.featureTransforms`                   | `FeatureRow` 中的 `HistogramTransformToggle` | `HistogramBrush`                  |
| 基因集合                            | `model.geneSetTransforms`                   | `FeatureRow` 中的 `HistogramTransformToggle` | `HistogramBrush`                  |
| categorical label 的 mini histogram | 继承当前 color-by continuous 列的 transform | —                                            | `MiniHistogram`（位于 `MiniBar`） |

---

## 7. 基因集合（Gene Sets）

### 7.1 创建与管理

- 右侧面板顶部提供搜索框添加单个基因。
- 基因集合通过模态框管理：
  - **Create gene set**：输入集合名称与基因列表，创建后保存到 `model.geneSets`。
  - **Add existing gene set**：从已创建的集合中选择并加入侧边栏。
- 基因集合行展开后：
  - 顶部可切换聚合方法（见 7.2）。
  - 显示聚合后的大直方图。
  - 下方列出集合内每个基因，每行与单独添加的基因行行为一致（info、color-by、X/Y 变换、删除等）。
  - 提供 **+ 按钮** 向集合中添加新基因。

### 7.2 聚合方法

基因集合按当前选择的聚合方法把多个基因表达向量合并为一个向量：

| 方法     | 说明                                             |
| -------- | ------------------------------------------------ |
| `mean`   | 每个细胞取所有基因的平均值，缺失基因忽略。       |
| `sum`    | 每个细胞求和，缺失基因贡献 0。                   |
| `median` | 每个细胞取中位数，抗离群值。                     |
| `max`    | 每个细胞取最大值，用于检测任一基因高表达的细胞。 |

- 状态：`model.geneSetAggregatorKeys`。
- 切换聚合方法后重新计算该集合的聚合表达向量，并清空其 brush range。
- 添加/删除集合中的基因后也会自动重新聚合。

---

## 8. 组件响应式注意事项

`mobx-react` 9 在函数组件上使用 `observer` 时会内部包裹
`React.memo`。为确保 MobX 能正确追踪 `model.*Transforms` 这类 volatile
Map 的变化：

- 推荐写法：

  ```typescript
  const Component = observer(function Component({ model, ... }) {
    const transform = model.obsTransforms.get(column) ?? { x: 'linear', y: 'linear' }
    // ...
  })
  ```

- 避免把函数定义和 `observer(...)` 分开：

  ```typescript
  // 不推荐，可能导致 memo 后不响应 observable 变化
  function Component({ model }) { ... }
  const ComponentObserver = observer(Component)
  ```

- 子组件如果依赖父组件读取的 observable，应自己也是
  `observer`，或让父组件在渲染路径中读取对应的 observable 以强制重绘。

---

## 9. 参考链接

- [CZ CELLxGENE Explorer Tutorials](https://cellxgene.cziscience.com/docs/04__Analyze%20Public%20Data/4_1__Hosted%20Tutorials)
- [chanzuckerberg/cellxgene on GitHub](https://github.com/chanzuckerberg/cellxgene)
