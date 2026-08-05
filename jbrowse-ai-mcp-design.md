# JBrowse 2 AI 调用设计：MCP 集成方案

> 背景：讨论如何让 JBrowse 2 这个基于 React + TypeScript +
> mobx-state-tree 的基因组浏览器，能够被 AI 方便地调用和控制。本文档汇总了头脑风暴、网上调研结果和最终推荐方案。

---

## 1. 核心问题

直接用传统 MCP 工具调用 JBrowse 很困难，因为：

- **参数空间巨大**：基因组、轨道、显示方式、配置项数量极多。
- **AI 不知道有什么可选**：AI 很难一次性正确填入
  `assemblyId`、`trackId`、region、config 等参数。
- **状态复杂**：视图、轨道、显示、渲染器是多层嵌套结构，且用户可能同时操作 UI。

所以关键不是让 AI 一次性构造完整 action，而是让它能**像拨洋葱一样逐级探索**当前能操作什么。

---

## 2. 关键调研发现

### 2.1 已有成功先例：UCSC Genome Browser MCP

[ucsc-genome-mcp](https://github.com/hlydecker/ucsc-genome-mcp) 已经把 UCSC
Genome Browser API 包装成 MCP server，包含 12 个工具，明确分成两类：

- **发现/浏览类**：`find_genome`、`list_ucsc_genomes`、`list_hub_genomes`、`list_tracks`、`list_chromosomes`、`list_schema`
- **数据/动作类**：`get_sequence`、`get_track_data`、`search_genome`

**启示**：先让 AI 用 `list_*`
工具探索有什么基因组/轨道/染色体，再调用精准的数据工具。

### 2.2 MCP 反模式：God Tool

2026 年一篇 MCP 架构论文（[arXiv:2606.30317](https://arxiv.org/html/2606.30317v1)）明确把
**The God Tool** 列为头号反模式：一个工具接收巨大 undifferentiated schema（如
`do_anything(action, params)`），LLM 的工具选择准确率会崩掉。

**结论**：必须把功能拆成多个聚焦的、命名清晰的小工具。

### 2.3 工具数量有上下文预算

同一篇论文报告：

- 小模型在 **10–15 个工具** 后准确率跌破 90%
- 大模型也撑不过 **20–30 个工具**

[mcp-cli](https://www.philschmid.de/mcp-cli)
的懒加载策略能把 60 个工具的全量 schema 从约 47,000 tokens 降到约 400 tokens。

**结论**：不能一次性把所有 JBrowse 配置项都暴露成工具，要让 AI 按需发现。

### 2.4 层级浏览没有原生协议支持

MCP 目前只有 flat 的 `resources/list` / `tools/list`
加 cursor 分页，没有原生层级。但业界通行两种约定：

1. **Resource URI 路径**：如 `repo://owner/repo/main/src/`
2. **专用 browse 工具**：如 Smartsheet MCP 的 `browse_workspace` →
   `browse_folder`

**结论**：JBrowse 的「拨洋葱」探索可以通过 URI 或专用工具名来实现，无需等协议原生支持。

### 2.5 生物信息学 MCP 生态正在兴起

- [BioinfoMCP](https://arxiv.org/abs/2510.02139)：把 38 个生物信息学 CLI 工具自动转成 MCP
  server
- [GenomAgent](https://thesis.unipd.it/retrieve/bd1f2742-1e66-49eb-b140-37ebd237ab1e/Computer_Engineering_MsC_Thesis___UniPD-26.pdf)：多智能体用 MCP 查询 NCBI、OMIM、UCSC、HGNC、BLAST
- [WebMCP](https://nohacks.co/blog/what-is-webmcp)：未来浏览器原生 MCP 标准

---

## 3. 推荐方案：Resource-oriented MCP Server

核心原则：**先发现，再引用，最后执行**。

### 3.1 用 MCP Resources 暴露层级状态

资源是只读的、可 URI 寻址的数据快照，适合让 AI 逐级浏览：

| Resource URI                                            | 含义                       |
| ------------------------------------------------------- | -------------------------- |
| `jbrowse://assemblies`                                  | 列出所有可用基因组         |
| `jbrowse://assembly/{id}`                               | 某个基因组的元信息         |
| `jbrowse://assembly/{id}/tracks`                        | 该基因组下的所有轨道       |
| `jbrowse://session/views`                               | 当前 session 中的所有视图  |
| `jbrowse://session/views/{viewId}`                      | 某个视图的当前状态         |
| `jbrowse://track/{trackId}`                             | 轨道当前配置               |
| `jbrowse://track/{trackId}/schema`                      | 轨道的 ConfigurationSchema |
| `jbrowse://track/{trackId}/features?region=chr1:1-1000` | 可见特征                   |

### 3.2 把工具拆成「发现类」和「动作类」

#### 发现类工具（Browse / Introspection）

| 工具名               | 作用                  |
| -------------------- | --------------------- |
| `listAssemblies`     | 列出可用基因组        |
| `listTracks`         | 列出某基因组下的轨道  |
| `listViews`          | 列出当前视图          |
| `getTrackSchema`     | 获取轨道配置 schema   |
| `getDisplaySchema`   | 获取显示层配置 schema |
| `getVisibleFeatures` | 获取某区域可见特征    |
| `searchTracks`       | 按名称/类型搜索轨道   |

#### 动作类工具（Action）

| 工具名             | 作用             |
| ------------------ | ---------------- |
| `navigate`         | 导航到指定区域   |
| `addTrack`         | 添加轨道         |
| `removeTrack`      | 移除轨道         |
| `setTrackConfig`   | 设置轨道配置项   |
| `setDisplayConfig` | 设置显示层配置项 |
| `setColorScheme`   | 设置配色方案     |
| `createView`       | 创建新视图       |
| `closeView`        | 关闭视图         |

### 3.3 暴露 JBrowse 的 ConfigurationSchema

JBrowse 已经有 `ConfigurationSchema`，每个 config
slot 都有类型、默认值、描述、可选枚举。直接把它转成 MCP
tool 的输入描述，AI 就能知道：

- 参数类型（string / number / stringArray / frozen / boolean）
- 默认值
- 是否必填
- 可选枚举值

这是避免 AI 瞎猜的关键。

### 3.4 可选：Stateful Session Server

如果 AI 需要在多轮对话中保持导航状态，可以为每次 AI 会话生成 session
ID，服务端保存当前 snapshot。这样可以避免：

- 用户 UI 操作和 AI 操作互相覆盖
- 多轮调用之间的状态漂移

---

## 4. 为什么不推荐纯「文件夹式 Markdown」浏览

用户曾提出类似嵌套 Markdown 文件夹的拨洋葱方式。这个思路方向对，但作为主要接口有问题：

| 问题       | 说明                               |
| ---------- | ---------------------------------- |
| 往返延迟高 | 每深入一层都要一次 LLM 调用        |
| 状态漂移   | 用户可能同时操作 UI，导致路径失效  |
| 上下文膨胀 | 每层都返回整棵子树会消耗大量 token |
| 不够标准化 | 自定义协议，其他 AI 工具难以复用   |

更好的方式是：**用 Resource-oriented
MCP 做发现，用聚焦工具做执行**。这样既保留拨洋葱能力，又符合生态标准。

---

## 5. 推荐实施路径

### 第一阶段：最小可运行原型（MVP）

在 `products/jbrowse-web` 中加一个 experimental MCP server（stdio 或 SSE）：

1. 通过 `window.__jbrowseModel` 或直接访问 MST rootModel/session 获取状态。
2. 实现 3 个核心功能：
   - `listAssemblies`
   - `navigate`
   - `setTrackConfig`
3. 验证 AI 能真正逐级操作：
   - AI 先调用 `listAssemblies`
   - 再用返回的 `assemblyId` 调用 `listTracks`
   - 再用返回的 `trackId` 调用 `getTrackSchema`
   - 最后调用 `setTrackConfig`

### 第二阶段：扩展覆盖

- 增加 `addTrack`、`removeTrack`、`createView`
- 暴露更多 ConfigurationSchema
- 加入缓存，减少重复 `list` 调用

### 第三阶段：可选集成

- 做成 JBrowse 插件，允许运行时加载
- 支持 WebMCP 等浏览器原生标准
- 支持 session 隔离

---

## 6. 风险与权衡

| 风险                     | 缓解方式                                           |
| ------------------------ | -------------------------------------------------- |
| 多轮发现增加延迟         | 缓存 assemblies、tracks、schema                    |
| 用户 UI 操作导致状态漂移 | 使用 session snapshot 或 session ID                |
| 工具数量过多             | 控制在 10–30 个聚焦工具，必要时按视图/插件分组     |
| MCP 协议没有原生层级     | 用 URI 和专用 browse 工具约定表达层级              |
| 安全性                   | MCP server 只读资源+受控动作，避免暴露敏感内部 API |

---

## 7. 参考来源

- [UCSC Genome Browser MCP server](https://github.com/hlydecker/ucsc-genome-mcp)
- [MCP Server Architecture Patterns for LLM-Integrated Applications](https://arxiv.org/html/2606.30317v1)
- [Introducing MCP CLI](https://www.philschmid.de/mcp-cli)
- [MCP vs mcp-cli: Dynamic Tool Discovery](https://techcommunity.microsoft.com/blog/azuredevcommunityblog/mcp-vs-mcp-cli-dynamic-tool-discovery-for-token-efficient-ai-agents/4494272)
- [BioinfoMCP: A Unified Platform Enabling MCP Interfaces in Agentic Bioinformatics](https://arxiv.org/abs/2510.02139)
- [Smartsheet MCP server tools](https://developers.smartsheet.com/ai-mcp/smartsheet/mcp-server-tools)
- [What are MCP resources? – Speakeasy](https://www.speakeasy.com/mcp/core-concepts/resources)
- [MCP architecture overview](https://modelcontextprotocol.io/docs/learn/architecture)
- [WebMCP explained](https://discoveredlabs.com/blog/google-webmcp-explained-the-complete-guide-to-web-model-context-protocol-for-ai-agents)

---

## 8. 一句话总结

> 不要给 JBrowse 做一个「God Tool」，而是做一个 **Resource-oriented MCP
> Server**：AI 先用 `list`/`getSchema` 逐级发现有什么，再用聚焦的
> `navigate`/`setTrackConfig` 等工具执行动作。
