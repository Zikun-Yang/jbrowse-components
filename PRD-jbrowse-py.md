# PRD：jbrowse-py — JBrowse 2 Python 交互包

**版本**：v0.1  
**日期**：2026-07-02  
**状态**：设计阶段  
**作者**：Claude Code（基于与项目维护者讨论）

---

## 1. 背景与目标

### 1.1 项目背景

JBrowse 2 是一个基于 React + TypeScript +
mobx-state-tree（MST）的模块化基因组浏览器。当前项目中的 JBrowse 运行在本地开发环境（`products/jbrowse-web`），尚未部署为公开网站。

### 1.2 问题陈述

- AI 助手难以一次性正确构造 JBrowse 的完整配置（assembly、tracks、region、display
  settings 等）。
- JBrowse 的运行时状态（当前视图、已加载轨道、用户选择）对其余工具/脚本不可见。
- 生物信息学工作流中，Python 是主要脚本语言，但 JBrowse
  2 缺少一个官方的、AI 友好的 Python 接口。

### 1.3 产品目标

构建一个 Python 包
`jbrowse-py`（暂定名），让 AI 和普通用户都能用几行 Python 代码：

1. **查询** JBrowse 中有什么基因组、轨道、当前视图状态。
2. **生成** 符合 JBrowse 2 规范的 `config.json` 和 `session.json`。
3. **控制** 本地运行的 JBrowse 实例（导航、加轨道、改配置）。
4. **生成可分享链接**（未来 JBrowse 部署为公开网站后）。

---

## 2. 目标用户与使用场景

### 2.1 主要用户

| 用户             | 使用方式                             | 目标                                         |
| ---------------- | ------------------------------------ | -------------------------------------------- |
| AI 助手          | 通过 function calling 或代码生成调用 | 帮用户打开指定基因组视图、加载数据、生成链接 |
| 生物信息学研究者 | 在 Jupyter Notebook / 脚本中使用     | 快速可视化分析结果                           |
| 开发者 / 运维    | 在 CI/CD 或数据管道中调用            | 自动生成可视化报告链接                       |

### 2.2 典型场景

**场景 A：AI 帮用户查看某基因组区域**

```python
browser = jbrowse.connect("http://localhost:3001")
browser.navigate("chr1:1000000-2000000")
```

**场景 B：AI 上传分析结果并生成可视化链接**

```python
session = jbrowse.Session(assembly="hg38")
session.add_track("sample.bam")
url = session.to_url(base_url="https://jbrowse.example.com/")
```

**场景 C：研究者在 Notebook 里交互式查看**

```python
session = jbrowse.Session(assembly="hg38")
session.add_track("expression.bigWig")
session.show()  # 在 notebook 中显示 iframe
```

---

## 3. 产品范围

### 3.1 In Scope（第一阶段）

- Python 包安装：`pip install jbrowse-py`
- 本地 config 生成（`Session` 类）
- 内置常见 assembly presets：`hg19`、`hg38`、`GRCh38`、`mm10`
- 自动推断 track adapter 类型：`BAM`、`CRAM`、`VCF`、`GFF3`、`bigWig`、`bigBed`
- 自动查找 index 文件（`.bai`、`.tbi`、`.csi`、`.crai`）
- 本地文件复制/整理到 JBrowse public 目录
- 生成本地可访问 URL（`?config=/my-session/config.json`）
- 最小 Control Bridge：只读状态查询（assemblies、tracks、session snapshot）

### 3.2 Out of Scope（第一阶段）

- 公开网站的文件上传/托管服务
- 用户认证与权限管理
- 实时协同编辑
- 覆盖 JBrowse 所有 plugin 和 adapter 类型
- 桌面版 JBrowse（Electron）的特殊处理

### 3.3 Future Scope

- 公开 URL 生成 + 云存储上传（S3 / GCS）
- 完整 Control Bridge：写操作（navigate、addTrack、setConfig）
- JupyterLab extension / widget
- CLI 工具：`jbrowse-py create-session ...`
- 更多 adapter 和 assembly presets

---

## 4. 架构设计

### 4.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                       用户 / AI 助手                          │
│                   编写 Python 代码调用 jbrowse-py             │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                    jbrowse-py Python 包                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Session    │  │   Browser    │  │   Assembly   │       │
│  │  (配置生成)   │  │  (运行时连接) │  │   Presets    │       │
│  └──────────────┘  └──────┬───────┘  └──────────────┘       │
│                           │ HTTP GET/POST                    │
└───────────────────────────┼─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│              JBrowse Control Bridge（本地服务）               │
│              Express / 内嵌于 JBrowse 的 HTTP server         │
└───────────────────────────┬─────────────────────────────────┘
                            │ 直接访问
┌───────────────────────────▼─────────────────────────────────┐
│              JBrowse 2 运行时状态（MST rootModel）            │
│                   rootModel → session → views → tracks        │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 组件说明

#### 4.2.1 `Session` 类

负责静态配置生成。不依赖 JBrowse 是否运行。

核心方法：

- `__init__(assembly, ...)`
- `add_track(file, index=None, name=None, ...)`
- `set_region(region)`
- `save_to(output_dir)`
- `to_url(base_url, upload_config_to=None)`（Future）
- `to_dict()` / `to_json()`

#### 4.2.2 `Browser` 类

负责与运行中的 JBrowse 实例交互。

核心方法：

- `connect(url)` 类方法
- `list_assemblies()`
- `list_tracks(assembly=None)`
- `get_session_snapshot()`
- `get_region(view_id=None)`
- `navigate(region, view_id=None)`（Future）
- `add_track(...)`（Future）
- `set_track_config(track_id, config)`（Future）

#### 4.2.3 Control Bridge

一个轻量 HTTP 服务，嵌入或伴随 JBrowse 运行。

第一阶段只读端点：

| 方法 | 路径                     | 说明                      |
| ---- | ------------------------ | ------------------------- |
| GET  | `/api/assemblies`        | 列出所有 assembly         |
| GET  | `/api/tracks`            | 列出所有 track 配置       |
| GET  | `/api/views`             | 列出所有视图              |
| GET  | `/api/session`           | 返回完整 session snapshot |
| GET  | `/api/views/{id}/region` | 返回某视图当前区域        |

Future 写端点：

| 方法 | 路径                  | 说明           |
| ---- | --------------------- | -------------- |
| POST | `/api/navigate`       | 导航到指定区域 |
| POST | `/api/addTrack`       | 添加轨道       |
| POST | `/api/setTrackConfig` | 修改轨道配置   |
| POST | `/api/removeTrack`    | 移除轨道       |

---

## 5. API 设计（第一阶段）

### 5.1 配置生成：Session

```python
import jbrowse

# 使用内置 assembly preset
session = jbrowse.Session(assembly="hg38")

# 添加本地文件轨道，自动推断类型和 index
session.add_track("data/sample.bam")
session.add_track("data/variants.vcf.gz", name="My Variants")

# 添加远程文件
session.add_track(
    "https://example.com/signal.bigWig",
    name="ChIP-seq signal",
)

# 设置打开时的初始区域
session.set_region("chr1:1000000-2000000")

# 保存到本地目录，生成 config.json + 复制数据文件
session.save_to("products/jbrowse-web/public/my-session/")
```

保存后文件结构：

```
products/jbrowse-web/public/my-session/
├── config.json
├── session.json
└── data/
    ├── sample.bam
    ├── sample.bam.bai
    ├── variants.vcf.gz
    └── variants.vcf.gz.tbi
```

用户打开：

```
http://localhost:3000/?config=/my-session/config.json
```

### 5.2 状态查询：Browser

```python
import jbrowse

# 连接到本地 JBrowse Control Bridge
browser = jbrowse.Browser.connect("http://localhost:3001")

# 查询有什么基因组
assemblies = browser.list_assemblies()
# ["hg38", "mm10"]

# 查询有什么轨道
tracks = browser.list_tracks(assembly="hg38")
# [{"id": "genes", "name": "Gene annotations", "type": "FeatureTrack"}, ...]

# 查询当前视图区域
region = browser.get_region()
# {"refName": "chr1", "start": 1000000, "end": 2000000}

# 拿到完整 session snapshot（用于保存或分析）
snapshot = browser.get_session_snapshot()
```

### 5.3 类型推断规则

`add_track()` 根据文件后缀自动选择 adapter：

| 文件后缀               | Adapter               | 默认 index       |
| ---------------------- | --------------------- | ---------------- |
| `.bam`                 | `BamAdapter`          | `.bam.bai`       |
| `.cram`                | `CramAdapter`         | `.cram.crai`     |
| `.vcf.gz`              | `VcfTabixAdapter`     | `.tbi` 或 `.csi` |
| `.gff.gz` / `.gff3.gz` | `Gff3TabixAdapter`    | `.tbi` 或 `.csi` |
| `.bigWig` / `.bw`      | `BigWigAdapter`       | 无               |
| `.bigBed` / `.bb`      | `BigBedAdapter`       | 无               |
| `.fa` / `.fasta`       | `IndexedFastaAdapter` | `.fai`           |
| `.2bit`                | `TwoBitAdapter`       | 无               |

---

## 6. 内置 Assembly Presets（第一阶段）

每个 preset 包含：`name`、`sequence`、`refNameAliases`、`cytobands` 等最小配置。

| Preset ID | 说明          |
| --------- | ------------- |
| `hg19`    | GRCh37 / hg19 |
| `hg38`    | GRCh38 / hg38 |
| `GRCh38`  | 同 hg38       |
| `mm10`    | GRCm38 / mm10 |

设计为可扩展：用户也可以传入自定义 assembly dict。

---

## 7. Control Bridge 详细设计

### 7.1 部署方式

Control Bridge 是一个独立的 TypeScript/Node 服务，通过以下方式之一启动：

1. **作为 JBrowse 插件加载**（推荐）：
   - 在 JBrowse 配置中注册一个 runtime plugin。
   - plugin 启动一个本地 HTTP server。
   - 直接访问 `rootModel` 和 `session`。

2. **作为独立进程运行**：
   - 单独启动一个 Express server。
   - 通过 postMessage / WebSocket 与 JBrowse 通信。
   - 适用于不想改 JBrowse 核心代码的场景。

### 7.2 第一阶段端点规范

#### GET /api/assemblies

返回当前 JBrowse 配置中的所有 assembly。

```json
{
  "assemblies": [
    {
      "name": "hg38",
      "displayName": "Homo sapiens (GRCh38/hg38)"
    }
  ]
}
```

#### GET /api/tracks

返回当前配置中的所有 track 定义。

```json
{
  "tracks": [
    {
      "trackId": "genes",
      "name": "Gene annotations",
      "assemblyNames": ["hg38"],
      "type": "FeatureTrack"
    }
  ]
}
```

#### GET /api/views

返回当前 session 中的所有视图。

```json
{
  "views": [
    {
      "id": "linearGenomeView-1",
      "type": "LinearGenomeView",
      "displayedRegions": [
        {
          "assemblyName": "hg38",
          "refName": "chr1",
          "start": 0,
          "end": 248956422
        }
      ]
    }
  ]
}
```

#### GET /api/session

返回完整 MST session snapshot。

```json
{
  "session": { ... }
}
```

### 7.3 安全说明

Control
Bridge 第一阶段只读，无写操作，因此本地使用风险极低。Future 加入写端点时，必须：

- 默认只绑定 `127.0.0.1`，不暴露到公网。
- 可选开启 token / CORS 白名单。
- 公开部署时，写端点必须关闭或加认证。

---

## 8. 本地开发工作流

```bash
# 1. 安装 Python 包
pip install jbrowse-py

# 2. 在 Python 中生成配置
python -c "
import jbrowse
session = jbrowse.Session(assembly='hg38')
session.add_track('data/sample.bam')
session.save_to('products/jbrowse-web/public/my-session/')
"

# 3. 启动 JBrowse
cd products/jbrowse-web && pnpm start

# 4. 浏览器打开
open http://localhost:3000/?config=/my-session/config.json
```

---

## 9. 公开网站 Future Mode

当 JBrowse 部署为公开网站后，`Session.to_url()` 将支持：

```python
url = session.to_url(
    base_url="https://jbrowse.example.com/",
    upload_config_to="s3://public-bucket/jbrowse-sessions/",
)
```

内部流程：

1. 生成 `config.json`。
2. 把 config 和数据文件上传到指定存储。
3. 返回公开可访问 URL：
   `https://jbrowse.example.com/?config=https://s3.amazonaws.com/.../config.json`

---

## 10. 成功标准

### 10.1 功能标准

- [ ] AI 可以用 3-5 行 Python 生成一个本地可运行的 JBrowse config。
- [ ] 生成的 config 在本地 JBrowse 中正确显示 assembly、region 和 tracks。
- [ ] `Browser.list_assemblies()`、`list_tracks()`、`get_region()`
      返回准确数据。
- [ ] 自动推断 BAM、VCF、bigWig 三种最常见文件类型。

### 10.2 体验标准

- [ ] 错误信息清晰（文件不存在、index 缺失、assembly 不支持等）。
- [ ] API 命名直观，不需要用户理解 JBrowse 内部 MST 结构。
- [ ] 文档包含至少 3 个 AI 可用的代码示例。

---

## 11. 项目结构建议

```
jbrowse-components/
├── products/jbrowse-web/          # 现有 JBrowse web 产品
├── plugins/...                     # 现有插件
└── tools/
    └── jbrowse-py/                 # 新增 Python 包
        ├── jbrowse/
        │   ├── __init__.py
        │   ├── session.py          # Session 类
        │   ├── browser.py          # Browser 类
        │   ├── adapters.py         # 文件类型推断
        │   ├── presets.py          # Assembly presets
        │   ├── utils.py
        │   └── control_bridge/     # Control Bridge 相关（Future）
        ├── tests/
        ├── README.md
        ├── pyproject.toml
        └── setup.py
```

---

## 12. 里程碑规划

### Milestone 1：最小可用原型（MVP）

目标：AI 能生成一个本地可运行的 hg38 + BAM 配置。

- [ ] 创建 `tools/jbrowse-py/` 项目结构。
- [ ] 实现 `Session` 类 + `hg38` preset。
- [ ] 实现 `add_track()` 对 `.bam` 和 `.vcf.gz` 的自动推断。
- [ ] 实现 `save_to()` 生成 config + 复制文件。
- [ ] 写一个示例脚本验证本地 JBrowse 能打开。

### Milestone 2：状态查询

目标：Python 能读取本地 JBrowse 的运行时状态。

- [ ] 实现最小 Control Bridge（只读）。
- [ ] 实现 `Browser` 类的
      `connect()`、`list_assemblies()`、`list_tracks()`、`get_region()`。
- [ ] 在 JBrowse 中加载 Control Bridge plugin。

### Milestone 3：扩展格式与公开链接

目标：支持更多文件类型，并能生成公开 URL。

- [ ] 增加 bigWig、bigBed、GFF3、CRAM 支持。
- [ ] 增加更多 assembly presets。
- [ ] 实现 `to_url()` + S3/GCS 上传。

### Milestone 4：开发者体验

- [ ] Jupyter Notebook 集成。
- [ ] CLI 工具。
- [ ] PyPI 发布。
- [ ] 完整文档和教程。

---

## 13. 风险与依赖

| 风险                                    | 影响 | 缓解措施                                         |
| --------------------------------------- | ---- | ------------------------------------------------ |
| JBrowse config 格式变化                 | 中   | 保持 JBrowse 版本 pin，测试覆盖                  |
| Control Bridge 与 JBrowse 内部 API 耦合 | 中   | 通过 MST snapshot 访问，避免直接依赖私有方法     |
| 文件路径在本地和云端不一致              | 中   | `save_to()` 和 `to_url()` 使用不同的路径生成策略 |
| 公开部署的 CORS / 认证问题              | 高   | Future scope，第一阶段不涉及                     |
| 用户环境缺少 Python / pip               | 低   | 提供清晰安装说明，未来考虑 conda                 |

---

## 14. 待决策问题

1. Python 包最终命名：`jbrowse-py`、`pyjbrowse`、还是其他？
2. Control Bridge 是作为 JBrowse plugin 实现，还是独立服务？
3. Python 包放在 `tools/jbrowse-py/` 还是仓库外独立仓库？
4. 是否第一阶段就支持自定义 assembly，还是先只支持 presets？
5. 是否同时提供同步和异步 API？

---

## 15. 附录：参考文档

- [JBrowse 2 配置文档](https://jbrowse.org/jb2/docs/config/)
- [JBrowse 2 插件开发](https://jbrowse.org/jb2/docs/developer_guide/)
- [Model Context Protocol 规范](https://modelcontextprotocol.io/)
- [UCSC Genome Browser MCP Server](https://github.com/hlydecker/ucsc-genome-mcp)
- [MCP Server Architecture Patterns](https://arxiv.org/html/2606.30317v1)
