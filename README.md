# 石纪 · World OC Card

OC 角色表 × 世界观时间线创作工具。**纯静态单页应用（SPA）**：无后端、无数据库、无环境变量——所有数据存于浏览器 IndexedDB，通过 zip 文件导入导出随时迁移或备份。

## 功能

- **角色表**：字段全自由组合（分组/键值/Markdown/列表/图片/表格/链接七种块），模板系统可保存/加载/跨项目分享字段组合；新建即编辑、改动自动保存
- **世界观百科**：地点/势力/种族/物品/规则体系条目，`[[条目名]]` 双向链接与反向引用
- **时间线（类 Git 世界线）**：事件为节点，任意事件可分叉出 IF 世界线；时间轴视图（序位轴只表达先后顺序、同刻事件聚簇折叠、拖拽惯性、缩放尺度限制）与画布视图（自由拖拽+因果连线）双视图同源；自定义历法；侧栏全部事件列表按世界线分组兜底选中
- **关系图谱**：力导向布局 + 曲线关系边，自定义关系类型（颜色 + 无箭头/单箭头/双箭头三态），点击节点跳转角色卡，类型过滤图例
- **导出分享**：项目 zip 备份（与内部存储同构）、角色卡 Markdown/PNG、图谱与时间轴 PNG、单文件 HTML 分享快照（断网双击可用）
- **完整性巡检**：失效引用扫描、孤儿资产清理
- **双主题**：冷灰大理石质感明/暗主题即时切换，跟随系统偏好

## 快捷键

`Ctrl+S` 保存 · `Ctrl+Shift+T` 时间轴↔画布 · `Ctrl+Alt+C` 新建角色 · `Ctrl+Alt+E` 新建事件 · `?` 帮助

## 环境要求

- 部署：任意能托管静态文件的 HTTP 服务器（Nginx / GitHub Pages / 对象存储 CDN / `python -m http.server` 均可）
- 构建：Node.js ≥ 20，npm ≥ 10

---

# 部署流程

应用是**纯前端静态站点**：构建产物为 `dist/` 目录，不含任何服务端代码；使用 hash 路由（`#/...`）且资源基址为相对路径（`base: './'`），因此**任意静态服务器、任意子路径**都能直接部署，刷新子页面不会 404，无需服务端回退配置。

## 1. 构建

```bash
# 在项目根目录
npm install        # 安装依赖
npm run build      # 类型检查 + 生产构建 → dist/
```

构建成功后 `dist/` 即为完整部署产物（`index.html` + 带 hash 的 `assets/*`）。可在本地验证：

```bash
npm run preview    # 默认 http://localhost:4173
```

## 2. 部署到 Nginx（Ubuntu 服务器示例）

产物只需被静态托管，典型配置：

```nginx
# /etc/nginx/sites-available/world-oc-card
server {
    listen 80;
    server_name your-domain.example;          # 换成你的域名或 IP

    root /var/www/world-oc-card;              # dist/ 内容拷贝到这里
    index index.html;

    # hash 路由 + 相对 base：无需 try_files 回退，刷新子页面天然不 404
    location / {
        try_files $uri $uri/ =404;
    }

    # 带内容 hash 的静态资源：长缓存
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 入口文件：不缓存，保证发版即时生效
    location = /index.html {
        add_header Cache-Control "no-cache";
    }
}
```

上线步骤：

```bash
# 本地构建并上传（也可用 rsync/scp 任选）
npm run build
scp -r dist/* user@your-server:/var/www/world-oc-card/

# 服务器上启用站点并重载
sudo ln -s /etc/nginx/sites-available/world-oc-card /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 如需 HTTPS
sudo certbot --nginx -d your-domain.example
```

**子路径部署**（如挂在 `https://example.com/woc/`）：把 `dist/` 内容放到对应子目录即可，无需任何额外配置——这正是相对 base + hash 路由的设计目的。

## 3. 部署到 GitHub Pages

```bash
npm run build
# 方式一：推一个 gh-pages 分支（npx gh-pages -d dist）
# 方式二：GitHub Actions：on push 时执行 npm ci && npm run build，上传 dist 到 Pages
```

仓库页 Settings → Pages → Source 指向对应分支/目录即可。项目使用 hash 路由，Pages 的 404 规则不影响子页面刷新。

## 4. 其他静态托管

任何"拖个文件夹就能跑"的方式都适用：

```bash
# 临时演示
npx serve dist
python -m http.server 8080 -d dist

# Vercel / Netlify / Cloudflare Pages
# 框架预设选 "Vite" 或直接指定构建命令 npm run build、产物目录 dist
```

唯一注意点：确保服务器以标准 MIME 类型返回 `.js/.mjs/.css`（上述平台默认正确）。

## 5. 升级与回滚

1. 本地拉取新版本 → `npm install && npm run build`
2. 覆盖上传 `dist/*`（旧 `assets/` 带 hash 可一并清理）
3. 回滚 = 重新上传上一版 `dist/`

用户数据在各自浏览器 IndexedDB 中，与服务端版本解耦——升级部署不会动用户数据；schema 升级由应用内迁移管道处理（zip 导入旧版本数据自动迁移）。

## 6. V2 后端（预留，当前不需要）

V1 不需要任何后端。规划中的 V2（用户数据上云：FastAPI 文件树方案 + Nginx 反代 + systemd）见 [DESIGN.md](./DESIGN.md) §4——届时前端零改动，仅切换 Repository 实现。

---

# 开发

```bash
npm run dev            # 开发服务器
npm run test           # 单元测试（数据层/纯函数）
npm run coverage       # 覆盖率（≥70% 门槛）
npm run check:tokens   # 颜色纪律静态检查（G10/G13）
npm run lint           # ESLint
npm run build          # 生产构建（vue-tsc + vite）
npx playwright test    # E2E 冒烟（先 npx playwright install chromium firefox）
```

改动前请阅读 [AGENTS.md](./AGENTS.md)（架构边界与本仓库已知坑）。

## 数据格式

一个项目 = 一个文件夹（zip 内同构）：`project.json / settings.json / relations.json / templates.json / characters/<uuid>.json / codex/<uuid>.json / events/<uuid>.json / assets/`。详见 [DESIGN.md](./DESIGN.md) §3。

## 文档

- [DESIGN.md](./DESIGN.md) —— 设计文档（数据模型、视觉规范、架构、设计决策记录）
- [DEV_PLAN.md](./DEV_PLAN.md) —— 开发计划与验收标准（含发布后迭代 AC 附录）
- [docs/develop.md](./docs/develop.md) —— **开发指南**（代码导览、常见开发任务、测试与发布流程）
- [AGENTS.md](./AGENTS.md) —— agent/协作者指南（分层规则、硬性约束、已知坑）
- [CHANGELOG.md](./CHANGELOG.md) —— 逐版本更新日志
- [CREDITS.md](./CREDITS.md) —— 第三方素材与许可
- [docs/acceptance/](./docs/acceptance/) —— 验收记录（RELEASE.md 含 V1 与后续迭代的验收证据）
