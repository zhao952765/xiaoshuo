# Private Novel Studio Pro

**私人小说创作工作室**

一款基于 Electron + React + TypeScript 的 AI 辅助小说创作桌面应用。集成一键推导、长篇规划、自动续写、文本润色、角色管理、世界观管理、智能标签系统、剧情观可视化等功能，支持多种国内外 AI 模型。

---

## ✨ 功能一览

| 模块 | 说明 |
|------|------|
| **一键推导** | 输入主题关键词，AI 自动生成完整小说结构 |
| **长篇规划** | 分卷+章节的 AI 规划，支持快速/流水线模式 |
| **自动续写** | 基于上下文自动续写章节内容 |
| **文本润色** | 多种风格润色（正式/生动/简洁/华丽/去AI味） |
| **角色管理** | 创建角色、性格标签、关系图谱 |
| **世界观管理** | 规则/地点/时间线/社会文化经济体系 |
| **智能标签** | 7 大分类、关键词识别、预设模板 |
| **记忆系统** | LLM 调用记录、手动/AI 生成记忆 |
| **剧情可视化** | 时间轴、大纲编辑、章节目录、图谱 |
| **AI 模型管理** | 支持 OpenAI / DeepSeek / 通义千问 / 本地模型等 |
| **聊天助手** | 集成上下文的 AI 对话 |
| **设置中心** | 主题、字体、自动保存、数据导入导出 |

---

## 🚀 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/your-username/private-novel-studio-pro.git
cd private-novel-studio-pro

# 2. 安装依赖
npm install

# 3. 启动开发模式（Electron + Vite 热更新）
npm run dev

# 4. 构建生产版本
npm run build

# 5. 打包桌面应用
npm run pack
```

**前置要求：** Node.js >= 18，npm >= 9

---

## 🏗️ 技术栈

| 技术 | 用途 |
|------|------|
| **Electron 35** | 桌面应用框架 |
| **React 19** | UI 框架 |
| **TypeScript 6** | 类型安全 |
| **Vite 8** | 构建工具 / HMR |
| **Zustand 5** | 状态管理 + 持久化 |
| **React Router 7** | 客户端路由 |
| **React Flow 12** | 关系图谱可视化 |
| **Lucide React** | 图标库 |
| **Framer Motion** | 动效库 |
| **electron-builder** | 应用打包 |

---

## 📁 项目结构

```
private-novel-studio-pro/
├── electron/
│   └── preload.ts              # Electron preload 脚本
├── assets/                     # 图标等静态资源
├── public/                     # 公共静态文件
├── src/
│   ├── config/
│   │   ├── types.ts            # 全局类型定义（15+ 接口）
│   │   └── prompts/            # AI 提示词文件
│   ├── main/
│   │   └── index.ts            # Electron 主进程
│   ├── renderer/
│   │   ├── App.tsx             # 应用入口 + 路由
│   │   ├── components/         # 公共组件
│   │   ├── constants/          # 常量配置
│   │   ├── core/               # 核心功能
│   │   │   ├── deduce/         # 一键推导
│   │   │   ├── longPlan/       # 长篇规划
│   │   │   ├── continue/       # 自动续写
│   │   │   └── polish/         # 文本润色
│   │   ├── modules/            # 功能模块
│   │   ├── pages/              # 页面
│   │   ├── store/              # Zustand 状态
│   │   └── utils/              # 工具函数
│   ├── index.css               # 全局样式
│   └── main.tsx                # 渲染进程入口
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

---

## 🤖 支持的 AI 模型

| 类型 | 服务商 |
|------|--------|
| 海外 | OpenAI / Anthropic / Google / Azure |
| 国产 | DeepSeek / 月之暗面 / 通义千问 / 百度千帆 / 硅基流动 |
| 本地 | Ollama / 兼容 OpenAI API 的本地服务 |

支持自定义 Base URL 和模型 ID，可添加任意兼容 OpenAI API 格式的模型。

---

## 📦 打包构建

```bash
# 构建前端 + 主进程
npm run build

# 打包为 Windows 安装程序（NSIS）
npm run pack

# 输出目录：release/
```

打包配置位于 `package.json` 的 `"build"` 字段，支持自定义应用图标、安装目录等。

---

## 📄 许可证

MIT License

Copyright (c) 2025 Private Novel Studio Pro
