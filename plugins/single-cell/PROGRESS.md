# Single Cell Plugin 开发进度

> 文档用途：与当前实现对齐进度、标记已完成项、列出阻塞问题与下一步工作。对应 PRD：`plugins/single-cell/PRD.md`
> 最后更新：2026-06-28

---

## 总体状态

| 阶段    | 主题                       | 状态                                                   |
| ------- | -------------------------- | ------------------------------------------------------ |
| Phase 0 | 插件脚手架 + Add 菜单注册  | **已完成**                                             |
| Phase 1 | Zarr/AnnData 数据层        | **基本完成，有遗留问题**                               |
| Phase 2 | WebGL UMAP 核心 + 选择交互 | **基本完成，存在关键 bug**                             |
| Phase 3 | 基因组 ↔ 单细胞双向联动    | **进行中（Cell → Genome 方向已实现核心适配器/Track）** |
| Phase 4 | 基因表达面板与统计图表     | **进行中（基因面板已确定方案，开始实现）**             |
| Phase 5 | 性能优化与产品化           | **未开始**                                             |

---

## Phase 0: 插件脚手架与 Add 菜单注册

### 已完成

- [x] 创建 `plugins/single-cell/` 目录结构
- [x] `package.json` 已配置依赖（`@jbrowse/core`、`regl`、`zarr`、`gl-matrix`
      等）
- [x] `tsconfig.build.esm.json` 已配置
- [x] `SingleCellPlugin` 类实现 `install()` 与 `configure()`
- [x] 在 `Add` 菜单注册入口 `Single cell view`
- [x] `SingleCellView` 作为 `ViewType` 注册
- [x] 已在 `products/jbrowse-web/src/corePlugins.ts:25` 导入并注册
- [x] 已在 `products/jbrowse-web/package.json:52` 添加 workspace 依赖
- [x] `esm/` 构建产物存在（2025-04-29 构建）

### 代码位置

- `src/index.ts`
- `src/SingleCellView/index.ts`
- `src/SingleCellView/model.ts`
- `products/jbrowse-web/src/corePlugins.ts`

---

## Phase 1: 数据层 — Zarr/AnnData Adapter

### 已完成

- [x] `SingleCellZarrAdapter` 基础类实现
- [x] `init()` 打开 Zarr group，自动探测：
  - `obsm/` 中的 embeddings（如 `X_umap`）
  - `obs/` 中的 metadata columns
  - `var/` 中的 feature metadata columns
  - `X` 的 dense/sparse 格式与维度
- [x] `_buildVarNameIndex()` 构建基因名索引
- [x] `getEmbedding(name)` 读取 embedding 为 `Float32Array`
- [x] `getObsColumn(name)` 读取并自动解码 categorical 列（codes +
      `__categories`）
- [x] `getVarColumn(name)` 读取 var 列
- [x] `getExpression(geneName)` 支持 dense `X` 矩阵按基因名读取
- [x] `SingleCellZarrAdapter` 已作为 `AdapterType` 注册
- [x] `SingleCellView.model.ts` 中 `loadDataset` 用 `flow()` 包装（MST async
      action 已修正）

### 实现文件

- `src/SingleCellAdapter/index.ts`
- `src/SingleCellAdapter/configSchema.ts`
- `src/SingleCellAdapter/SingleCellZarrAdapter.ts`
- `src/SingleCellAdapter/zarr.d.ts`
- `src/zarr.d.ts`

### 已完成修复

- [x] **配置项缺失**：已在 `configSchema.ts` 添加 `varIndexColumn`，默认值为
      `'index'`
- [x] **Sparse X 未实现**：已实现 CSC/CSR 稀疏矩阵的列提取（`getExpression`）
- [x] **String obs 列未识别**：已新增 `StringColumn` 类型并支持 `vlen-utf8`
      字符串列（如 obs/index 的 cell barcode）
- [x] **Model 直接 new Adapter 类型错误**：`model.ts` 改为使用
      `singleCellZarrAdapterConfigSchema.create()` 创建合法配置实例
- [x] **HTTPStore 无法 list keys**：`_listGroupKeys` 改为优先读取 AnnData
      `.zattrs` 中的 `column-order`；`obsm` 增加常见 embedding 候选列表并用
      `containsItem` 探测
- [x] **`xGroup.attrs.shape` 读取错误**：zarr.js `attrs` 是 `Attributes`
      对象，改为 `await xGroup.attrs.asObject()` 后再取 `shape`
- [x] **二维数组未扁平化**：zarr.js 对 shape > 1 的数组返回
      `NestedArray.data = TypedArray[]`（按行切分），导致 embedding/X/obs 列读取异常。已新增
      `flattenNestedData` 统一扁平化。
- [x] **obs/var 列探测兜底**：HTTPStore 不支持 `keys()` 且无 `.zattrs`
      时，用常见列名候选列表通过 `containsItem` 探测。
- [x] **PCA 等多维 embedding 只取前两维**：`getEmbedding` 在 `shape[1] > 2`
      时自动切片 `[:, 0:2]`（使用 zarr.js 的 `slice(0, 2)`
      对象），避免把多个 PC 当成额外细胞点渲染。

### 已添加测试

- [x] `SingleCellZarrAdapter.test.ts`：覆盖 init 结构探测、`getEmbedding`、`getObsColumn`（categorical/continuous/string）、`getExpression`（dense/CSC/CSR）、`varIndexColumn`
      配置

### 遗留问题 / 阻塞风险

- [ ] **Dense X 性能差**：`getExpression` 当前读取整个 `X` 矩阵再提取一列
- [ ] **缺少 LRU 缓存**：PRD 中参考 CellXGene `AnnoMatrix` 的分层缓存未实现
- [ ] **UI/选择交互测试缺失**：`EmbeddingCanvas`、`LassoOverlay`、`camera`
      暂无测试

---

## Phase 2: SingleCellView WebGL UMAP 核心

### 已完成

- [x] `EmbeddingCanvas.tsx` 基于 `regl` 的 WebGL 散点图渲染
- [x] 坐标归一化到 `[0, 1]` 并映射到 WebGL `[-1, 1]`
- [x] `Camera` 类实现 2D 平移/缩放/重置
- [x] `drawPointsRegl.ts` 实现单 draw call
      points 渲染，含 flag 状态（selected/background/highlight）
- [x] `Toolbar` 组件：工具切换（Pan/Lasso/Rect）、Embedding 选择、Color
      by 选择、选择计数、Apply 按钮
- [x] **Embedding 切换仅重绘画布**：`setEmbedding` 不再设置全局
      `loading`，只更新 `self.data.embeddingData`，侧边栏和工具栏保持不变
- [x] **Toolbar 精简 + 标签覆盖层按钮 +
      tooltip + 色盘选择器**：移除 Toolbar 中的 "Color:
      xxx" 显示；embedding 选择器左侧新增独立 `Segment` 图标按钮，切换
      `showLabels`；`Palette`
      图标按钮打开 popover，可选择分类/连续变量色盘预设；所有图标按钮添加 MUI
      `Tooltip` 提示功能。
- [x] **类别标签覆盖层**：`LabelOverlay`
      在分类 colorBy 开启标签模式时，于每类中心绘制黑色描边文字标签；同时所有点变为半透明（background
      dim）。连续变量开启标签模式时只 dim 点，不画标签。
- [x] **embedding/color-by 信息移到绘图区右上角**：`CenterPlot`
      右上角显示 "Embedding: X_umap | Color by: general_cell_type"，无边框。
- [x] **连续变量分布图 CellXGene 风格重绘**：`HistogramBrush`
      增高到 110px，默认灰色柱，color-by 变量时按 viridis 着色；鼠标左键按下为下界、松开为上界框选范围；min
      /
      max 分别放在分布图左下/右下角；智能数字格式；新增 X 轴刻度标签；Y 轴放右侧；左右 margin 留足避免刻度/数字被截断；SVG 宽度自适应父容器。
- [x] `ImportForm` 组件：输入 Zarr URL 并加载
- [x] `SingleCellView.tsx` 容器：处理 loading / import / loaded 三种状态
- [x] `LassoOverlay.tsx` 实现 Lasso 与矩形选择（含射线法多边形检测）
- [x] Color
      by 支持 categorical（硬编码调色板）与 continuous（简化 viridis）；点击侧边栏调色盘按钮才按该列着色
- [x] **初始加载无默认 color-by**：`loadDataset` 不再自动设置
      `colorBy`，首次加载所有细胞统一灰色
- [x] **不对 color-by 列做特殊样式**：`ObsSidebar`
      中列标题不再加粗、label 行不再显示颜色圆点，leiden 等聚类列与普通 categorical 列表现一致
- [x] `ImportForm` 支持从 `configuration.SingleCellPlugin.datasets`
      读取预设数据集下拉选择，无需手动输入地址
- [x] **CellXGene 风格三栏布局**：左侧 obs 面板、中间 UMAP 填满可用矩形区域、右侧面板占位；工具栏位于顶部通栏，中间区域全部为绘图区
- [x] **可拖拽调整侧边栏宽度**：左/右侧面板通过 `ResizeHandle`
      调整，默认宽度 375px
- [x] **底部高度调整**：窗口下沿可拖动改变整个视图高度
- [x] **CellXGene 风格投影变换**：`EmbeddingCanvas` 采用
      `modelTF × camera × projectionTF` 三段式变换（参考 CellXGene）。`modelTF`
      固定为 1:1，将 `[0,1]` 数据映射到 `[-1,1]`；`projectionTF`
      负责把方形世界适配到矩形画布并居中。改变窗口高度或侧边栏宽度时只改变
      `projectionTF`（通过平移保持居中），每个像素代表的数值范围不变，图像不会拉伸。
- [x] **底部左侧等长坐标轴**：SVG 绘制黑色 L 形坐标轴与 UMAP 1 / UMAP
      2 标签，两轴线等长

### 实现文件

- `src/SingleCellView/components/EmbeddingCanvas.tsx`
- `src/SingleCellView/components/camera.ts`
- `src/SingleCellView/components/drawPointsRegl.ts`
- `src/SingleCellView/components/Toolbar.tsx`
- `src/SingleCellView/components/ImportForm.tsx`
- `src/SingleCellView/components/SingleCellView.tsx`
- `src/SingleCellView/components/LassoOverlay.tsx`
- `src/SingleCellView/components/ObsSidebar.tsx` （新增）
- `src/SingleCellView/components/CenterPlot.tsx` （新增）
- `src/SingleCellView/components/AxesOverlay.tsx` （新增）
- `src/SingleCellView/components/LabelOverlay.tsx` （新增）
- `src/SingleCellView/components/PalettePicker.tsx` （新增）
- `src/SingleCellView/components/embeddingUtils.ts` （新增）

### 关键 Bug / 必须修复（已修复）

- [x] **Lasso/Rect 选择坐标系错误**：`LassoOverlay` 现在使用
      `model.embeddingBounds`、`model.cameraView` 和 `projectionTF`
      将屏幕坐标顶点反变换回 embedding 数据坐标，再执行 point-in-polygon/rect 检测。
- [x] **Camera 与 LassoOverlay 事件冲突**：`EmbeddingCanvas` 在
      `selectionTool !== 'pan'` 时不再处理拖拽平移，并设置 `pointerEvents: none`
      让 SVG overlay 独占鼠标事件。
- [x] **WebGL 顶点缓冲区大小不匹配**：`computeColors()` 在 `colorBy`
      列缺失时只返回 3 个 float，导致 `GL_INVALID_OPERATION`。已改为始终返回
      `nPoints * 3`，并增加 render 时长度校验；`model.ts`
      也优先加载 color-by 候选列并确保 `colorBy` 指向成功加载的列。
- [x] **画布空白（坐标为 NaN）**：根因是 zarr.js 对二维数组返回
      `NestedArray.data = TypedArray[]`（按行切分），adapter 用
      `new Float32Array(arrayOfTypedArrays)`
      得到 NaN，导致所有点被 normalize 成 NaN。已新增 `flattenNestedData`
      将二维行数组扁平化，并修复 `EmbeddingCanvas` 的 `[0,1] → [-1,1]`
      变换顺序。
- [x] **滚轮缩放无 passive 事件警告**：`EmbeddingCanvas` 改用原生
      `addEventListener('wheel', ..., { passive: false })`，避免
      `preventDefault` 在 React passive listener 中报错
- [x] **离群点导致主体细胞团被挤到中间 / 初始视图过满**：`normalizeEmbedding()`
      改用 1%–99% 分位数边界；通过 `projectionTF` 使用
      `fractionToUse = 0.85`，使初始加载时所有细胞位于中间约 70% 区域，且窗口或侧边栏 resize 时只改变投影（平移居中），数据不拉伸。

### 仍未修复

- [ ] **`forceUpdate` 全局变量脆弱**：仍是模块级 `updateCallback`，属于反模式
- [ ] **持续渲染**：`EmbeddingCanvas` 使用 `requestAnimationFrame` 无限循环
- [ ] **Camera 状态未持久化**：camera 存在 `useRef` 的 volatile 对象中

### 遗留功能

- [ ] 未实现图例（Legend）
- [ ] 未使用 d3 调色板，当前为硬编码 10 色
- [ ] 未实现 Color by gene expression（Toolbar 只列出 obs columns）
- [ ] 选择状态使用 `Set<number>`（cell index），PRD 期望为
      `Set<string>`（barcode）
- [ ] 未实现点大小随 camera distance 缩放（当前点大小固定）
- [x] 已增加 colorBy 缺失时的默认灰色渲染，避免画布空白

---

## Phase 3: 基因组 ↔ 单细胞双向联动

### 状态

**进行中** — Cell → Genome 与 Genome →
Cell 核心联动已实现，待补覆盖度视图与 UI 反馈。

### 已完成

- [x] Session 级 `SingleCellSelection` 共享状态扩展
- [x] `selectedCells` / `selectedRegion` / `activeSingleCellViewId`
- [x] `SingleCellView` 选择时同步 barcode 到
      `session.singleCellSelection.selectedCells`
- [x] `SingleCellBamAdapter`：包装 BAM/CRAM adapter，按
      `CB`（可配置）tag 过滤任意细胞子集
- [x] `SingleCellBamAdapter.test.ts`
      单元测试覆盖全量/过滤/自定义 tag/refNames 委托
- [x] `SingleCellPileupDisplay`：复用 `LinearPileupDisplay`，将当前选择注入
      `adapterRenderProps`
- [x] `SingleCellAlignmentsTrack` 注册，默认使用 `SingleCellPileupDisplay`
- [x] Toolbar 已显示选择计数与清除按钮
- [x] CLI 预处理脚本 `convert_h5ad_to_zarr.py`（h5ad → Zarr）
- [x] **Genome → Cell**：`LinearGenomeViewExtension` 扩展 LGV
      rubber-band 右键菜单，新增 "Highlight cells in region"
- [x] **Genome →
      Cell**：`SingleCellPileupDisplay.getCellBarcodesInRegion(region)`
      读取 region 内所有 CB/CR tag
- [x] **Genome → Cell**：`SingleCellView` 通过 reaction 监听
      `selectedRegion`，将 barcode 映射为细胞索引并写入 `highlightedCells`

### 实现文件

- `src/SessionExtension.ts`
- `src/LinearGenomeViewExtension.ts`
- `src/SingleCellView/model.ts`
- `src/SingleCellAdapter/SingleCellBamAdapter.ts`
- `src/SingleCellAdapter/SingleCellBamAdapterConfigSchema.ts`
- `src/SingleCellAdapter/SingleCellBamAdapter.test.ts`
- `src/SingleCellView/SingleCellPileupDisplay/model.ts`
- `src/SingleCellView/SingleCellPileupDisplay/index.ts`
- `src/SingleCellView/SingleCellSNPCoverageDisplay/model.ts`
- `src/SingleCellView/SingleCellSNPCoverageDisplay/index.ts`
- `src/SingleCellView/SingleCellAlignmentsTrack/index.ts`
- `scripts/convert_h5ad_to_zarr.py`
- `src/index.ts`

### 待实现

- [x] 覆盖度视图：新增 `SingleCellSNPCoverageDisplay`，注入 `selectedCells` 到
      `LinearSNPCoverageDisplay`
- [ ] Track 头部过滤图标/提示
- [ ] Genome → Cell 的单元测试（`LinearGenomeViewExtension.test.ts` /
      `SingleCellView.model.test.ts`）
- [ ] 修复 SNPCoverage 缓存未包含 `selectedCells` 导致选择变化后覆盖度不刷新

### 依赖 / 阻塞

- 需要 `AlignmentsPlugin` 已加载（`@jbrowse/plugin-alignments`
  已加入 workspace 依赖）
- `SingleCellPileupDisplay` 使用 `types.snapshotProcessor` 保持
  `LinearPileupDisplay` 内部 type 字面量，从而复用其 React 组件

---

## Phase 4: 基因表达面板与统计图表

### 状态

**进行中** — 右侧面板基因表达功能已确定方案，开始实现。ATAC
peak 作为后续扩展先留空。

### 已确定设计

右侧面板（Gene/ATAC Peak Expression Panel）复用当前空白右栏，宽度通过
`rightSidebarWidth` 拖拽调整。

#### 基因表达面板（Gene Panel）

1. **搜索与添加**
   - 顶部搜索框从 `model.data.varNames` 匹配基因名。
   - 点击搜索结果后添加到 `model.activeFeatures`。
   - 添加时异步拉取该基因在所有细胞上的表达值，缓存到 `model.featureValues`。

2. **已添加基因列表**
   - 每行展示：颜色指示器、基因名、mini histogram、删除按钮。
   - 点击行将该基因设为 `model.selectedFeature` 与 `colorBy`。
   - 当前 color-by 的基因行高亮显示。

3. **基因表达分布图（CellXGene 风格）**
   - 对 `model.selectedFeature` 绘制大图 histogram。
   - 横轴为表达值，纵轴为细胞数（Y 轴放右侧）。
   - 显示 min / max（左下/右下角）。
   - 支持 brush 选区，将区间内细胞加入 `model.selectedCells`。
   - 柱子按当前 continuous palette 着色。

4. **联动**
   - color-by 为基因时，UMAP 按表达量着色（复用 continuous 渲染路径）。
   - feature brush 范围纳入 `recomputeSelectedCells` 的 candidateSets。
   - 遵循 `selectionMode`（AND/OR）与左侧 obs 选择合并。

### colorBy 语义扩展

`colorBy` 需要区分 obs 列与基因 feature：

- 方案：将 `colorBy` 从 `string` 扩展为
  `{ kind: 'obs' | 'feature', name: string } | undefined`。
- `EmbeddingCanvas` 与 `LabelOverlay` 根据 `kind` 分别读取
  `metadata[colorBy.name]` 或 `featureValues[colorBy.name]`。
- `ObsSidebar` 中判断 `isColorBy` 时改用
  `colorBy?.kind === 'obs' && colorBy.name === column`。

### 涉及文件

- `src/SingleCellView/model.ts`
- `src/SingleCellAdapter/SingleCellZarrAdapter.ts`（复用 `getExpression`）
- `src/SingleCellView/components/RightSidebar.tsx`（新增容器，含搜索、列表、histogram）
- `src/SingleCellView/components/SingleCellView.tsx`（引入 RightSidebar）
- `src/SingleCellView/components/EmbeddingCanvas.tsx`
- `src/SingleCellView/components/LabelOverlay.tsx`
- `src/SingleCellView/components/ObsSidebar.tsx`

### 已完成

- [x] 基因搜索面板（quick gene search）
- [x] 已添加基因列表 + mini histogram
- [x] 基因表达大图 histogram + brush
- [x] Gene color-by 与 UMAP 联动
- [x] Feature brush 范围纳入 selectedCells
- [x] 基因集合创建/管理模态框（Create / Add existing gene set）
- [x] 基因集合聚合方法切换（mean / sum / median / max）
- [x] 基因集合 color-by 与 UMAP 联动
- [x] 基因集合内单基因展开、color-by、X/Y 变换与单独基因行行为一致
- [x] 直方图 X/Y 轴变换（linear / log）：obs continuous 列、单个基因、基因集合
- [x] log 变换对负数自动平移最小值到 0 后再 `log1p`

### 已修复

- [x] 右侧面板基因搜索无下拉列表：已增强 `SingleCellZarrAdapter` 对 `var`
      列名的探测（增加
      `gene_name`/`symbol`/`feature_id`/`features`/`index`/`_index`
      等候选），并在 `_buildVarNameIndex`
      中增加直接尝试已知列路径的兜底逻辑；`RightSidebar`
      增加无匹配/未检测到基因名的提示、Enter 快捷添加、下拉列表背景和层级。
- [x] obs continuous 列 X/Y 变换点击后当前展开项不更新：已改为标准
      `observer(function Component(...))` 写法，确保 MobX 正确追踪
      `model.obsTransforms`。

### 待实现

- [ ] Dot plot（基因 × 聚类平均表达）
- [ ] Violin plot（按聚类表达分布）
- [ ] ATAC peak 搜索与可及性面板（预留）
- [ ] Dot plot hover/click 与 UMAP 高亮联动

---

## Phase 5: 性能优化与产品化

### 状态

**未开始**

### 待实现

- [ ] 大规模数据渲染优化（>50万细胞：frustum culling / datashader）
- [ ] Zarr chunking 策略验证
- [ ] `selectedCells` 改用 BitSet
- [x] 单元测试：`SingleCellZarrAdapter.test.ts` 已覆盖 init、embedding、obs
      column、dense/sparse expression
- [ ] 单元测试：`EmbeddingCanvas.test.ts`、`LassoOverlay.test.ts`、`camera.test.ts`
- [ ] 图像快照测试
- [ ] 图像快照测试
- [ ] Storybook stories
- [ ] 文档：`website/docs/single_cell.md`
- [ ] CLI 预处理工具（可选，PRD 中提及）
- [ ] 通过 CI typecheck / lint / test

---

## 当前阻塞问题（建议优先修复）

按优先级排序：

1. **Dense X 性能差** — `getExpression` 读取整个 `X`
   矩阵，后续应改为按 chunk/slice 读取。
2. **无 UI/选择交互测试覆盖** — `EmbeddingCanvas`、`LassoOverlay`、`camera`
   暂无测试；Genome → Cell 联动也缺单元测试。
3. **SNPCoverage 缓存未包含 `selectedCells`**
   — 选择变化后覆盖度视图不会自动刷新。
4. **持续渲染** — `EmbeddingCanvas` 使用 `requestAnimationFrame`
   无限循环，后续可改为按需渲染。
5. **Camera 状态未持久化** — camera 存在 `useRef` 的 volatile 对象中。

---

## 建议下一步（任选其一）

1. **修复 SNPCoverage 选择变化不刷新**：让 `SNPCoverageAdapter` 的缓存 key 包含
   `selectedCells`，或新增 `SingleCellSNPCoverageAdapter`。
2. **为 `EmbeddingCanvas`、`LassoOverlay`、`camera` 添加单元测试**。
3. **优化 Dense X 读取**：避免读取整个 `X` 矩阵。
4. **实现 Track 头部过滤图标/提示**：在 `SingleCellAlignmentsTrack`
   显示当前是否有过滤。

---

_本文件用于进度对齐，后续实现完成一项即可更新对应 checkbox。_
