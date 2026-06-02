# Emojigen

> 用一句话描述,几秒生成可下载、可二次编辑的 **SVG 表情包 / 贴纸**。

<p align="center">
  <strong>提示词 → SVG → 表情包</strong><br/>
  流式生成 · 6 种风格 · BYO API Key · 一键导出 SVG / PNG
</p>

<p align="center">
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js" /></a>
  <a href="https://ai-sdk.dev"><img src="https://img.shields.io/badge/AI%20SDK-v6-000?logo=vercel" alt="AI SDK" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" alt="TypeScript" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License" /></a>
</p>

## ✨ 特性

- 🎨 **6 种风格** — 可爱萌系 / 极简线描 / 8-bit 像素 / 赛博朋克 / 手绘水彩 / 极简扁平
- ⚡ **流式生成** — 几秒出图,所见即所得
- 📦 **可下载** — 一键导出 SVG / PNG(SVG 可继续编辑、放大不糊)
- 🔐 **BYO Key** — 自带 API Key,服务端零存储,隐私友好
- 🌐 **多 Provider** — 兼容任何 OpenAI 协议接口:OpenAI / DeepSeek / OpenRouter / Ollama / vLLM
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
- **[Vercel AI SDK v6](https://ai-sdk.dev)** — 流式输出,统一 provider 接口
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
