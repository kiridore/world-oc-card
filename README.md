# 石纪 · World OC Card

OC 角色表 × 世界观时间线创作工具。单页应用，数据全部存于浏览器本地（IndexedDB），zip 导入导出随时迁移。

## 功能

- **角色表**：字段全自由组合（分组/键值/Markdown/列表/图片/表格/链接七种块），模板系统可保存/加载/跨项目分享字段组合
- **世界观百科**：地点/势力/种族/物品/规则体系条目，`[[条目名]]` 双向链接与反向引用
- **时间线（类 Git 世界线）**：事件为节点，任意事件可分叉出 IF 世界线；时间轴视图（轨道+分叉曲线+缩放平移）与画布视图（自由拖拽+因果连线）双视图同源
- **关系图谱**：力导向布局，自定义关系类型（颜色/方向），点击节点跳转角色卡
- **导出分享**：项目 zip 备份（与内部存储同构的文件夹布局）、角色卡 Markdown/PNG、图谱与时间轴 PNG、单文件 HTML 分享快照（断网可用）
- **完整性巡检**：失效引用扫描、孤儿资产清理

## 快捷键

`Ctrl+S` 保存 · `Ctrl+Shift+T` 时间轴↔画布 · `Ctrl+Alt+C` 新建角色 · `Ctrl+Alt+E` 新建事件 · `?` 帮助

## 开发

```bash
npm install
npm run dev          # 开发服务器
npm run test         # 单元测试（数据层/纯函数）
npm run coverage     # 覆盖率（≥70% 门槛）
npm run check:tokens # G10/G13 颜色纪律静态检查
npm run build        # 生产构建（vue-tsc + vite）
npm run preview      # 预览生产构建
```

### 部署

纯静态产物（`dist/`），任意静态服务器可托管；使用 hash 路由与相对 base（`./`），子路径部署刷新不 404。

### E2E 冒烟（可选）

```bash
npm i -D @playwright/test && npx playwright install chromium
npx playwright test
```

## 数据格式

一个项目 = 一个文件夹（zip 内同构）：`project.json / settings.json / relations.json / templates.json / characters/<uuid>.json / codex/<uuid>.json / events/<uuid>.json / assets/`。详见 [DESIGN.md](./DESIGN.md) §3。

## 文档

- [DESIGN.md](./DESIGN.md) —— 设计文档（数据模型、视觉规范、架构）
- [DEV_PLAN.md](./DEV_PLAN.md) —— 开发计划与验收标准
- [CREDITS.md](./CREDITS.md) —— 第三方素材与许可
- [docs/acceptance/](./docs/acceptance/) —— 验收记录
