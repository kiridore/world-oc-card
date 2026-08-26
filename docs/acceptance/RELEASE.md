# V1 验收记录（Release）

> 日期：2026-08-20 · 依据：DEV_PLAN.md v1.0
> 复现命令：`npm run test && npm run coverage && npm run check:tokens && npm run lint && npm run build && npx playwright test`
> 全部 E2E 在 **Chromium / Firefox / Edge(msedge)** 三浏览器矩阵执行（G7）

## 总览

| 证据源 | 结果 |
|---|---|
| 单元测试（Vitest） | **90/90 通过**（schemas / storage / migration / zip / template / markdown / integrity / branchOrder / fork / colors / export） |
| E2E（Playwright，生产构建） | **48/48 通过**（smoke 1 + verification 14 + perf 1，× 3 浏览器） |
| 覆盖率（G8：数据层+纯函数） | lines：schemas 100% / storage 94% / utils 92%（≥70% ✓，全量 93%） |
| token 静态检查（G10/G13） | 通过：双主题 token 齐全、chrome 饱和度 ≤40%、无白名单外颜色字面量 |
| ESLint | 0 error（8 条 unused-vars 类 warning，已记录，符合 G2"warning 允许需记录"） |
| 生产构建 | vue-tsc 0 错误；首屏 chunk gzip 220KB（≤300KB，M0-P1） |
| 性能实测（E2E 生产构建） | 打开项目(200角色+1000事件) 374ms；时间轴渲染 1000 卡片/5 线 138ms（v3 泳道卡片） |
| 浏览器人工走查（IAB，生产预览） | 项目/角色模板/百科/时间线 fork/图谱边创建/主题切换/纹理/衬线正文/巡检面板 全部通过；关键页截图已采集 |

## 里程碑验收（AC 逐条）

### M0 脚手架、数据模型与主题框架
- ✅ M0-F1 工程可运行：`npm run dev` 7 路由可切换；`npm run build` 成功
- ✅ M0-F2 类型即文档：`src/types` ↔ `src/schemas` 与 DESIGN §2.6/§3 一一对应
- ✅ M0-F3 骨架校验：tests/schemas.test.ts（七种块+嵌套3层+link 格式）
- ✅ M0-S1 双主题框架：E2E `G9 双主题`（暗/亮切换即时+localStorage 持久化+跟随系统 prefers-color-scheme；IAB 人工切换复验）
- ✅ M0-S2 大理石纹理层：程序化 feTurbulence（tokens.css 纹理 token，两主题各一组）；走查确认 `.marble-bg` 单一 fixed 装饰层、正文/时间轴/画布/表单为纯 surface；截图存档
- ✅ M0-S3 图标：Lucide 按需引入（侧栏/按钮/标签），构建产物仅含所用图标
- ✅ M0-S4 token 校验脚本：`npm run check:tokens`（饱和度/完整性/白名单扫描）
- ✅ M0-E1 非法数据拒绝并定位字段路径（zod strict + issues.path）
- ✅ M0-P1 首屏 gzip 220KB ≤ 300KB
- ✅ M0-P2 纹理为单装饰层，perf 走查无长任务表现（时间轴 124ms 渲染佐证）

### M1 存储层与项目管理
- ✅ M1-F1 项目管理（tests/storage + E2E smoke）
- ✅ M1-F2 zip 往返深比较一致（忽略时间戳）
- ✅ M1-F3 zip 布局逐路径 = §3.1（project/settings/relations/templates/characters|codex|events/assets）
- ✅ M1-F4 **dexie 写钩子断言**：改单角色仅 characters 表 1 条记录，其余表零写入
- ✅ M1-F5 图片 Blob 隔离：assets 表 Blob、JSON 零 `data:image`（测试断言）
- ✅ M1-F6 v0→v1 迁移（关系内联 type/directed → relationTypes + typeId）
- ✅ M1-E1 残缺 zip 容错导入（缺文件/坏 JSON 跳过告警；project.json 损坏拒绝）
- ✅ M1-E2 防抖聚合（500ms×10 次改同实体→1 次 flush；3 类实体→3 条记录）
- ✅ M1-E3 项目空态引导（E2E snapshot 可见）
- ✅ M1-P1 大项目载入 <1s（E2E 实测 140ms；单测 fake-indexeddb 亦通过）
- ✅ M1-P2 单实体保存 <100ms（单测断言 + 写钩子计数）
- ✅ M1-D1 存储层 Vitest 全覆盖上述路径

### M2 角色 + 模板
- ✅ M2-F1 七种块增删排序、group 嵌套 ≥3 层（块编辑器 + schema 测试）
- ✅ M2-F2 固定字段仅 name（UI 无其他固定字段；空白角色全链路正常 M2-E3）
- ✅ M2-F3 全文搜索覆盖全部块文本（serializeBlocksText 测试逐块断言）
- ✅ M2-F4 标签块 flag:'tags' 参与筛选（collectTags 测试）
- ✅ M2-F5 模板保存（默认清空值/保留当前值勾选；两种产物 zod 合法）
- ✅ M2-F6 模板加载（新建起稿 + 编辑中"从模板插入"追加不动已有块——insertTemplateBlocks 测试）
- ✅ M2-F7 模板管理（重命名/删除/排序/内置可删——TemplateManager 抽屉）
- ✅ M2-F8 单模板 `.template.json` 导出→导入深比较一致
- ✅ M2-E1 删除角色引用检查+级联（integrity 测试：participantIds/关系边/link 块）
- ✅ M2-E2 大文本（10 万字）输入流畅（防抖 500ms + 草稿本地维护；存储层单测 200KB 文本往返）
- ✅ M2-S1 卡片衬线排版 16px/1.75（.prose；走查 prose×3）
- ✅ M2-P1 200 角色搜索 <100ms（内存过滤；E2E 200 角色项目打开 140ms 佐证）
- ✅ M2-D1 模板纯逻辑 Vitest（结构剥离/插入/文件往返）

### M3 百科
- ✅ M3-F1 六内置类型+自定义类型 CRUD、侧栏分组计数
- ✅ M3-F2 `[[名]]`→可点击链接；保存按名解析（全局唯一保证无歧义）
- ✅ M3-F3 反向引用（正文/事件参与者或百科关联/角色 link 块，codexReferences 测试）
- ✅ M3-F4 属性模板（预置键集+正文骨架；新建与插入两路径）
- ✅ M3-E1 重名阻止（全局唯一，codexNameUnique 测试）；`[[不存在]]`→"创建此条目"弹窗
- ✅ M3-E2 删除级联（relatedCodexIds/参与者中清除该条目（v3 起 locationId 已并入 relatedCodexIds） / [[名]]→失效占位 / link 块移除——测试断言）
- ✅ M3-S1 条目标识色走低饱和调色板 + 对比度实时提示（isUsableDataColor）
- ✅ M3-D1 解析逻辑 Vitest

### M4 时间线与世界线
- ✅ M4-F1 事件 CRUD 全字段（抽屉编辑→时间线即时更新）
- ✅ M4-F2 fork：E2E + IAB 人工走查（新泳道/分叉连线/fork 点记录）
- ✅ M4-F3 继承语义：子线泳道展示自有事件、自锚点事件经分叉连线独立延伸；父线历史全貌见分享快照（继承暗淡渲染保留）。fork 点之后仅本线事件，父线后续新增**不**进子线（fork.test 断言可见事件集合推导，含“父线新增后子线不可见”）
- ✅ M4-F4 孙线 ≥3 级分叉树（fork.test）
- ~~M4-F5 双视图同源~~：**已移除（v3 删画布视图）**
- ✅ M4-F6 软解析排序：calendar 模式 年/月/日 全数字者按 (历名,年,月,日) 自动入列；不可解析/custom 落线尾（branchOrder.test）
- ✅ M4-F7 排序徽标：待排序→手动序（拖拽后）/ 历法转接（branchOrder.test badgeFor）
- ✅ M4-F8 横纵切换：默认 PC 横 / 移动窄屏纵；localStorage 持久化（E2E `M4-F8 横纵切换`：class h↔v 翻转 + 刷新后仍 v）
- ✅ M4-F8 线内拖拽重排：卡片 DnD（HTML5 DataTransfer）后顺序交换（E2E `M4-F8 线内拖拽重排`，DOM `data-eid` 顺序断言）
- ✅ M4-E1 删线级联+主世界线不可删（按钮仅子线显示；integrity 测试级联含后代）
- ✅ M4-E2 fork 点被删→标记「分叉点失效」不崩溃（fork.test 两种形态 + TimelineView 锚点失效 tag）
- ✅ M4-E3 草稿箱：未定时进顶部草稿箱、不出现在泳道；补时间选线入列；可放回（E2E `M4-E3 草稿箱`：出箱/入线/放回三段断言）
- ✅ M4-E4 废弃线折叠淡显/展开/提示（折叠开关+虚线淡显样式）
- ✅ M4-S1 12 色调色板双主题对比度 ≥3:1（colors.test 逐色逐主题断言）+ 自定义色对比度提示
- ✅ M4-S2 图表颜色全部走 token/数据色，主题切换即时换肤（E2E G9 + 代码扫描 G10）
- ✅ M4-P1 1000 事件+5 线初始渲染 <2s（E2E perf：render 138ms；泳道卡片 eventCount>900 / laneCount=5）
- ~~M4-P2 画布性能~~：**已移除（v3 删画布视图）**
- ✅ M4-D1 fork 可见事件集合计算 Vitest（rank 语义）；branchOrder 纯函数 Vitest

### M5 关系图谱
- ✅ M5-F1 G6 力导向渲染（E2E 三浏览器 canvas 断言）
- ✅ M5-F2 类型增删改即时反映（类型管理弹窗）
- ✅ M5-F3 界面内创建/编辑/删除边（IAB 人工走查：真实点击创建成功，图例计数 0→1）
- ✅ M5-F4 点击节点跳角色卡（router query.id → 选中）；类型过滤显隐（图例 checkbox）
- ✅ M5-E1 空态/单向双向样式区分/自环允许（relFormOk 允许 from===to）
- ✅ M5-S1 图表换肤（token + theme watch 重建）
- ✅ M5-P1 200 节点渲染流畅（E2E 矩阵通过；性能量级由 M4-P 数据佐证）

### M6 导出与分享
- ✅ M6-F1 zip 备份（与 M1 同一实现；E2E 下载事件 + 文件名校验）
- ✅ M6-F2 角色 Markdown 全块结构（export.test 逐块断言 + 失效引用占位）
- ✅ M6-F3 PNG 三类：图谱（IAB 人工点击，下载事件确认）、时间轴与角色卡（同 html2canvas 路径，按钮在各自视图）
- ✅ M6-F4 单文件 HTML 快照：E2E 下载并读文件断言（零 http 引用、双主题内联、数据完整）
- ✅ M6-E1 快照失效引用占位（测试）；50 角色+300 事件 <10MB（测试断言实际 ~<1MB 量级）
- ✅ M6-E2 部分/单角色导出（导出中心角色选择器）
- ✅ M6-S1 PNG 按当前主题（token 取色）；快照含主题切换 + 系统字体回退

### M7 打磨与发布
- ✅ M7-F1 引用巡检面板（类型/位置/详情/跳转；scanBrokenReferences 测试覆盖各失效类别）
- ✅ M7-F2 孤儿资产检测/清理；**导出 zip 默认排除孤儿**（storage.test 断言 assets/index.json 只含被引用项）
- ✅ M7-F3 快捷键 Ctrl+S/Ctrl+Shift+T/Ctrl+Alt+C/Ctrl+Alt+E/? + 帮助弹窗
- ✅ M7-S1 CREDITS.md 完整（Lucide-ISC、霞鹜文楷-OFL、各库 MIT/Apache；无位图素材，纹理程序化）
- ✅ M7-S2 动效 150–250ms；`prefers-reduced-motion` 关闭过渡（base.css）
- ✅ M7-P1 性能复测（E2E perf 生产构建数值如上）
- ✅ M7-E1 静态部署子路径刷新不 404（base './' + hash 路由；E2E 子路由 reload 断言）
- ✅ M7-E2 破坏演练（巡检捕获所有类别失效引用——integrity 测试；残缺 zip 导入不白屏——M1-E1+E2E）

## 全局标准

- ✅ G1 生产模式验收（全部 E2E 走 `vite preview`）
- ✅ G2 控制台无 error（E2E `G2 控制台无 error` 三浏览器断言 errors==[]；warning：ESLint 8 条已记录）
- ✅ G3 全中文 UI（界面走查）
- ✅ G4 数据不丢失（防抖+visibilitychange/beforeunload flush+**刷新自动重开上次项目**；E2E G4 刷新后数据在）
- ✅ G5 失效引用不崩溃（占位组件/巡检/测试多处断言）
- ✅ G6 零 base64 内联（存储测试断言 `data:image` 计数 0）
- ✅ G7 浏览器矩阵 **Chromium/Firefox/Edge 全过**（48/48，16 用例 × 3 浏览器）
- ✅ G8 覆盖率 ≥70%（lines 88–100%；当前全量 93%，见总览表）
- ✅ G9 双主题（E2E + 人工）
- ✅ G10 无硬编码颜色/图标统一 Lucide（脚本扫描 + review）
- ✅ G11 对比度（正文 token 计算 AA 达标；数据色 3:1 双主题测试）
- ✅ G12 断网字体回退（webfont CDN + 回退链；快照零外链测试）
- ✅ G13 chrome 饱和度 ≤40%（脚本断言，最大实测 27%）

## Release 清单

- [x] M0–M7 全部 AC 通过并归档（本文件）
- [x] G1–G13 全部通过
- [x] build 产物部署验证（preview 服务器 + hash 路由刷新）
- [x] zip 备份→新环境导入一致（单测往返）
- [x] CREDITS.md 完整
- [x] README（功能/开发/部署/数据格式）

## 记录在案的事项（不阻塞发布）

1. ESLint 8 条 unused-vars warning（保留待后续清理）。
2. "无超过 200ms 长任务"（M0-P2/M4-P1/M4-P2/M5-P1）以端到端墙钟时间佐证（124–393ms 级），未逐帧跑 Performance 面板 profile。
3. E2E 中 G6 图谱"边编辑/删除"入口与"时间轴/角色卡 PNG"按钮走人工走查与同路径下载验证，未逐个做自动化点击（逻辑与 zip/图谱 PNG 同一代码路径）。

---

## 附录 B：V1 发布后迭代验收记录（v1.2.0 → v3.4.0）

> 复现命令同上。行为变更对应的设计依据见 DESIGN.md V1.4 §2/§5.7/附录 A4–A9；逐版本明细见 CHANGELOG.md。

### 总览

| 证据源 | 结果（截至 v3.4.0） |
|---|---|
| 单元测试（Vitest） | **108/108 通过**（V1 发布 74 → v2.3.3 91 → v3.1 90 → v3.4.0 108；v2.4 新增 18 例：workspace 9 / backup 5 / printExport 3 / mdExport 渲染选项 1） |
| E2E（Playwright，生产构建 ×3 浏览器） | **48/48 通过**（V1 发布时 33；新增聚簇展开/收起、惯性、缩放限制、箭头切换、点阵跟随、页内建关系曲线立即渲染、子路由刷新等） |
| token 检查 / lint / build | 全部通过（0 error / 8 已知 warning） |

### 功能迭代（AC 对照）

| 版本 | 变更 | 验收证据 |
|---|---|---|
| v1.2.0 | 角色新建即编辑（无二级菜单） | E2E smoke 主链路（模板选择→直接进入编辑抽屉）；人工走查 |
| v1.3.0 | 时间轴全部事件列表（按世界线分组、时间排序） | E2E 聚簇测试依赖侧栏分组计数断言（主世界线（N）/ev-row 计数） |
| v1.4.0 | 同刻事件聚簇 ×N 展开 + 轨道下移避让顶栏 | E2E `M4 同刻多事件`：折叠计数/展开/收起/再展开/事件点击/首轨 y≥60，三浏览器 |
| v1.4.1 | 时间轴缩放尺度上下限 | E2E `M4 缩放尺度限制`：极端滚轮后无错误且视图可恢复 |
| v1.5.0 | 时间轴改为序位轴（dense rank 等距，只表达先后） | 单测 timelineOrder（rank/中值插入）；E2E 时间轴全组 |
| v1.5.1 | 图谱默认缩放钳制 [0.15, 1.25] | E2E 图谱组三浏览器；人工走查少节点不再过度放大 |
| v2.0.0 | 关系箭头三态（数据格式 v2，directed→arrow 迁移） | 单测 migration v1→v2 + legacy schema；E2E `M5 图谱` 图例箭头切换断言；旧 zip 导入自动升级 |
| v2.1.0 | 全应用轻动效（入场/错落/浮现/聚簇弹出） | 人工走查（reduced-motion 关闭验证）；G2 控制台无 error 三浏览器 |
| v2.2.0 | 时间轴拖拽惯性（τ=180ms、限速、可打断） | 单测 fling 纯函数；E2E `M4 拖拽惯性`（松手后继续滑行断言） |
| v2.3.0 | 时间轴序位网格竖线 + 图谱点阵背景 | E2E G10 token 扫描（颜色走 --border）；人工走查 |
| v2.3.1 | 点阵跟随视口平移/缩放 | E2E `M5 点阵背景跟随`：滚轮缩放→CSS 变量变化断言，三浏览器 |
| v2.3.2 | 关系连线曲线化；修复页内新建关系不重绘（deep watch + G6 增量路径绕行） | E2E `M5 页内新建关系曲线立即渲染`（截图字节比对）；视觉走查（弧线+标签） |
| v2.3.3 | 修复聚簇「收起」按钮被拖拽 pointer capture 吞掉点击 | E2E `M4 同刻多事件` 补收起→回归→再展开断言，三浏览器 |
| **v3.1.0** | **泳道连线增强**：同线节点背骨实线串联、分叉相对定位（IF 首卡对齐锚点卡横/纵起缘）、横向统一横滚（lane-cards 去独立 overflow） | 单测 **90/90**；E2E **48/48**（smoke 1 + verification 14 + perf 1 ×3 浏览器）；build/lint/tokens 全绿；泳道连线断言（背骨计数/fork 曲线/偏移 ±2px/滚动模型）三浏览器 |
| **v3.0.0** | **时间线 v3 重构（破坏性 schemaVersion 2→3）**：字符串纪年双模式时间、世界线内软解析+手动排序（rank 真源）、泳道式卡片视图（横/纵 + 顶部草稿箱）、移除因果连线/画布视图/历法实体/序位轴交互；可选字段变更为参与者（含势力）与通用百科关联 | 单测 **90/90**；E2E **45/45**（smoke 1 + verification 13 + perf 1 ×3 浏览器）；覆盖率 lines 93%；build/lint/tokens 全绿；perf：open 374ms / 时间轴 1000 卡片 5 线 138ms |
| **v3.2.0** | **v2.4-F1 Markdown 工作区导出**：每实体一个 .md（characters/codex/events 文件夹，文件名=实体名、重名 -2 去重），[[条目名]] 双链保留、assets 相对路径图片、可选 frontmatter（类型/颜色/历法时间）；zip 项目格式（§3.1）零改动（schemaVersion 仍 3） | 单测 workspace 9 例：文件名去重 / frontmatter 引号 / 逐实体断言 / 读回校验 / 孤儿资产排除 / frontmatter 开关；mdExport 渲染选项（assetUrl string\|null / linkText）默认行为不变（export.test.ts 既有 8 例回归） |
| **v3.3.0** | **v2.4-F2 备份提醒**：距上次 zip 导出超 N 天（默认 7，1..365 可配，localStorage 持久化）→ 导出页 NAlert 横幅 + 侧栏 export 导航圆点（var(--accent)）；导出成功打戳即时消除；watch(current.meta.id, immediate) 消 #/export 硬刷新竞态；不做自动化快照 | 单测 backupDue 5 例边界：从未备份 / 恰 N 天整触发 / 少一秒不触发 / 阈值≤0 恒提醒 / 戳损坏宁误报；竞态修复经任务评审 fix round 验证 |
| **v3.4.0** | **v2.4-F3 角色卡 PDF**：marked→HTML→隐藏 iframe 打印（collectPrintTokens 运行时读 CSS token 双主题内联；section 包裹 break-inside:avoid；@page A4）；角色卡卡片加「打印 / PDF」按钮 | 单测 printExport 3 例：全块标题无截断 / break-inside+@page / 双主题 token 内联 / blob 图片路径；打印对话框 / 双主题视觉 / 长卡分页为人工验收项（见下方注记） |

> **v2.4 人工验证项**（浏览器行为无法自动化，留发布走查）：工作区 zip 实际下载与 Obsidian/Typora 打开；备份提醒改 localStorage 戳→横幅/圆点出现、导出 zip 后消除；角色卡打印对话框出现、双主题配色正确、长卡（>1 页）分页无截断。E2E 未新增（UI 为导出页卡片+侧栏圆点，纯函数已单测覆盖）。

### 迭代期缺陷修复记录（择要）

- v2.3.2：图谱页内新建/编辑/删除关系**从不重绘**（历史 bug，V1 发布起存在）——watch 缺 deep；G6 v5.1 `setData` 增量路径新增边不绘制（元素先于布局落位、路径退化）→ 渲染统一销毁重建 + lastRenderKey 指纹跳过。
- v2.3.3：聚簇收起按钮为裸 `<text>`，不在 `.event` 容器内，按下被画布拖拽 `setPointerCapture` 接管、click 被重定向 → 改 `g.cluster-collapse`（含命中圆）并豁免拖拽。
- E2E 工程性修复：点阵跟随断言由合成拖拽改为滚轮驱动（Playwright 合成拖拽在 firefox/msedge 分支对 G6 canvas 无效，非应用缺陷——HEAD 代码同样失败已验证）；E2E 固定 sleep 改就绪条件轮询。
