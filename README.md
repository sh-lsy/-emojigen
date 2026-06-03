# Emojigen

> 用一句话描述,几秒生成可下载、可二次编辑的 **SVG 表情包 / 贴纸**。

<p align="center">
  <strong>提示词 → SVG → 表情包</strong><br/>
  流式生成 · 6 种风格 · BYO API Key · 一键导出 SVG / PNG
</p>

<p align="center">
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" alt="TypeScript" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License" /></a>
</p>

## ✨ 特性

- 🎨 **6 种风格** — 可爱萌系 / 极简线描 / 8-bit 像素 / 赛博朋克 / 手绘水彩 / 极简扁平
- ⚡ **流式生成** — 直接 SSE 解析，几秒出图，所见即所得
- 📦 **可下载** — 一键导出 SVG / PNG(SVG 可继续编辑、放大不糊)
- 🔐 **BYO Key** — 自带 API Key,服务端零存储,隐私友好
- 🌐 **多 Provider** — 兼容任何 OpenAI 协议接口:OpenAI / DeepSeek / 智谱 GLM / 通义千问 / 商汤 / OpenRouter / Ollama
- 🕒 **历史画廊** — 自动保存最近 24 个,点一下回填到编辑器
- 📱 **响应式** — 桌面 / 平板 / 手机都好用
- 🪶 **零后端存储** — 历史只存在浏览器 localStorage

## 🚀 快速开始

```bash
git clone https://github.com/sh-lsy/-emojigen
cd emojigen
npm install
npm run dev
```

打开 http://localhost:3000,点右上角 ⚙️ 填入你的 API Key,即可开始生成。

## 🔑 配置 API Key

支持两种方式:

### 方式 1 · 浏览器端(推荐,默认)

点页面右上角 **设置**,填入:
- **Base URL**: `https://api.openai.com/v1`(默认)
- **Model**: `gpt-4o-mini`(便宜好用)
- **API Key**: `sk-...`

Key 仅存于 `localStorage`,不会发送到任何第三方。

### 方式 2 · 服务端环境变量

适合自己部署 / 团队共享。在 `.env.local`:

```bash
OPENAI_API_KEY=sk-...
# 可选:覆盖默认接口和模型
OPENAI_BASE_URL=https://api.openai.com/v1
EMOJIGEN_MODEL=gpt-4o-mini
```

> 不填 UI Key 时,服务端会自动使用环境变量。

## 🎨 风格一览

| 风格 | 说明 | 适合 |
|---|---|---|
| 🥺 Kawaii | 圆胖、腮红、高光 | 贴纸、表情包、聊天配图 |
| ✏️ Line Art | 极细单线 | 品牌装饰、笔记配图 |
| 👾 8-Bit | 复古像素 | 游戏 UI、复古风海报 |
| 🌃 Cyberpunk | 霓虹赛博 | 科技向 B 站封面 |
| 🎨 Hand-drawn | 水彩手绘 | 故事配图、温暖风格 |
| ⚪ Minimal | 几何扁平 | App icon、品牌符号 |

## 🛠️ 技术栈

- **[Next.js 16](https://nextjs.org)** — App Router + Turbopack
- **直接 SSE 流式** — 原生 fetch + SSE 解析，不依赖第三方 SDK，完整支持 `reasoning_content` 推理流
- **[Tailwind CSS v4](https://tailwindcss.com)** — 原子化样式
- **TypeScript** — 端到端类型安全
- **lucide-react** — 图标

## 📁 项目结构

```
src/
├── app/
│   ├── api/generate/route.ts   # 流式生成 API
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   └── EmojiGenerator.tsx      # 单文件主组件
└── lib/
    ├── styles.ts               # 6 种风格定义
    ├── prompt.ts               # System / User 提示词工程
    ├── storage.ts              # localStorage 抽象
    └── utils.ts                # cn / extractSvg / download
```

## 🧪 本地开发

```bash
npm run dev          # 启动开发服务器(Turbopack)
npm run build        # 生产构建
npm run start        # 跑生产构建
npm run lint         # ESLint 检查
```

## 🚢 部署指南

### 服务器要求

| 项目 | 最低要求 | 推荐配置 |
|---|---|---|
| Node.js | 18.17+ | 20.x LTS |
| 内存 | 512MB | 1GB+ |
| 磁盘 | 500MB | 1GB+ |
| 网络 | 能访问 AI API | 低延迟网络 |
| 操作系统 | Linux / macOS | Ubuntu 22.04 / Debian 12 |

### 环境变量

在项目根目录创建 `.env.local`（或在服务器设置环境变量）：

```bash
# 服务端默认 API Key（用户不填 Key 时使用）
OPENAI_API_KEY=sk-...

# 可选：默认 API 地址和模型
OPENAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
EMOJIGEN_MODEL=glm-4-flash
```

> ⚠️ `.env.local` 已被 `.gitignore` 排除，不会提交到 Git。

### 打包构建

```bash
# 1. 安装依赖
npm ci  # 或 npm install

# 2. 生产构建
npm run build

# 3. 构建产物在 .next/ 目录
```

### 部署方式一：Vercel（推荐）

最简单，零配置：

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel

# 生产环境部署
vercel --prod
```

在 Vercel 控制台设置环境变量：
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`（可选）
- `EMOJIGEN_MODEL`（可选）

### 部署方式二：Docker

创建 `Dockerfile`：

```dockerfile
FROM node:20-alpine AS base

# 安装依赖
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# 构建
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 运行
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

需要在 `next.config.ts` 中添加：

```ts
const nextConfig: NextConfig = {
  output: 'standalone',
  // ... 其他配置
};
```

构建和运行：

```bash
docker build -t emojigen .
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=sk-... \
  -e OPENAI_BASE_URL=https://... \
  emojigen
```

### 部署方式三：PM2（Node.js 服务器）

```bash
# 1. 上传代码到服务器
git clone https://github.com/your-repo/emojigen.git
cd emojigen

# 2. 安装依赖和构建
npm ci
npm run build

# 3. 创建 .env.local
nano .env.local
# 填入 OPENAI_API_KEY=sk-...

# 4. 安装 PM2
npm i -g pm2

# 5. 启动服务
pm2 start npm --name "emojigen" -- start

# 6. 设置开机自启
pm2 startup
pm2 save
```

### 部署方式四：Nginx 反向代理

配合 PM2 使用，添加 Nginx 配置：

```nginx
server {
    listen 80;
    server_name emoji.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # 流式传输支持（重要！）
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding on;
    }
}
```

HTTPS 推荐使用 Let's Encrypt：

```bash
sudo certbot --nginx -d emoji.yourdomain.com
```

### 安全检查清单

部署前确认：

- [ ] `.env.local` 未提交到 Git
- [ ] 生产环境设置了 `NODE_ENV=production`
- [ ] API Key 使用环境变量，未硬编码
- [ ] 如果使用 Nginx，配置了 `proxy_buffering off;`
- [ ] 服务器防火墙只开放必要端口（80/443）
- [ ] 定期更新依赖：`npm audit` 和 `npm update`

### 性能优化建议

1. **启用 gzip/brotli 压缩**（Nginx）：
   ```nginx
   gzip on;
   gzip_types text/plain text/css application/json application/javascript;
   ```

2. **静态资源 CDN**：Vercel 自动支持，自建服务器可考虑 CloudFlare

3. **限制请求频率**：建议在 Nginx 层添加 rate limiting

## 🔒 安全特性

- **SSRF 防护**：服务端 API 只允许白名单域名（OpenAI、DeepSeek、智谱、阿里、商汤等）
- **SVG XSS 防护**：自动清理 `<script>`、事件处理器、外部引用
- **输入限制**：Prompt 最大 500 字符
- **隐私友好**：API Key 仅存于浏览器 localStorage，服务端零存储

## 🗺️ Roadmap

- [ ] 多语言提示词(英文/日文/中文自动检测)
- [ ] SVG 后处理:色彩重映射 / 描边粗细滑块
- [ ] 批量生成(一次 4 张,选最喜欢的)
- [ ] PWA 支持(可安装到桌面)
- [ ] 表情包组合(多个 SVG 拼成一张大图)
- [ ] Web Component 导出,塞进任何博客

## 🤝 贡献

欢迎 PR、Issue、Star ⭐

## 📄 License

[MIT](LICENSE)
