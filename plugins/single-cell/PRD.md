# JBrowse 2 Single Cell Visualization Plugin — PRD

> Status: Planning | Target: `plugins/single-cell/`
> Reference: CellXGene (`/home/zkyang/github_repo/dev/cellxgene/client/src`)

---

## 0. 总体设计原则

1. **JBrowse 2 原生优先**：所有代码遵循现有插件架构（MST、PluggableElementTypes、ConfigurationSchema），不引入外部状态管理（CellXGene 用 Redux，我们全部用 MST）。
2. **CellXGene 取其精华**：参考其 `regl` WebGL 渲染管线、`AnnoMatrix` 数据代理设计、`Lasso` 选择交互，但接口全部 JBrowse 化。
3. **Zarr 为唯一输入格式**：不直接在浏览器读 `.h5ad`（依赖复杂），要求用户预先用 CLI 将 h5ad 导出为 Zarr v2/v3。
4. **Add 菜单一级入口**：像 `CircularView`、`DotplotView` 一样，在顶部菜单 `Add` → `Single cell view` 中展开。

---

## Phase 0: 插件脚手架与 Add 菜单注册

### 目标
创建 `plugins/single-cell` 目录，完成最小可编译插件，注册 `SingleCellView`，在 `Add` 菜单中显示入口。

### 需求详述

#### 0.1 目录结构
```
plugins/single-cell/
├── package.json              # 仿 circular-view，依赖 @jbrowse/core, regl, zarr
├── tsconfig.json / tsconfig.build.esm.json
├── src/
│   ├── index.ts              # Plugin 类，install() + configure()
│   ├── SingleCellView/
│   │   ├── index.ts          # ViewType 注册工厂
│   │   ├── model.ts          # MST state model（最小版）
│   │   └── components/
│   │       ├── SingleCellView.tsx    # React 容器（占位）
│   │       └── ImportForm.tsx        # 数据集选择/加载表单
│   └── SingleCellAdapter/
│       └── index.ts          # 占位 AdapterType 注册
└── PRD.md
```

#### 0.2 Plugin 注册（参考 `CircularViewPlugin`）

```typescript
// src/index.ts
import ScatterPlotIcon from '@mui/icons-material/ScatterPlot'

export default class SingleCellPlugin extends Plugin {
  name = 'SingleCellPlugin'

  install(pluginManager: PluginManager) {
    SingleCellViewF(pluginManager)
    SingleCellAdapterF(pluginManager)
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToSubMenu(['Add'], {
        label: 'Single cell view',
        icon: ScatterPlotIcon,
        onClick: (session: AbstractSessionModel) => {
          session.addView('SingleCellView', {})
        },
      })
    }
  }
}
```

#### 0.3 ViewType 最小注册

```typescript
// src/SingleCellView/index.ts
export default function SingleCellViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(
    () =>
      new ViewType({
        ReactComponent: lazy(() => import('./components/SingleCellView.tsx')),
        stateModel: stateModelFactory(pluginManager),
        name: 'SingleCellView',
        displayName: 'Single cell view',
      }),
  )
}
```

#### 0.4 Model 最小骨架

```typescript
// src/SingleCellView/model.ts
function stateModelFactory(pluginManager: PluginManager) {
  return types.compose(
    'SingleCellView',
    BaseViewModel,
    types.model({
      type: types.literal('SingleCellView'),
      dataset: types.maybe(types.string),        // zarr path
      embedding: types.maybe(types.string),      // e.g. 'X_umap'
      colorBy: types.maybe(types.string),        // e.g. 'cell_type'
      // Phase 2 再补充 selection、camera、etc.
    }),
  )
}
```

### 验收标准
- [ ] `pnpm build` 在 `plugins/single-cell` 中通过
- [ ] 在 JBrowse web app 中点击 `Add` → `Single cell view`，成功创建一个空白视图
- [ ] 视图可关闭、可 resize、有标题栏

---

## Phase 1: 数据层 — Zarr/AnnData Adapter

### 目标
实现 `SingleCellDataAdapter`，支持从 Zarr 目录读取 AnnData 的 `obs`、`var`、`obsm`、`X`，并设计一个可扩展的数据代理层。

### 需求详述

#### 1.1 输入数据格式

用户通过 CLI 预处理：
```bash
# 未来由 jbrowse-cli 提供
jbrowse singlecell-preprocess \
  --input pbmc.h5ad \
  --output pbmc.zarr/ \
  --add-genome-coords     # 如果 obsm/var 含 ATAC peak 坐标，生成 .zarr/genome_coords/
```

Zarr 目录结构：
```
pbmc.zarr/
├── obs/                    # DataFrame (cells × metadata)
│   ├── __categories/       # categorical columns
│   ├── cell_type/
│   ├── leiden/
│   └── ...
├── var/                    # DataFrame (features × metadata)
│   ├── feature_types/
│   └── genome_coord/       # 可选：chr,start,end for ATAC peaks
├── obsm/
│   ├── X_umap/             # 2D array (n_cells × 2)
│   └── X_pca/
├── X/                      # Sparse or dense expression matrix
│   ├── data
│   ├── indices
│   ├── indptr
│   └── shape
└── uns/                    # unstructured metadata
    └── defaults.json       # 默认 colorBy、默认 embedding
```

#### 1.2 Adapter 设计（参考 CellXGene `AnnoMatrix`）

CellXGene 的 `AnnoMatrix` 是一个**不可变数据代理**，核心思想：
- 所有数据访问通过 `fetch(field, query)` 异步进行
- 内部有 `_cache` 做 LRU 缓存
- 支持视图堆叠（`subset`, `clip` 等），但我们要简化

JBrowse 化设计：

```typescript
// src/SingleCellAdapter/SingleCellDataAdapter.ts
interface SingleCellZarrData {
  // 元数据（小，可全量加载）
  obsSchema: DataFrameSchema           // cell metadata schema
  varSchema: DataFrameSchema           // feature metadata schema
  nObs: number
  nVar: number

  // 数据（按需分块加载）
  getObsColumn(col: string): Promise<TypedArray>
  getObsm(embedding: string): Promise<Float32Array>   // [x0,y0,x1,y1,...]
  getExpression(gene: string): Promise<Float32Array>  // 某基因在所有细胞的表达
  getVarColumn(col: string): Promise<TypedArray>

  // 基因组联动专用
  getCellsInRegion(chr: string, start: number, end: number): Promise<Set<string>>
}
```

#### 1.3 Zarr 读取实现

使用 `zarr.js`（v3）直接读取：

```typescript
import { openArray, openGroup } from 'zarr'

class SingleCellZarrLoader {
  private root: ZarrGroup

  async init(url: string) {
    this.root = await openGroup(url)
  }

  async getObsm(name: string): Promise<Float32Array> {
    const arr = await openArray({ store: this.root.store, path: `obsm/${name}` })
    const data = await arr.get() as TypedArray
    return new Float32Array(data.buffer)
  }

  async getObsColumn(name: string): Promise<TypedArray> {
    // 处理 categorical：先读 codes，再读 categories
    const arr = await openArray({ store: this.root.store, path: `obs/${name}` })
    // ... decode categorical if needed
  }
}
```

#### 1.4 AdapterType 注册

```typescript
// src/SingleCellAdapter/index.ts
pluginManager.addAdapterType(
  () => new AdapterType({
    name: 'SingleCellZarrAdapter',
    configSchema: singleCellAdapterConfigSchema,
    AdapterClass: SingleCellZarrAdapter,
  })
)
```

配置 Schema：
```typescript
const singleCellAdapterConfigSchema = ConfigurationSchema(
  'SingleCellZarrAdapter',
  {
    zarrLocation: { type: 'fileLocation', defaultValue: { uri: '' } },
    defaultEmbedding: { type: 'string', defaultValue: 'X_umap' },
    defaultColorBy: { type: 'string', defaultValue: 'cell_type' },
    obsIndexColumn: { type: 'string', defaultValue: 'index' },  // cell barcode column
  },
)
```

#### 1.5 MST Model 集成

`SingleCellView` model 增加：

```typescript
adapter: types.maybe(types.reference(adapterConfigSchema))
data: types.frozen<SingleCellZarrData | undefined>()
loading: types.optional(types.boolean, false)
error: types.maybe(types.string)

actions: {
  async loadDataset(adapterConfig) {
    self.loading = true
    try {
      const loader = new SingleCellZarrLoader(adapterConfig.zarrLocation.uri)
      await loader.init()
      self.data = loader          // frozen 存储，不追踪内部变化
      self.adapter = adapterConfig
    } catch (e) {
      self.error = String(e)
    } finally {
      self.loading = false
    }
  }
}
```

### 验收标准
- [ ] 能成功加载一个公开单细胞 Zarr 数据集（如 10x PBMC 3k），读取 `obs` 和 `X_umap`
- [ ] `obs` 中的 categorical 列正确解码为字符串标签
- [ ] 加载过程有 loading spinner，失败有 error message
- [ ] 单元测试：mock zarr 内存 store，验证 `getObsm`、`getObsColumn` 正确性

---

## Phase 2: SingleCellView WebGL UMAP 核心

### 目标
在 `SingleCellView` 中实现高性能 WebGL 散点图渲染，支持平移缩放、Lasso/矩形选择、Color by 分类/连续值。

### 需求详述

#### 2.1 渲染管线（参考 CellXGene `drawPointsRegl`）

CellXGene 的渲染核心非常精炼：
- **一个 `regl` draw call**：`primitive: 'points'`
- **三个 attribute**：`position` (vec2), `color` (vec3), `flag` (float)
- **一个 camera transform**：`projView` 矩阵处理平移缩放
- **Shader 中处理三种状态**：background (灰色半透明) / selected (正常大小) / highlight (放大)

我们复刻这个管线，但用 TypeScript + React hooks：

```typescript
// src/SingleCellView/components/EmbeddingCanvas.tsx
interface PointFlags {
  BACKGROUND = 1 << 0
  SELECTED   = 1 << 1
  HIGHLIGHT  = 1 << 2
}

function EmbeddingCanvas({
  positions,      // Float32Array(2 * n)
  colors,         // Float32Array(3 * n)
  flags,          // Uint8Array(n)
  nPoints,
  selectedCells,  // Set<string> or BitSet
  onLassoEnd,     // (polygon: [x,y][]) => void
  onBrushEnd,     // (rect: {x0,y0,x1,y1}) => void
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reglRef = useRef<Regl>()
  const cameraRef = useRef<Camera>()

  useEffect(() => {
    const canvas = canvasRef.current!
    const regl = createRegl({ canvas })
    const camera = createCamera(canvas)
    const drawPoints = createDrawPointsRegl(regl)

    // 预分配 buffer，每次更新 subdata
    const posBuffer = regl.buffer(positions)
    const colorBuffer = regl.buffer(colors)
    const flagBuffer = regl.buffer(flags)

    const frame = regl.frame(() => {
      regl.clear({ color: [1, 1, 1, 1] })
      drawPoints({
        position: posBuffer,
        color: colorBuffer,
        flag: flagBuffer,
        count: nPoints,
        projView: camera.view(),
        distance: camera.distance(),
        nPoints,
        minViewportDimension: Math.min(canvas.width, canvas.height),
      })
    })

    return () => frame.cancel()
  }, [])
}
```

**Vertex Shader**（直接翻译 CellXGene）：
```glsl
precision mediump float;
attribute vec2 position;
attribute vec3 color;
attribute float flag;
uniform float distance;
uniform mat3 projView;
uniform float nPoints;
uniform float minViewportDimension;
varying lowp vec4 fragColor;

// getFlags() 和 pointSize() 内联自 glHelpers
void main() {
  bool isBackground = (int(flag) & 1) != 0;
  bool isSelected   = (int(flag) & 2) != 0;
  bool isHighlight  = (int(flag) & 4) != 0;

  // 动态点大小：细胞越多，点越小；选中/高亮更大
  float baseSize = max(2.0, 8.0 - log(nPoints) * 0.5);
  float size = isHighlight ? baseSize * 2.0 : (isSelected ? baseSize * 1.5 : baseSize);
  gl_PointSize = size * pow(distance, 0.5);

  // Z-order：background 在后，highlight 在前
  float z = isBackground ? 0.99 : (isHighlight ? -1.0 : 0.0);
  vec3 xy = projView * vec3(position, 1.0);
  gl_Position = vec4(xy.xy, z, 1.0);

  float alpha = isBackground ? 0.15 : 1.0;
  fragColor = vec4(color, alpha);
}
```

**Fragment Shader**（画圆点）：
```glsl
precision mediump float;
varying lowp vec4 fragColor;
void main() {
  if (length(gl_PointCoord.xy - 0.5) > 0.5) discard;
  gl_FragColor = fragColor;
}
```

#### 2.2 Camera 系统（2D 平移缩放）

参考 CellXGene `camera.js`（基于 `gl-matrix` 的 mat3）：

```typescript
interface Camera {
  view(): mat3           // 返回 projView 矩阵
  distance(): number     // 缩放距离，用于动态点大小
  pan(dx: number, dy: number): void
  zoom(factor: number, cx: number, cy: number): void
  reset(): void
}

// 鼠标事件绑定
// - drag → pan
// - wheel → zoom at cursor
// - dblclick → reset
```

#### 2.3 Lasso 选择（参考 CellXGene `setupLasso.js`）

在 Canvas 上方覆盖一个 SVG 层处理交互：

```typescript
// src/SingleCellView/components/LassoOverlay.tsx
function LassoOverlay({
  width, height,
  onLassoEnd,
  onRectEnd,
  mode, // 'lasso' | 'rect' | 'pan'
}: Props) {
  // 用 d3-drag 或原生事件实现
  // lasso: mousedown → mousemove 收集点 → mouseup 闭合
  // rect: mousedown → mousemove 画矩形 → mouseup

  // 关键：屏幕坐标 → 数据坐标 → 判断点是否在多边形内
  const screenToData = (sx: number, sy: number) => {
    // 用 camera.inverseView() 转换
  }

  // 点在多边形内检测（射线法）
  const pointInPolygon = (p: [number, number], poly: [number, number][]) => { ... }
}
```

CellXGene 的 Lasso 细节：
- 拖拽过程中实时画虚线路径
- 终点距离起点 < 75px 时自动闭合，路径变绿色
- 支持取消（未闭合时释放鼠标）

#### 2.4 Color By 系统（参考 CellXGene `colorHelpers.js`）

支持三种 Color Mode：

| Mode | 数据来源 | 色标 |
|---|---|---|
| `categorical metadata` | `obs.{column}` | D3 `scaleOrdinal` (Table10/20) |
| `continuous metadata` | `obs.{column}` | D3 `scaleSequential` (viridis) |
| `expression` | `X[:, gene_index]` | D3 `scaleSequential` (viridis) |

实现：

```typescript
function computeColors(
  mode: ColorMode,
  accessor: string,
  data: SingleCellZarrData,
): Float32Array {
  switch (mode) {
    case 'categorical': {
      const labels = data.getObsColumn(accessor) as string[]
      const unique = [...new Set(labels)]
      const scale = d3.scaleOrdinal(d3.schemeTableau10).domain(unique)
      const rgb = new Float32Array(labels.length * 3)
      for (let i = 0; i < labels.length; i++) {
        const [r, g, b] = d3.color(scale(labels[i]))!.rgb()
        rgb[i * 3] = r / 255
        rgb[i * 3 + 1] = g / 255
        rgb[i * 3 + 2] = b / 255
      }
      return rgb
    }
    case 'continuous':
    case 'expression': {
      const values = mode === 'expression'
        ? data.getExpression(accessor)
        : data.getObsColumn(accessor)
      const scale = d3.scaleSequential(d3.interpolateViridis)
        .domain([d3.min(values)!, d3.max(values)!])
      // ... 同上填充 rgb
    }
  }
}
```

#### 2.5 视图组件布局

```
┌─────────────────────────────────────────┐
│  SingleCellView.tsx (MST 容器)           │
│  ┌─────────────────────────────────────┐│
│  │ Toolbar                              ││
│  │ [Embedding: UMAP ▼] [Color: cell_type▼]││
│  │ [Tool: Pan | Lasso | Rect] [Reset]   ││
│  ├─────────────────────────────────────┤│
│  │ EmbeddingCanvas (WebGL)              ││
│  │  + LassoOverlay (SVG, pointer-events)││
│  ├─────────────────────────────────────┤│
│  │ Legend (分类色标 / 连续色标)          ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

#### 2.6 Model 扩展

```typescript
types.model({
  // ...Phase 0/1 fields...

  // 渲染状态
  embedding: types.optional(types.string, 'X_umap'),
  colorMode: types.optional(
    types.enumeration(['categorical', 'continuous', 'expression']),
    'categorical',
  ),
  colorBy: types.optional(types.string, 'cell_type'),
  colorByGene: types.maybe(types.string),     // expression mode 时用的基因名

  // 交互状态
  selectedCells: types.frozen<Set<string>>(new Set()),
  highlightedCluster: types.maybe(types.string),
  selectionTool: types.optional(
    types.enumeration(['pan', 'lasso', 'rect']),
    'pan',
  ),

  // Camera（不存整个矩阵，只存可序列化的参数）
  cameraOffset: types.optional(types.array(types.number), [0, 0]),
  cameraScale: types.optional(types.number, 1),
})
.actions(self => ({
  setSelectedCells(cells: Set<string>) {
    self.selectedCells = cells as unknown as typeof self.selectedCells
  },
  setColorBy(mode, accessor, gene?) {
    self.colorMode = mode
    self.colorBy = accessor
    self.colorByGene = gene
  },
  setSelectionTool(tool: 'pan' | 'lasso' | 'rect') {
    self.selectionTool = tool
  },
}))
```

### 验收标准
- [ ] 10 万细胞 UMAP 在 60fps 下平移缩放
- [ ] Lasso 选择后，选中细胞高亮，其余变半透明（flag 系统工作）
- [ ] Color by `cell_type` 显示正确分类颜色
- [ ] Color by 基因表达时，正确从 `X` 矩阵读取并着色
- [ ] Camera 状态可恢复（关闭再打开视图保持位置）
- [ ] 选择工具切换（Pan/Lasso/Rect）正常工作

---

## Phase 3: 基因组 ↔ 单细胞双向联动

### 目标
实现两个方向的实时联动：
1. **Genome → Single Cell**：在 LinearGenomeView 中选择区域 → UMAP 中只高亮在该区域有信号的细胞
2. **Single Cell → Genome**：在 UMAP 中 Lasso 选细胞 → 现有 Track（如 ATAC coverage）只显示这些细胞的信号

### 需求详述

#### 3.1 共享状态设计：Session 级 `SingleCellSelection`

在 MST session model 中新增一个共享状态节点（不污染现有 session，通过 plugin 的 `configure` 扩展）：

```typescript
// src/SessionExtension.ts
import { types } from '@jbrowse/mobx-state-tree'

export const SingleCellSelection = types.model('SingleCellSelection', {
  selectedCells: types.frozen<Set<string>>(new Set()),
  selectedRegion: types.maybe(types.frozen<Region>()),
  activeSingleCellViewId: types.maybe(types.string),
})
.actions(self => ({
  setSelectedCells(cells: Set<string>) {
    self.selectedCells = cells as unknown as typeof self.selectedCells
  },
  setSelectedRegion(region?: Region) {
    self.selectedRegion = region
  },
  setActiveSingleCellViewId(id?: string) {
    self.activeSingleCellViewId = id
  },
}))

// 在 plugin.configure() 中通过 pluginManager.rootModel 的 extend() 注入
```

#### 3.2 方向 A: Genome Region → Cell Filtering

**场景**: 用户在 ATAC track 上框选了一个 peak 区域，UMAP 上高亮在该区域有 reads 的细胞。

**数据准备**: 需要在 Zarr 中预计算或存储 `cell × region` 的关联：

```
pbmc.zarr/
├── genome_index/           # 新增：按基因组坐标索引的细胞信号
│   ├── chr1/
│   │   ├── 0_1000000/      # 1Mb 分块
│   │   │   └── cell_counts.zarr   # 每个细胞在该区域的 signal sum
│   └── ...
└── cell_barcodes.json      # 细胞 barcode 列表（与 obs index 对齐）
```

或者更简单：在 `var` 中存储 ATAC peak 坐标，通过 `X_atac` 矩阵（cell × peak）查询：

```typescript
// 给定基因组 region，找出覆盖它的 peaks
const overlappingPeaks = data.var
  .filter(v => v.chrom === region.refName && v.start < region.end && v.end > region.start)
  .map(v => v.index)

// 找出在这些 peaks 上有信号的细胞
const peakExpression = await data.getExpressionMatrixSubset(columns: overlappingPeaks)
// peakExpression: SparseMatrix (cells × peaks)
// 对每行（细胞）求和，> threshold 的细胞即为"活跃细胞"
```

**实现链路**:

```
LinearGenomeView.selection (rubberband)
        │
        ▼
Session.SingleCellSelection.selectedRegion = region
        │
        ▼
SingleCellView model reaction:
  when(selectedRegion changes) {
    computeActiveCells(region) → Set<string>
    self.selectedCells = activeCells
  }
        │
        ▼
EmbeddingCanvas flags updated:
  不在 selectedCells 中的细胞 → flag |= BACKGROUND
```

**性能考虑**: 
- 如果实时查询 `X` 矩阵太慢，预先将 `obs` 中增加一列 `peak_regions`（每个细胞覆盖的 peak 列表），但这会很大。
- **推荐**：在数据预处理阶段，按染色体窗口（如 100kb bins）预计算每个细胞的 signal，存储为 `uns/genome_bins_signal/`。查询时只需查几个 bins。

#### 3.3 方向 B: Cell Selection → Track Filtering

**场景**: 用户在 UMAP 上 Lasso 选了 500 个 Microglia 细胞，ATAC Coverage track 只显示这群细胞的 pileup。

**核心挑战**: 现有 `WiggleTrack` / `AlignmentsTrack` 的 `getFeatures` 没有 `cellIds` 过滤参数。

**方案**：扩展 `BaseOptions` + 适配器层面过滤

```typescript
// 扩展 BaseOptions（在 plugin 中扩展类型）
interface SingleCellOptions extends BaseOptions {
  cellBarcodes?: string[]     // 允许传入细胞 barcode 白名单
}
```

对于不同 track 类型的过滤策略：

| Track 类型 | 过滤方式 | 实现位置 |
|---|---|---|
| **Alignments (BAM/CRAM)** | 读取时过滤 `CB` tag（10x 格式） | `CramAdapter` / `BamAdapter` 扩展 |
| **Coverage (BigWig)** | 如果 bigWig 是 per-cluster 的，切换 source | 新增 `SingleCellBigWigAdapter` |
| **Coverage (预聚合)** | 实时从原始 scBAM 重新聚合 | Web Worker 中处理 |

**最实用的 MVP 实现**：预聚合 per-cluster Coverage

```
# 预处理
jbrowse singlecell-preprocess \
  --input scatac.bam \
  --cell-barcodes obs.csv \
  --cluster-col cell_type \
  --output coverage_by_cluster/
# 生成：Microglia.bw, Oligodendrocyte.bw, ...
```

然后在 JBrowse 配置中：
```json
{
  "type": "SingleCellWiggleTrack",
  "adapter": {
    "type": "SingleCellBigWigAdapter",
    "clusterBigWigs": {
      "Microglia": "coverage/Microglia.bw",
      "Oligodendrocyte": "coverage/Oligodendrocyte.bw",
      ...
    }
  }
}
```

当用户在 UMAP 上选择细胞后，根据选择细胞的聚类分布，动态合并对应的 bigWig（加权平均）。

**更灵活的实现（Phase 3.5）**：
对任意细胞子集，在 Web Worker 中从 scBAM 实时过滤 `CB` tag 并计算 coverage。这需要一个专门的 `SingleCellCoverageRenderer`。

#### 3.4 UI 联动反馈

- 当 UMAP 上有选择时，在视图顶部显示："500 cells selected"
- 在 LinearGenomeView 的 track 头部显示一个小图标，表示当前有过滤生效
- 提供一个 "Clear selection" 按钮，双向清除

### 验收标准
- [ ] 在 LGV 中框选区域后，UMAP 上对应细胞 200ms 内高亮
- [ ] 在 UMAP 上 Lasso 选细胞后，ATAC coverage track 自动刷新（显示仅选中细胞的信号）
- [ ] 选择状态在 session 关闭/恢复时正确序列化
- [ ] 多个 SingleCellView 实例之间不互相干扰（通过 `activeSingleCellViewId` 区分）

---

## Phase 4: 基因表达面板与统计图表

### 目标
添加基因搜索、Dot plot、Violin plot 面板，支持与 UMAP 的联动。

### 需求详述

#### 4.1 基因搜索面板

```
┌──────────────────────────────┐
│ 🔍 Search gene...            │
│ ┌──────────────────────────┐ │
│ │ ACTB  ✓                  │ │
│ │ GAPDH ✓                  │ │
│ │ SOX2  ☐                  │ │
│ └──────────────────────────┘ │
│ [Add to gene set]            │
└──────────────────────────────┘
```

参考 CellXGene `quickGene.js`：
- 输入时从 `var` 索引中搜索基因名
- 支持多选，形成 "active gene set"

#### 4.2 Dot Plot

展示基因集合 × 聚类的平均表达量矩阵。

```typescript
interface DotPlotData {
  genes: string[]
  clusters: string[]
  // value[i][j] = 聚类 j 中基因 i 的平均表达量
  values: number[][]
  // fraction[i][j] = 表达该基因的细胞比例（控制点大小）
  fractions: number[][]
}
```

用 `Observable Plot` 或 `visx` 渲染：
- X 轴：基因
- Y 轴：聚类
- 颜色：平均表达量（viridis）
- 点大小：表达比例

交互：
- Hover dot → 显示数值
- Click 聚类标签 → 在 UMAP 中高亮该聚类

#### 4.3 Violin Plot

对选中的单个基因，展示其在各聚类中的表达分布。

由于存储完整 per-cell per-gene 表达在浏览器中不现实，**需要预计算**：

```
pbmc.zarr/uns/violin_data/{gene_name}.json
# { cluster: [values...] }
```

或者从 `X` 矩阵按需提取（如果 gene 数量 < 1000 且 cell 数量 < 50k，可行）。

#### 4.4 与 UMAP 的联动

- **Color by gene**: 搜索并选择基因 → UMAP 自动切换为 `colorMode: 'expression'`
- **Hover cluster in dot plot** → UMAP 临时高亮该聚类（hover 状态，不写入 selectedCells）
- **Gene set average**: 选择多个基因 → 计算 mean expression → UMAP color by 均值

### 验收标准
- [ ] 基因搜索支持前缀匹配，100ms 内返回结果
- [ ] Dot plot 正确展示预计算的聚类均值
- [ ] 点击 Dot plot 上的聚类 → UMAP 上临时高亮对应细胞
- [ ] 选择的基因集合可以导出为列表

---

## Phase 5: 性能优化与产品化

### 目标
处理 >50 万细胞的大规模数据集，确保流畅交互。

### 需求详述

#### 5.1 超大规模渲染（>50万细胞）

| 细胞数 | 策略 |
|---|---|
| < 10万 | 原生 WebGL points，全部渲染 |
| 10-50万 | WebGL points + frustum culling（只渲染 viewport 内细胞） |
| > 50万 | **Datashader 策略**：降采样为密度热图，zoom in 后切换为 points |

**Datashader 简化实现**：
- 在 Web Worker 中将 viewport 分为 512×512 bins
- 每个 bin 计算细胞数量和最常见聚类
- 主线程用 WebGL 画一个 fullscreen quad，fragment shader 根据 density texture 着色

#### 5.2 数据流优化

- **Zarr chunking**: 确保 `obsm/X_umap` 的 chunk size 为 [8192, 2]（一行一个 cell，每 chunk 8192 cells）
- **Lazy expression**: `X` 矩阵只加载用户查询的基因列（如果 zarr 按 gene 分块）；否则需要 rechunk
- **BitSet**: `selectedCells` 用 `bitset.js` 替代 `Set<string>`（100万细胞 → 125KB vs 数MB）

#### 5.3 预聚合 Coverage（ATAC 联动关键）

对于 scATAC 数据，提供 CLI 工具预计算：

```bash
jbrowse singlecell-atac-preprocess \
  --input fragments.tsv.gz \
  --barcodes barcodes.tsv \
  --clusters clusters.csv \
  --genome hg38 \
  --bin-size 100 \
  --output scatac_coverage.zarr/

# 输出结构
scatac_coverage.zarr/
├── all/                    # 所有细胞
│   └── chr1/
│       └── 0_10000/
│           └── counts      # array (bin_count,)
├── Microglia/              # per-cluster
│   └── chr1/...
└── per_cell/               # 可选：按细胞（用于任意子集实时聚合）
    └── chr1/
        └── cell_barcodes/
            └── ...
```

#### 5.4 测试与文档

- **单元测试**：
  - `SingleCellZarrLoader.test.ts`：mock zarr memory store
  - `EmbeddingCanvas.test.ts`：验证 shader 编译、buffer 更新
  - `LassoOverlay.test.ts`：mock 鼠标事件，验证多边形检测
- **Image snapshot**：在 `products/jbrowse-web/src/tests/` 中添加单细胞视图的截图测试
- **Storybook**：在 `products/jbrowse-react-linear-genome-view` 或单独 storybook 中添加 SingleCellView stories
- **文档**：`website/docs/single_cell.md`

### 验收标准
- [ ] 100 万细胞数据集能在 30 秒内完成初始加载（metadata + UMAP 坐标）
- [ ] 平移缩放保持 30fps 以上
- [ ] 所有 Phase 1-4 功能在 100 万细胞下正常工作
- [ ] 通过 CI 的 typecheck、lint、test
- [ ] 文档包含：数据格式说明、配置示例、CLI 预处理工具使用指南

---

## 附录 A: CellXGene 代码参考速查

| 功能 | CellXGene 文件 | 关键设计 |
|---|---|---|
| 数据代理 | `annoMatrix/annoMatrix.js` | 不可变对象，`_cache` 分层缓存，`fetch()` 异步解析 |
| 交叉筛选 | `annoMatrix/crossfilter.js` | 与 AnnoMatrix 同步的 Crossfilter 封装 |
| 数据加载 | `annoMatrix/loader.js` | HTTP 代理，PromiseLimit 并发控制 |
| WebGL 渲染 | `components/graph/drawPointsRegl.js` | 单 draw call，flag + color + position attribute |
| Lasso | `components/graph/setupLasso.js` | D3 drag，SVG 覆盖层，自动闭合距离 75px |
| Camera | `util/camera.js` | gl-matrix mat3，wheel 缩放，drag 平移 |
| 颜色系统 | `util/stateManager/colorHelpers.js` | categorical/continuous/expression 三模式，memoize 缓存 |
| 全局常量 | `globals.js` | 颜色、字体、布局尺寸常量 |
| 散点图 | `components/scatterplot/scatterplot.js` | 类似 Graph 但 x/y 轴用不同 scale |

---

## 附录 B: JBrowse 2 插件注册参考

| 元素 | 参考文件 | 注册方式 |
|---|---|---|
| ViewType | `plugins/circular-view/src/CircularView/index.ts` | `pluginManager.addViewType()` |
| 菜单项 | `plugins/circular-view/src/index.ts:configure()` | `rootModel.appendToSubMenu(['Add'], ...)` |
| AdapterType | `plugins/wiggle/src/BigWigAdapter/BigWigAdapter.ts` | `pluginManager.addAdapterType()` |
| DisplayType | `plugins/wiggle/src/XYPlotDisplay/index.ts` | `pluginManager.addDisplayType()` |
| RendererType | `plugins/wiggle/src/XYPlotRenderer/index.ts` | `pluginManager.addRendererType()` |
| WidgetType | 任意 plugin 的 `src/Widget/` | `pluginManager.addWidgetType()` |

---

## 附录 C: 数据格式转换脚本（Python 参考）

```python
#!/usr/bin/env python3
"""将 h5ad 预处理为 JBrowse SingleCell Zarr 格式"""
import scanpy as sc
import zarr
import numpy as np

def preprocess_for_jbrowse(adata: sc.AnnData, output_path: str):
    """
    1. 将 X 矩阵转为 CSC（按列访问基因更快）
    2. 确保 obsm 中的 embedding 为 float32
    3. 为 ATAC 数据，在 var 中保留 genome_coord
    4. 写入 Zarr
    """
    # 确保表达矩阵为 CSC（按列查询更快）
    if not adata.X.has_sorted_indices:
        adata.X.sort_indices()

    # 写入 Zarr
    adata.write_zarr(output_path)

    # 额外写入默认值
    root = zarr.open(output_path, mode='a')
    root.attrs['jbrowse_singlecell_version'] = '1.0'
    root.attrs['default_embedding'] = 'X_umap' if 'X_umap' in adata.obsm else list(adata.obsm.keys())[0]
    root.attrs['default_color_by'] = 'cell_type' if 'cell_type' in adata.obs else adata.obs.columns[0]

if __name__ == '__main__':
    import sys
    adata = sc.read_h5ad(sys.argv[1])
    preprocess_for_jbrowse(adata, sys.argv[2])
```

---

*PRD 版本: 1.0 | 最后更新: 2026-04-29*
