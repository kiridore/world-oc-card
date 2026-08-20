# World OC Card —— OC 角色 × 世界观时间线创作工具 · 设计文档

> 版本：V1.3（2026-08-20）
> 变更：V1.3 新增 **§5 视觉风格规范**（冷灰大理石质感、双主题、低饱和颜色纪律、开源素材与图标政策）；百科条目名称改为项目内全局唯一（附录 A1）。V1.2 新增通用模板系统。V1.1 角色表改为全自由字段块模型、存储改为文件夹式多 JSON 文件、图片独立存储、明确写策略。
> 状态：已评审定稿，作为 V1 实施依据

---

## 1. 产品定位

面向**单人创作者**（OC / 原创世界观作者）的结构化创作工具，用于：

- 管理原创角色（OC）设定卡；
- 维护世界观百科（地点、势力、规则体系等）；
- 以**类 Git 的世界线模型**记录世界观历史：事件为节点，任意节点可分叉出 IF 世界线；
- 可视化角色关系图谱；
- 导出 / 分享作品设定。

**明确不做**：AI 生成与辅助功能；多人实时协作（V2 仅考虑个人数据上云）。

### 1.1 版本形态

| 版本 | 形态 | 数据存储 |
|------|------|----------|
| **V1（本期）** | 纯静态 SPA，可部署为静态站点（GitHub Pages / Nginx） | 浏览器 IndexedDB（多表、每实体一条记录）+ zip 文件夹导入/导出 |
| **V2（预留）** | Ubuntu 服务器挂 FastAPI 后端，URL 外网访问，可选用户账号与数据上云 | 磁盘文件树（与导出格式一致）或 SQLite JSON 列，前端切换到 RemoteRepository |

V1 的关键约束：**所有数据访问必须经过 Repository 适配器接口**，保证 V2 接后端时业务代码零改动。

---

## 2. 核心模块设计

### 2.1 角色表（Characters）

**除名称外，所有字段均由用户自由组合**——角色卡是字段块（FieldBlock）的树，类似 Notion block。系统固定字段只有 `id` 与 `name`（列表显示与被引用所需）。

```ts
interface Character {
  id: UUID;
  name: string;            // 唯一固定字段
  fieldBlocks: FieldBlock[];
  createdAt / updatedAt: string;
}

type FieldBlock =
  | { type: 'group';  title: string; children: FieldBlock[] }        // 分组块（可嵌套）
  | { type: 'kv';     title: string; items: { key; value }[] }       // 键值组（基础信息表）
  | { type: 'text';   title: string; content: string }               // Markdown 段落
  | { type: 'list';   title: string; items: string[] }               // 列表（别名、标签等）
  | { type: 'image';  title: string; assetId: UUID }                 // 图片（引用 assets，不内联）
  | { type: 'table';  title: string; header: string[]; rows: string[][] }
  | { type: 'link';   title: string; targetType: 'character'|'codexEntry'|'event'; targetId: UUID }
```

**规则与交互：**

- zod 只校验**骨架**（块类型合法、嵌套合法、引用格式合法），块内容不校验——自由与防损坏兼顾；
- 新建角色可选**模板**起稿，编辑中可"从模板插入"块组（模板系统见 §2.6）；
- 列表页搜索为全字段文本匹配（序列化所有块的文本）；任一 `list` 块可被标记为"标签块"（`flag: 'tags'`），其条目参与标签筛选；
- 删除角色时做**引用检查**：若被事件、关系、link 块引用，列出引用处并要求确认。

### 2.2 世界观百科（Codex）

条目化世界观设定，支持双向链接。

**条目类型（内置 + 自定义）：** 地点 / 势力 / 种族 / 物品 / 规则体系（魔法、科技、政治制度等）/ 自由类型。

**条目结构：**

| 字段 | 说明 |
|------|------|
| type | 条目类型 |
| name | 名称（**项目内全局唯一**，作为 `[[链接]]` 的无歧义解析依据；见附录 A1） |
| content | Markdown 正文，支持 `[[其他条目名]]` 双向链接 |
| attributes | { key, value }[] 结构化属性（如地点的坐标、人口） |
| color | 条目颜色（用于时间轴、图谱中的视觉标识） |

**交互：**
- 百科侧栏按类型分组；条目正文渲染时 `[[...]]` 转为可点击链接；
- 每个条目底部显示"被引用于"反向列表（其他条目、事件地点、角色 link 块）；
- 属性键集与正文骨架支持**模板**：如"地点"模板预置坐标/人口/气候等属性键（见 §2.6）。

### 2.3 关系图谱（Relationship Graph）

- **节点** = 角色（可选纳入势力）；
- **边** = 关系：`{ from, to, type, directed, description }`；
- 关系类型由用户自定义（亲属 / 敌对 / 恋人 / 从属 / 师徒…），带颜色与**箭头三态**（无箭头 / 单箭头 → / 双箭头 ↔，字段 `arrow`，schemaVersion 2 起替代布尔 `directed`；旧数据经迁移管道自动转换）；
- 渲染引擎：**AntV G6** 力导向布局，节点点击跳转角色卡，右键/双击边编辑关系；
- 支持按关系类型过滤显隐。

### 2.4 时间线与世界线（核心特色）

#### 2.4.1 概念模型（类 Git）

| 概念 | 对应 | 说明 |
|------|------|------|
| 事件（Event） | commit | 一次可编辑的世界观历史节点 |
| 世界线（Worldline） | branch | 一条历史线，第一条为"主世界线" |
| 分叉（Fork） | branch from commit | 在某事件节点处创建新 IF 线，记录 fork 点 |
| 世界线状态 | — | active / abandoned（废弃只做标记，不删除） |

**不做**真正的 merge 计算；跨线合并仅支持"标记引用另一条线的事件"。

#### 2.4.2 事件（Event）字段

| 字段 | 说明 |
|------|------|
| worldlineId | 所属世界线 |
| time | `{ calendarId, value: number, display: string }`——世界内纪年数值用于排序，display 为展示文本（如"第三纪元 217 年"） |
| title / description | 标题 + Markdown 描述 |
| participantIds | 参与角色 UUID[] |
| locationId | 地点（引用百科地点条目，可空） |
| causalLinks | UUID[] 因果指向的事件（画布连线） |
| canvasPos | `{ x, y }` 画布视图坐标 |
| collapsed / locked | 折叠态 / 锁定（定稿标记） |

#### 2.4.3 自定义历法（Calendar）

- 一个项目可定义多个历法（不同文明纪年不同）；
- 历法定义：名称 + 起点偏移 + 单位（年/月），用于跨历法排序换算（V1 简化为线性换算，复杂对齐留 V2）。

#### 2.4.4 双视图

1. **时间轴视图（主视图）**：横向轴为**事件序位轴**——全局（跨世界线）按绝对纪元排序后等距编序（dense rank，同刻共享序位），x 坐标只表达**先后顺序**，不按时间偏移量比例定位；事件点下方标注各自历法时间文本。世界线为水平轨道，fork 时新轨道纵向展开，fork 点画分叉曲线；每条线有颜色。自研 SVG 组件实现。
   - 交互：缩放 / 平移（作用于序位空间，有尺度上下限）、点击事件打开编辑抽屉、轨道显隐切换、在轨道上任意位置插入事件（时间取点击处两侧邻事件的中间值，保持先后）、在事件上"从此处创建 IF 线"；同刻多事件折叠为 ×N 聚合点，点击展开错开点选。
2. **画布视图**：自由拖拽节点 + 贝塞尔连线（**Vue Flow**），适合无明确时间的事件草稿、因果链梳理。
   - 事件可无边画布摆放（canvasPos），因果连线来自 `causalLinks`。
   - 两个视图共享同一份数据：时间轴视图负责"有序呈现"，画布视图负责"自由组织"。

### 2.5 导出与分享

| 导出物 | 方式 |
|--------|------|
| 项目完整备份 | **zip 文件**（内为 §3.1 的文件夹布局，fflate 打包），唯一完整备份/迁移格式，可再导入 |
| 角色卡 | Markdown 文件 / PNG 图片 |
| 关系图谱 / 时间线 | PNG（html2canvas / G6、Vue Flow 自带 toImage） |
| 分享快照 | **单文件 HTML**：内联全部数据的只读浏览页（可切角色/百科/时间线 tab），发给他人或挂静态托管即可查看 |

### 2.6 模板系统（Template）

各类可自定义的字段表（角色 fieldBlocks、百科属性集等）共用同一套模板机制：**模板 = 一组命名的字段组合**，可保存、加载、管理、跨项目分享。

```ts
interface Template {
  id: UUID;
  name: string;
  scope: 'character' | 'codex';    // V1 覆盖两类，scope 可扩展到未来的字段表结构
  codexTypeId?: UUID;              // scope=codex 时可绑定条目类型（如"地点模板"）
  payload:
    | { fieldBlocks: FieldBlock[] }                          // 角色：整组字段块
    | { attributeKeys: string[]; contentSkeleton?: string }; // 百科：属性键集 + 可选正文骨架
  builtin?: boolean;               // 内置示例模板（可删除）
  createdAt: string;
}
```

**使用流程：**

- **加载**：新建角色/条目时弹出模板选择（可跳过 = 空白卡）；编辑中可"从模板插入"——把模板的字段追加到当前卡，不影响已有内容（适合复用局部字段组）；
- **保存**：编辑器内"存为模板"并命名。默认只保存**结构**（块类型、标题、键名），值与正文清空；提供"保留当前值"勾选（如默认填"不详"的年龄键）；
- **管理**：模板管理抽屉（重命名 / 删除 / 排序），内置 2–3 个示例模板（基础角色卡、地点条目）；
- **分享**：单模板导出为 `<名称>.template.json`，可导入到任意项目。

**存储**：项目级集合 `templates.json`（随项目 zip 迁移，保证项目自包含）；dexie `templates` 表（键 id，索引 projectId）。跨项目共享走单模板文件导入导出。

---

## 3. 数据模型与存储

### 3.1 文件夹布局（逻辑格式，导入导出即此格式）

一个项目 = 一个文件夹，**按内容体量混合拆分**：大体量实体（角色/百科/事件）每实体一个 JSON 文件，小集合合并单文件，图片绝不内联 base64。

```
<project-name>/
  project.json               # 项目元信息: name, schemaVersion, createdAt, updatedAt, 统计
  settings.json              # 历法 / 关系类型 / 百科类型 / 世界线（均为小集合）
  relations.json             # 关系边集合（每条边很小）
  templates.json             # 模板集合（角色块模板 / 百科属性模板，见 §2.6）
  characters/
    <uuid>.json              # 角色卡（fieldBlocks 全文在此）
  codex/
    <uuid>.json              # 百科条目
  events/
    <uuid>.json              # 事件（含所属 worldlineId）
  assets/
    <uuid>.<ext>             # 图片等二进制文件
```

**拆分收益（写单元）：** 编辑单个角色只写它那一个 1–5KB 的文件/记录，而非全量 0.3–5MB；单文件损坏的影响面也只限于单实体。

### 3.2 浏览器落地（V1，IndexedDB / dexie）

表结构与文件夹布局一一映射：

| dexie 表 | 键 | 说明 |
|----------|-----|------|
| projects | id | project.json |
| settings | projectId | settings.json |
| relations | projectId | relations.json |
| templates | projectId | templates.json |
| characters | id（索引 projectId） | 每角色一条记录 |
| codex | id（索引 projectId） | 每条目一条记录 |
| events | id（索引 projectId） | 每事件一条记录 |
| assets | id（索引 projectId） | **Blob 直存**（IndexedDB 原生支持二进制） |

**读写策略：**

- **读**：打开项目时全量载入 Pinia（典型项目 <1MB，全量读最简单且够快）。拆分解决的是写放大，不为读做懒加载。
- **写**：防抖（500ms）+ **脏实体集合**——UI 编辑只把 `{类型, id}` 标脏，防抖到期后每个脏实体写一条记录，同一批用 dexie 事务包裹（浏览器侧天然获得原子性）。
- **图片**：上传即写 assets 表，JSON 里只存 assetId 引用。头像/设定图是唯一体积炸弹，从第一天就隔离。

### 3.3 校验与一致性

- 所有实体用 zod 定义 schema：导入时校验 + 按 `schemaVersion` 执行迁移管道；
- 所有跨实体引用一律 UUID（`[[条目名]]` 仅是编辑语法，保存时解析为 UUID）；
- **失效引用不崩溃**：引用目标缺失时 UI 显示"失效引用"占位（导入不完整 zip、手工误删文件时项目仍可打开）；
- 级联删除（删角色 → 清理 participantIds、关系边、link 块）在同一事务内完成。

### 3.4 性能边界备忘

- 典型项目（百级实体、纯文本）总量 0.1–1MB：无任何压力；
- 重度项目（千级事件 + 图片）：文本部分仍 <5MB，写压力已被拆分消解；渲染层（时间轴/图谱的 DOM 节点数）才是届时瓶颈，与存储格式无关；
- 唯一纪律：**禁止把图片 base64 内联进任何 JSON**。

---

## 4. 技术架构

```
┌─────────────────────────────────────────────┐
│  Vue 3 + TypeScript + Vite                  │
│  Pinia（状态） / Vue Router（路由）           │
│  UI: Naive UI   图标: Lucide（ISC，按需引入） │
│  编辑器: Markdown 双栏编辑                    │
├─────────────────────────────────────────────┤
│  可视化层                                     │
│   关系图谱: AntV G6                           │
│   画布视图: Vue Flow                          │
│   时间轴视图: 自研 SVG 组件                    │
│   导出图片: 各库自带 toImage / html2canvas    │
│   zip 导入导出: fflate                        │
├─────────────────────────────────────────────┤
│  存储抽象层（关键设计）                        │
│  interface Repository {                      │
│    listProjects / createProject / delete     │
│    loadProject(id)                // 全量读  │
│    saveEntities(dirty: EntityRef[])  // 只写脏实体
│    saveAsset(id, blob) / loadAsset(id)       │
│    exportZip(projectId) / importZip(file)    │
│  }                                           │
│   ├─ LocalRepository  → dexie (IndexedDB)    │
│   └─ RemoteRepository → FastAPI (V2)         │
└─────────────────────────────────────────────┘
```

**V2 后端预留（FastAPI）：**

- 首选**文件树后端**：服务端磁盘上每个项目就是 §3.1 的文件夹，API 做认证 + 读写文件 + 静态托管 SPA，与导入导出格式完全一致，零转换；格式天然 git 友好（创作者可对自己的世界观做版本管理，V2+ 可选特性）；
- 备选 SQLite（`projects` 表 `data` JSON 列 + JSON1 索引），若未来需要服务端检索再引入；
- 认证：单用户 token 起步，多用户留接口；
- 部署：Ubuntu + Nginx 反代 + systemd；
- 前端切换仅替换 Repository 实现并注入 Pinia。

**页面路由：**

```
/                 项目选择/新建
/characters       角色列表 + 编辑
/codex            百科条目
/timeline         时间轴视图
/timeline/canvas  画布视图
/graph            关系图谱
/export           导出与分享中心
```

---

## 5. 视觉风格规范

### 5.1 基调：冷灰大理石

- 界面基调为**冷灰（stone gray）**：偏冷的灰阶层次 + 极淡的大理石纹理与石面冷光泽，克制、安静、适合长时间创作；
- 质感取向**柔和轻松**：大圆角、宽松留白、细边框、低强度柔影；
- **颜色纪律（谨慎使用高饱和色）**：界面控件（按钮/链接/选中态/边框/表面）全部使用低饱和冷灰系 + **单一低饱和强调色**；高饱和颜色**只允许出现在数据语义色**——世界线、关系类型、条目标识色等由用户数据驱动的颜色。

### 5.2 Design tokens（唯一颜色来源，禁止硬编码色值）

| token | 说明 |
|-------|------|
| `--bg / --surface / --surface-2` | 页面底色 / 卡片面 / 次级面（冷灰阶） |
| `--text-1 / --text-2 / --text-3` | 主文 / 次文 / 弱提示 |
| `--border / --border-weak` | 边框 |
| `--accent / --accent-weak / --accent-text` | 单一低饱和强调色（冷石青系），仅用于交互强调 |
| `--radius-s / -m / -l` | 8 / 10 / 12 px |
| `--space-1…5` | 8px 栅格：8 / 16 / 24 / 32 / 48 |
| `--shadow-1 / --shadow-2` | 柔影（低透明度、大模糊） |
| `--texture-opacity` / `--texture-vein` / `--texture-sheen` | 大理石纹理参数（纹路透明度 / 石纹强度 / 冷光泽强度），两主题各调一组 |

- **双主题**：`data-theme="dark|light"` + CSS 变量驱动，切换即时生效并持久化（localStorage），首次访问跟随系统 `prefers-color-scheme`；Naive UI 经 `n-config-provider` 同步换肤；
- 图表库（G6 / Vue Flow / 自研时间轴）颜色一律运行时读取同一套变量 → 主题切换全应用无刷新换肤；
- V1 不做项目级主题定制（V2 快照页主题定制预留：token 体系即基础）。

### 5.3 大理石质感实现

- **首选程序化纹理（V1 默认）**：SVG `feTurbulence` 生成石纹 + 低透明度渐变叠出冷光泽；零图片资源、离线可用、体积为零，纹理参数走 §5.2 token，两主题各调一组；
- **纹理只用于低频装饰区域**：页面底色层、侧栏背景、卡片表面（透明度 0.03–0.08，"看得出质感、不干扰内容"为度）；
- **禁止叠加纹理的区域**：正文阅读区直接背景、时间轴轨道、图谱画布、输入控件内部——一律纯 surface 色，保可读性与对比度；
- **位图纹理仅作备选**：如引入，只允许 CC0 来源（如 ambientCG、Share Textures），单张 ≤100KB WebP、仅装饰层、且在 credits 登记（见 §5.6）。

### 5.4 颜色可及性与饱和度约束

- 两主题下正文对比度 ≥ **4.5:1**（WCAG AA）；
- **UI 控件色（chrome）饱和度上限：HSL S ≤ 40%**，写入 token 定义并用脚本校验（数据语义色豁免）；
- 数据语义色：内置 **12 色低饱和调色板**（石青/灰绿/陶土/雾紫等莫兰迪倾向），在暗/亮两主题下预检与轨道背景对比度 ≥ **3:1**；世界线与关系类型从中选择，也允许自定义色值但实时提示对比度不足。

### 5.5 字体

- **UI / 表单 / 表格**：无衬线系统栈 `system-ui, "PingFang SC", "Microsoft YaHei", sans-serif`；
- **Markdown 正文 / 事件描述 / 百科条目**：衬线 `"LXGW WenKai", "Noto Serif SC", serif`（webfont 按需分包加载；断网或加载失败回退系统衬线，不阻塞渲染）；
- 正文排版：16px / 行高 1.75 / 段间距 `--space-2`。

### 5.6 图标与开源素材政策

- **图标**：统一使用 **Lucide**（ISC 许可，1600+ 图标，官方 Vue 包按需引入、tree-shaking 只打包用到的）；线性 stroke 风格（2px）与 UI 细边框呼应；**禁止混用多套图标库**；
- **素材许可**：第三方素材只允许宽松许可（CC0 / ISC / MIT 等，可商用免署名）；引入时在仓库 `CREDITS.md` 登记来源与许可；
- 位图素材单张 ≤100KB（WebP），仅用于装饰层，不进入数据（数据图片走 assets 存储，与素材无关）。

### 5.7 动效

- 轻动效：主题切换、抽屉、弹窗、列表过渡 150–250ms ease-out；
- 不做装饰性动画（避免干扰创作）；`prefers-reduced-motion` 时关闭过渡。

---

## 6. V1 实施步骤

| # | 任务 | 产出 |
|---|------|------|
| 1 | 脚手架：Vite + Vue3 + TS + Pinia + Router + Naive UI + Lucide；**双主题 token 框架 + 大理石纹理层**；zod 数据模型（含 FieldBlock 骨架校验） | 可运行的空壳 + 类型定义 |
| 2 | 存储层：dexie 多表映射 + 脏实体保存 + 图片 Blob 表；项目新建 / zip 导入导出 | 项目管理首页 |
| 3 | 角色模块 + 模板系统：列表 / 卡片 / 块编辑器（增删排序块）；模板保存 / 加载 / 管理 / 单文件导入导出 | /characters |
| 4 | 百科模块：条目 CRUD + 属性模板 + 双向链接 + 反向引用 | /codex |
| 5 | 时间线数据层 + 时间轴视图：事件 CRUD、世界线 fork、分叉渲染 | /timeline |
| 6 | 画布视图：Vue Flow 集成、causalLinks 连线 | /timeline/canvas |
| 7 | 关系图谱：G6 渲染、关系类型管理、边编辑 | /graph |
| 8 | 导出中心：zip / Markdown / PNG / 单文件 HTML 快照 | /export |
| 9 | 打磨：引用完整性检查、历法管理、快捷键、空态引导 | V1 发布 |

## 7. V2 演进路线（不承诺排期）

1. FastAPI 后端 + 用户数据上云（文件树方案，RemoteRepository）；
2. 复杂历法对齐、世界线对比视图（diff 两条线的事件差异）；
3. 快照页支持主题定制（创作者个人风格分享页，基于 §5.2 token 体系）；
4. 多项目管理、数据同步冲突策略；git 版本管理世界观（基于文件树格式）。

---

## 附录 A：设计决策记录

| # | 决策 | 原因 |
|---|------|------|
| A1 | 百科条目名称由"同类型下唯一"改为**项目内全局唯一** | `[[条目名]]` 链接语法只含名称，跨类型重名会产生解析歧义；牺牲少量命名自由换取链接无歧义 |
| A2 | 大理石质感用**程序化纹理**实现，位图仅备选 | 零资源体积、离线可用、两主题参数化调整；位图引入需 CC0 + 体积上限约束 |
| A3 | 图标统一 Lucide（ISC） | 许可宽松、tree-shaking 按需打包、线性风格与冷灰 UI 一致；混用图标库会破坏风格统一 |
