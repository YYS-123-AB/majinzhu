# 🎮 GameRank · 游戏资讯排行榜站 - 完整部署教程

> 原生HTML+CSS+JS 纯前端项目，零框架、零构建依赖，任何静态服务器都能运行。

---

## 📁 项目结构

```
web13/
├── index.html                  # 主页面（8榜单Tab+6平台Tab+9类型Tab+搜索+排序+卡片+弹窗）
├── css/
│   └── style.css               # 样式表（1100+行，双主题+响应式+卡片+弹窗）
├── js/
│   └── app.js                  # 核心逻辑（3重筛选+搜索防抖+排序+收藏+主题+弹窗+回到顶部）
├── data/
│   └── data.json               # 游戏数据源（70+款游戏完整字段）
├── scripts/
│   └── fetch-data.js           # Node原生https脚本，拉取失败自动生成示例数据
├── .github/workflows/
│   └── deploy.yml              # GitHub Actions 自动部署（三触发+三Job）
├── .nojekyll                   # 禁止 GitHub Pages Jekyll 处理
├── .gitignore
├── package.json                # scripts: fetch / start / dev / build / preview
├── vite.config.js              # Vite配置（base: './' 保证子路径部署）
└── DEPLOY.md                   # 本文档
```

---

## ✨ 项目功能一览

| 分类 | 特性 |
|---|---|
| **榜单Tab (8)** | 本周热门榜 / Steam热销 / 独立佳作 / 3A大作 / 国产游戏 / 手游排行 / 网游榜 / 复古怀旧 |
| **平台Tab (7)** | 全部 / PC / PS5 / Xbox / Switch / 手游 / 多平台 |
| **类型Tab (9)** | 全部 / 动作 / 冒险 / RPG / 策略 / 射击 / 模拟 / 竞速 / 解谜 / 卡牌 |
| **搜索** | 匹配游戏名 / 英文名 / 开发商 / 发行商 / 类型标签 / Tags，**防抖300ms** |
| **排序 (3)** | 🔥热度 / ⭐评分 / 📅发售日 |
| **游戏卡片** | 封面图(picsum)、中英名、评分、热度、发售日、开发商、3个平台标签、类型标签、排名徽章(#1~#3金银铜)、热门HOT角标、收藏按钮 |
| **点击弹窗** | 大图横幅背景、原名+英文名、开发商+发行商、发售日、支持平台、游戏类型、IGN/Steam双评分+玩家评价、简介、5条特色亮点、最低/推荐系统需求(两栏)、媒体评分卡片、同类型相关推荐(可点击跳转) |
| **关闭弹窗(3种)** | ①右上角×按钮 ②点击遮罩背景 ③键盘Esc键 |
| **必含特性** | 🔴响应式三断点(1100/768/480px) · 🔴暗/亮双主题(自动跟随系统) · 🔴防抖300ms搜索 · 🔴auto-fill自适应网格 · 🔴回到顶部按钮 · 🔴空状态 + 加载Spinner · 🔴收藏夹(localStorage持久化) |

---

## 🚀 方式一：本地预览（最简单）

不需要任何构建工具，直接打开即可。

```bash
# 1) 进入目录
cd web13

# 2) 直接双击 index.html 用浏览器打开
#    或使用任意静态服务器（推荐，避免file:// fetch限制）

# 可选：Python 内置服务器
python -m http.server 5173      # Windows: py -m http.server 5173

# 可选：Node serve
npx serve . -l 5173

# 可选：PHP
php -S localhost:5173
```

然后访问：**http://localhost:5173**

> 💡 `index.html` 中所有资源引用均使用相对路径 `./css/...`、`./js/...`、`./data/...`，
> 确保 resolveDataPath() 函数在任意子路径下都能定位到 data.json。

---

## 🚀 方式二：Vite 开发 + 构建（推荐）

需要 Node.js **18+**（推荐 20 LTS）。

```bash
cd web13

# 1. 安装依赖
npm install
# 或 pnpm i / yarn

# 2. 拉取游戏数据（可选，内置示例已包含）
npm run fetch

# 3. 启动开发服务器（自动热更新）
npm run dev     # 自动打开浏览器
# 或 npm start   # 仅启动，不自动打开

# 4. 生产构建（输出到 dist/）
npm run build

# 5. 本地预览构建产物
npm run preview
```

构建产物在 `dist/` 目录，大小约 1~2MB，是标准静态资源，可部署到任何地方。

---

## 🚀 方式三：GitHub Pages 自动部署（CI/CD）

项目已内置 `.github/workflows/deploy.yml`，包含：

- **三触发条件**：push 到 main/master、手动 `workflow_dispatch`、发布 release
- **三Job流水线**：
  1. `build`：安装依赖 → 拉取数据 → Vite 构建 → 上传 artifact
  2. `deploy-pages`：部署到 GitHub Pages
  3. `deploy-info`：输出部署结果摘要

### 部署步骤

1. **上传代码** 到 GitHub 仓库（web13 目录在仓库根目录，或调整 workflow 里 `working-directory`）
2. **启用 Pages**：
   - 仓库 → Settings → Pages
   - Source 选择 **GitHub Actions**（不要选 Branch）
3. **触发构建**：
   - 直接 push 到 main，或
   - Actions → `Deploy GameRank...` → `Run workflow` 手动触发
4. **等待 2~3 分钟**，在 Settings → Pages 看到部署地址 ✅

### ⚠️ 子路径兼容问题

如果你的仓库名不是 `<user>.github.io`，GitHub Pages 会部署在子路径：
```
https://<user>.github.io/<repo>/web13/...
```

这就是为什么 **vite.config.js** 配置了 `base: './'`，以及 **resolveDataPath()** 做了多路径兜底，**无需任何额外配置即支持**。

`.nojekyll` 文件确保 `_assets` 这类带下划线的目录不会被 Jekyll 忽略。

---

## 🚀 方式四：Cloudflare Pages / Netlify / Vercel 一键部署

| 平台 | 配置字段 | 填写 |
|---|---|---|
| **Cloudflare Pages** | Framework preset | `Vite` |
| | Build command | `cd web13 && npm ci && npm run build` |
| | Build output directory | `web13/dist` |
| **Netlify** | Build command | 同上 |
| | Publish directory | `web13/dist` |
| **Vercel** | Framework preset | `Vite` |
| | Root Directory | `web13` |
| | Build command | `npm run build` |

---

## 🚀 方式五：Nginx / Apache / IIS 传统服务器

```bash
# 1. 构建
cd web13 && npm run build

# 2. 将 dist/ 目录上传到服务器
#    /var/www/gamerank/  <-- dist/* 全部复制到此

# 3. Nginx 站点配置示例
server {
    listen 80;
    server_name gamerank.example.com;
    root /var/www/gamerank;
    index index.html;

    # gzip 压缩（静态资源性能）
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;

    # SPA Fallback (本项目是静态单页但无路由，可省略)
    try_files $uri $uri/ /index.html;

    # 静态文件长缓存
    location ~* \.(?:css|js|jpg|jpeg|png|gif|svg|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## 🎨 游戏数据自定义

### 修改 data.json（手动）

直接编辑 `data/data.json`，每个游戏对象的完整字段：

```jsonc
{
  "id": 1,                      // 数字ID（唯一）
  "name": "艾尔登法环",          // 中文名
  "enName": "Elden Ring",       // 英文名
  "cover": "...",               // 封面图 建议 400x560
  "banner": "...",              // 弹窗横幅图 建议 1600x600
  "rating": 9.7,                // 综合评分 0~10
  "ignScore": 10,               // IGN 评分
  "steamScore": 95,             // Steam 好评率 %
  "playerCount": 1250000,       // 玩家评价人数
  "hotRank": 1,                 // 热度排名
  "listType": ["weekly","aaa"], // 归入哪些榜单(决定Tab显示)
  "platforms": ["pc","ps5"],    // 支持平台
  "genres": ["动作","RPG"],     // 游戏类型
  "developer": "FromSoftware",  // 开发商
  "publisher": "Bandai Namco",  // 发行商
  "releaseDate": "2022-02-25",  // 发售日 YYYY-MM-DD
  "description": "...",         // 简介
  "highlights": ["..."],        // 特色亮点(5条左右)
  "minReq": { "cpu": "...", "gpu": "...", "ram": "8 GB", "storage": "60 GB", "disk": "SSD", "os": "Win 10" },
  "recReq": { /* 同上 推荐配置 */ },
  "mediaScores": [              // 媒体评分
    { "media": "IGN", "score": 10 }
  ],
  "tags": ["开放世界","魂系"],  // 标签（搜索用）
  "relatedIds": [2,5,8],        // 相关推荐ID数组
  "isHot": true                 // 是否显示HOT徽章
}
```

### listType 可选值（决定出现在哪个榜单Tab）

| 值 | 对应Tab |
|---|---|
| `weekly` | 本周热门榜 |
| `steam` | Steam热销 |
| `indie` | 独立佳作 |
| `aaa` | 3A大作 |
| `chinese` | 国产游戏 |
| `mobile` | 手游排行 |
| `online` | 网游榜 |
| `retro` | 复古怀旧 |

### platforms 可选值

| 值 | 含义 |
|---|---|
| `pc` / `ps5` / `xbox` / `switch` / `mobile` | 单平台 |
| 数组长度 ≥ 3 | 也会匹配「多平台」筛选 |

### scripts/fetch-data.js（对接真实API）

编辑 `DATA_URLS` 数组填入你的游戏数据API：
```js
const DATA_URLS = [
  'https://your-api.com/games.json',
  // 多个地址按顺序回退
];
```
API 返回格式必须是 `{ "games": [ ... ] }`。  
**API 不通时自动生成 70 条示例数据**，不会中断构建。

---

## 🛠️ 常见问题 FAQ

### Q1：fetch data.json 失败（浏览器控制台 404/路径错误）
- `resolveDataPath()` 会依次尝试 3 种路径格式
- 若全部失败，使用 FALLBACK_GAMES 内置 3 条示例兜底
- 检查部署后 Network 面板，确认 data.json 的 MIME 是 `application/json`

### Q2：图片不显示 / picsum 图片加载失败？
- Picsum 是公共随机图服务，国内可能偶尔慢
- 可自行替换 `data.json` 中 cover / banner 字段为本地图片路径或自建CDN

### Q3：暗/亮主题切换不生效？
- 首次访问会跟随系统 `prefers-color-scheme`
- 点击顶栏右上角🌙/☀️按钮切换，配置保存在 `localStorage: gamerank:theme:v1`
- 清空浏览器缓存即可恢复默认

### Q4：收藏夹数据如何清除？
- 浏览器 F12 → Application → Local Storage
- 删除 `gamerank:favorites:v1` 键

### Q5：想修改主题色（紫色渐变）？
- 在 `css/style.css` 最顶部的 `:root` 里：
```css
--accent: #6366f1;                 /* 主色 */
--accent-gradient: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
```
- 所有引用到的按钮、徽章、下划线会整体变色。

### Q6：响应式断点是多少？
| 断点 | 适配 | 效果 |
|---|---|---|
| ≤ 1100px | 平板 | 容器缩小、卡片变密、弹窗字号变小 |
| ≤ 768px | 手机横屏/小平板 | 搜索框移到Logo下一行、卡片2~3列、系统需求改1栏、弹窗全屏无圆角 |
| ≤ 480px | 手机竖屏 | 卡片最小145px宽、字号进一步缩小、回到顶部按钮变小 |

---

## 📝 License

本项目作为前端演示项目，遵循 MIT License 自由使用。
游戏名称、开发商等信息仅为演示用途。
图片来自 [Picsum Photos](https://picsum.photos) 免费随机占位图服务。
