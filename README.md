# Private Novel Studio Pro

**私人小说创作工作室** — AI 辅助小说创作桌面应用

基于 Electron 35 + React 19 + TypeScript 6 + Vite 8 的全栈桌面应用。集成一键推导、长篇规划、自动续写、文本润色、角色/世界观管理、智能标签、剧情可视化、感情线/肉欲线双轨编辑、AI 对话等功能，支持国内外主流 AI 模型。

---

## 目录

- [功能一览](#-功能一览)
- [快速开始](#-快速开始)
- [技术栈](#-技术栈)
- [架构概览](#-架构概览)
- [模块详解](#-模块详解)
- [Store API](#-store-api)
- [类型系统](#-类型系统)
- [AI 模型配置](#-ai-模型配置)
- [数据持久化](#-数据持久化)
- [打包构建](#-打包构建)
- [项目结构](#-项目结构)
- [许可证](#-许可证)

---

## 功能一览

| 模块 | 路由 | 核心能力 |
|------|------|----------|
| **仪表盘** | `/` | 项目总览、统计卡片 |
| **一键推导** | `/deduce` | 输入主题 → AI 自动生成（标题/简介/角色/世界观/章节/首章） |
| **长篇规划** | `/longplan` | 分卷 + 章节 AI 规划，快速/流水线模式 |
| **自动续写** | `/continue` | 基于上下文自动续写，批量和单章模式 |
| **文本润色** | `/polish` | AI 味检测、多种风格润色、去AI味 |
| **写作区** | `/write` | AI 辅助自由创作，续写和清空 |
| **AI 对话** | `/chat` | 携带项目上下文的 AI 助手，对话气泡 UI |
| **角色管理** | `/character` | 头像/性格标签/关系图谱/AI 辅助生成 (53KB) |
| **世界观管理** | `/world` | 搜索/类型过滤/规则/地点/时间线/社会/文化/经济 |
| **剧情可视化** | `/plotview` | 9 大 Tab：梗概/角色/世界观/感情线(React Flow)/肉欲线/大纲/章节/关系图谱/标签 |
| **感情线编辑** | 嵌入 plotview | React Flow 拖拽节点 + 类型切换（感情/冲突/高潮/肉欲） |
| **肉欲线编辑** | 嵌入 plotview | 拖拽调整强度曲线 + 标记高潮点 |
| **智能标签** | `/tags` | 7 大分类、关键词识别、预设模板、导出导入 |
| **模板库** | `/templates` | 预设/自定义 Prompt/Tag/Deduce 模板 |
| **AI 模型** | `/aimodel` | 集成 DeepSeek/通义千问/百度等，自定义 Base URL |
| **记忆系统** | `/memory` | LLM 调用统计、自动/手动记忆、搜索过滤 |
| **日志中心** | `/logs` | 操作日志记录、筛选、导出 JSON |
| **设置中心** | `/settings` | 外观/自动保存/AI 参数/成人模式/危险操作 |
| **导出中心** | 嵌入 settings | 4 种导出格式（JSON/Markdown/SRS v2.3 标准结构） |

---

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 启动开发模式（Electron + Vite HMR）
npm run dev

# 3. 构建生产版本
npm run build

# 4. 打包单文件便携版
npm run pack:portable

# 5. 打包 NSIS 安装包
npm run pack:win
```

**前置要求：** Node.js >= 18，npm >= 9

---

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| **Electron** | ^35.0.0 | 桌面应用框架 |
| **React** | ^19.2.5 | UI 组件库 |
| **TypeScript** | ~6.0.2 | 类型安全 |
| **Vite** | ^8.0.10 | 构建工具 / HMR / 代码分割 |
| **Zustand** | ^5.0.12 | 状态管理 + `persist` 中间件 |
| **React Router** | ^7.14.2 | HashRouter 客户端路由 |
| **React Flow (xyflow)** | ^12.10.2 | 关系图谱/感情线节点编辑器 |
| **Lucide React** | ^1.14.0 | 图标库 |
| **Framer Motion** | ^12.38.0 | 动画/过渡效果 |
| **Ant Design** | ^6.x | 部分 UI 组件 |
| **electron-builder** | ^26.8.1 | NSIS 安装包/便携版打包 |

---

## 架构概览

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Main Process                 │
│  src/main/index.ts                                      │
│  └── 创建窗口、管理生命周期、background 防白屏           │
├─────────────────────────────────────────────────────────┤
│                    Electron Preload                      │
│  src/main/preload.ts                                     │
│  └── contextBridge.exposeInMainWorld                     │
├─────────────────────────────────────────────────────────┤
│                    React Renderer (src/renderer/)         │
│                                                          │
│  ┌──────────┐  ┌────────────────────────────────────┐   │
│  │  Sidebar  │  │  Routes (React.lazy + Suspense):   │   │
│  │  (memo)   │  │  14 个路由按需加载                   │   │
│  │           │  │  / → Dashboard                     │   │
│  │ 深色主题  │  │  /deduce → Deduce                  │   │
│  │ #FF4D94   │  │  /character → Character            │   │
│  └──────────┘  │  /plotview → PlotView (ReactFlow)   │   │
│                │  ...                                │   │
│                └────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │        Store (Zustand + persist)                  │   │
│  │  30+ 持久化字段 + 40+ Action 方法                 │   │
│  │  autoSave 定时器 + beforeunload 双保险             │   │
│  │  自动备份到 backup-{timestamp} 键（保留 10 个）     │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────── Components ────────────┐                   │
│  │  ui.tsx 共享组件库                  │                   │
│  │  Card / Btn / StatCard / Modal     │                   │
│  │  Input / Select / Badge / Chip     │                   │
│  │  ProgressBar / Empty / Divider     │                   │
│  │  LoadingFallback                   │                   │
│  └────────────────────────────────────┘                   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Services / Utils / Hooks                          │   │
│  │  aiService.ts → 统一流式/非流式 AI 调用            │   │
│  │  aiDispatcher.ts → 限流 + 重试 + Prompt 构建      │   │
│  │  promptLoader.ts → Vite glob 加载 .md 提示词       │   │
│  │  markdownParser.ts → Markdown 字段提取             │   │
│  │  deduceParser.ts → AI 结果两遍扫描解析              │   │
│  │  useWriting / usePolish / useChat / useMemory      │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 数据流

```
用户输入 → 页面组件 (UI State)
         → Store Action → Zustand set() → persist → localStorage
                                                ↓
       autoSave 定时器 (每 autoSaveInterval 秒) → 全量写入
       beforeunload / visibilitychange → saveNow() 强制写入
```

---

## 模块详解

### 1. 一键推导 (`/deduce`)

**核心文件**: `src/renderer/pages/deduce/index.tsx`

- 输入剧情设定 → AI 自动推导大纲与详细展开
- 流式输出 + 实时字数统计
- 深色主题 UI，三段式结果展示

### 2. 长篇规划 (`/longplan`)

**核心文件**: `src/renderer/pages/longPlan/index.tsx`

- AI 大纲生成（目标字数 + 卷数）
- 3 栏布局：卷列表 / 章节列表 / 章节编辑器
- 章节状态切换（草稿/完成/已润色）
- AI 章节生成（全新生成/续写）

### 3. 自动续写 (`/continue`)

**核心文件**: `src/renderer/pages/continue/index.tsx`

- 基于前文 + 角色 + 世界观上下文续写
- 6 种续写方向预设 + 自定义方向
- 5 档目标字数
- 流式输出 + 进度条

### 4. 文本润色 (`/polish`)

**核心文件**: `src/renderer/pages/polish/index.tsx`

- 4 种润色模式：标准/文学增强/简化/情绪增强
- 智能文本分割（段落/句子边界）
- 使用共享 UI 组件

### 5. 角色管理 (`/character`)

**核心文件**: `src/renderer/pages/character/index.tsx` (53KB)

- 40 个头像选项、48 个性格标签
- AI 辅助：角色生成/扩展/语言风格
- 关系生成（选两个角色 + 背景）
- 导出角色 MD / JSON

### 6. 世界观管理 (`/world`)

**核心文件**: `src/renderer/pages/world/index.tsx`

- 搜索 + 8 种类型过滤
- 规则/地点/时间线/社会/文化/经济
- 8 种世界类型
- AI 扩展模式
- 使用共享 UI 组件（Card/Btn/Modal/Badge）

### 7. 剧情可视化 (`/plotview`)

**核心文件**: `src/renderer/pages/plotView/index.tsx` (643 行)

9 个 Tab 页：

| Tab | 内容 |
|-----|------|
| 故事梗概 | 标题 + 简介编辑 |
| 角色档案 | 3 列网格展示 |
| 世界观 | 完整展示 |
| 感情线 | React Flow 节点编辑器 + 时间轴事件 |
| 肉欲线 | 拖拽调整强度柱状图，标记高潮点 |
| 剧情大纲 | 可编辑节点，支持排序 |
| 章节目录 | 列表展示，含字数/状态 |
| 关系图谱 | React Flow 交互图 |
| 标签管理 | 标签列表 |

### 8. 感情线编辑器 (`emotionFlow`)

- React Flow 拖拽节点 + 自动连线
- 4 种节点类型：感情/冲突/高潮/肉欲
- 节点编辑弹窗（名称/类型/强度/描述）
- 实时同步 Store

### 9. 肉欲线编辑器 (`lustCurve`)

- 拖拽调整强度柱状图（0-100）
- 标记/取消高潮点
- 章节联动

### 10. 智能标签 (`/tags`)

**核心文件**: `src/renderer/pages/tags/index.tsx`

| 功能 | 说明 |
|------|------|
| 7 大分类 | character / profession / scene / plot / fetish / costume / fantasy |
| 关键词识别 | 输入关键词 → 自动分类 + 扩展 |
| 预设模板 | 8 组预设标签组合 |
| 导入导出 | JSON 导入导出，自动去重 |
| 批量操作 | 全选/取消/批量删除 |

### 11. UI 设计系统

**核心文件**: `src/renderer/components/ui.tsx`

| 组件 | 用途 |
|------|------|
| `Card` | 通用卡片容器，hover 高亮 |
| `StatCard` | 统计数值卡片，支持颜色 |
| `Btn` | 按钮（primary/secondary/danger/ghost），支持 loading |
| `Input` / `Select` / `Textarea` | 输入组件，统一深色主题 |
| `Modal` | 模态弹窗，点击遮罩关闭 |
| `Badge` | 标签/徽标，支持 dot |
| `Chip` | 标签选择器，支持 removable |
| `ProgressBar` | 进度条 |
| `Empty` | 空状态占位 |
| `LoadingFallback` | 加载中旋转动画 |
| `Divider` | 分隔线 |

主色调 `#FF4D94`，CSS 自定义属性系统（`--accent` / `--bg-*` / `--text-*` / `--radius-*`）。

---

## Store API

**核心文件**: `src/renderer/store/index.ts` (500+ 行)

同时导出 `useStore` 和 `useAppStore`（兼容别名）。

### 状态字段（30+ 持久化）

| 分组 | 字段 |
|------|------|
| 项目数据 | `currentNovel`, `characters`, `worldSettings`, `chapters`, `volumes`, `plotLines`, `tags`, `selectedTagIds`, `outlineNodes` |
| 感情/肉欲线 | `emotionArc` (EmotionArc), `emotionEvents`, `lustArc` (LustArc) |
| AI 模型 | `aiModels`, `currentModel` |
| 记忆/日志/对话 | `memories`, `logs`, `messages`, `conversations`, `deduceTask` |
| 设置 | `adultMode`, `eroticMode`, `fontSize`, `autoSaveInterval`, `autoBackup`, `defaultTemperature`, `defaultMaxTokens`, `apiTimeout`, `theme`, `accentColor`, `streamOutput` |

### 核心 Action 方法

| 分类 | 方法 |
|------|------|
| 项目 | `setCurrentNovel`（级联清理/过滤关联数据）, `updateNovel` |
| 角色 CRUD | `addCharacter`, `updateCharacter`, `removeCharacter`（级联清理 relationships/chapters/novel） |
| 世界观 CRUD | `addWorldSetting`, `updateWorldSetting`, `removeWorldSetting` |
| 章节 CRUD | `addChapter`, `updateChapter`（自动计算字数）, `removeChapter`, `deleteChapter` |
| 卷 CRUD | `addVolume`, `updateVolume`, `deleteVolume` |
| 剧情线 | `addPlotLine`, `updatePlotLine` |
| 感情/肉欲线 | `updateEmotionArc`, `updateEmotionEvents`, `updateLustArc`（自动关联 novel） |
| 标签 | `addTag`, `removeTag`, `removeTagsBatch`, `updateTag`, `toggleTagSelection`, `clearSelection` |
| AI 模型 | `addModel`, `removeModel`, `updateModel`, `setCurrentModel`, `setDefaultModel` |
| 记忆 | `addMemory`, `removeMemory`, `clearMemories` |
| 日志 | `addLog`, `clearLogs` |
| 推导 | `importFromDeduce`（8 个字段映射）, `updateDeduceTask`, `validateCurrentModel`, `failDeduceTask` |
| 设置 | `toggleAdultMode`, `setFontSize`, `setAutoSaveInterval`（重置定时器）, `setAutoBackup`（触发备份）, `setDefaultTemperature`, `setDefaultMaxTokens`, `setApiTimeout` |
| 危险操作 | `clearAllData`（保留 AI 模型设置）, `resetAll`, `importData`（含校验）, `exportData` |
| 工具函数 | `saveNow`（手动触发保存）, `listBackups`, `restoreFromBackup` |

---

## 类型系统

**核心文件**: `src/renderer/types/types.ts`

### 基础联合类型

| 类型 | 可选值 |
|------|--------|
| `RoleType` | `'protagonist' \| 'supporting' \| 'minor' \| 'antagonist'` |
| `ChapterStatus` | `'draft' \| 'completed' \| 'polished'` |
| `TagCategory` | `'character' \| 'profession' \| 'scene' \| 'plot' \| 'fetish' \| 'costume' \| 'fantasy'` |
| `WorldType` | 9 种（campus/urban/apocalypse/fantasy/scifi/xuanhuan/historical/wuxia/custom） |
| `EmotionEventType` | `'emotion' \| 'conflict' \| 'climax' \| 'adult'` |
| `NovelLength` | 5 档（3千/3万/10万/50万/100万字） |

### 核心接口

- `Novel` — 小说项目（含 `emotionArcId` / `lustArcId` 关联）
- `Character` — 角色（含 `nsfwProfile` 扩展）
- `WorldSetting` — 世界观（rules/locations/timeline/society/culture/economy）
- `Chapter` — 章节（含 `wordCount` / `characters[]` / `tags[]`）
- `EmotionArc` — 感情线（nodes/edges/timeline）
- `LustArc` — 肉欲线（intensityCurve/climaxPoints）
- `OneClickResult` — 一键推导结果（新增 `emotionArc` / `lustArc` / `tags` / `prompts`）

---

## AI 模型配置

| 类型 | 服务商 | 配置方式 |
|------|--------|----------|
| 海外 | OpenAI / Anthropic | 标准 API Key + Base URL |
| 国产 | DeepSeek / 月之暗面 / 通义千问 / 硅基流动 | 内置预设，一键添加 |
| 本地 | Ollama / LM Studio | 自定义 Base URL |

支持 Temperature（0-2）、Max Tokens（2K-32K）、Stream 开关。

---

## 数据持久化

使用 Zustand `persist` 中间件 + `localStorage`：

- **版本控制**：`_version: 2`，支持 v0→v1→v2 自动迁移
- **自动保存**：`autoSaveInterval` 定时器（秒级）
- **自动备份**：`autoBackup=true` 时每轮保存自动复制到 `backup-{timestamp}`（保留 10 个）
- **双保险**：`beforeunload` + `visibilitychange` 事件强制写入
- **数据恢复**：`restoreFromBackup(key)` 从备份恢复
- **数据校验**：`validateDataIntegrity()` 修复空数组/空对象

---

## 打包构建

```bash
# 构建前端 + Electron 主进程
npm run build

# 打包为 Windows 便携版（单文件 .exe）
npm run pack:portable

# 打包为 Windows NSIS 安装包
npm run pack:win
```

打包配置（`package.json` `"build"` 字段）：

| 参数 | 值 | 说明 |
|------|-----|------|
| `appId` | `com.private.novel.studio` | 应用 ID |
| `productName` | `Private Novel Studio Pro` | 产品名称 |
| `win.target` | `nsis` | 安装包格式 |
| `nsis.oneClick` | `false` | 显示安装向导 |
| `icon` | `assets/123.ico` | 应用图标 |

---

## 项目结构

```
private-novel-studio-pro/
├── prompts/                    # AI 提示词 .md 文件
├── assets/                     # 图标等静态资源
├── public/                     # 公共静态文件
├── src/
│   ├── main/
│   │   ├── index.ts            # Electron 主进程
│   │   └── preload.ts          # preload 桥接
│   ├── renderer/
│   │   ├── main.tsx            # React 入口 + 全局错误捕获
│   │   ├── App.tsx             # 路由 + 持久化（React.lazy 代码分割）
│   │   ├── routes.tsx          # 路由定义 + NAV_ITEMS
│   │   ├── index.css           # 全局 CSS 变量 + 动画
│   │   ├── components/
│   │   │   ├── ui.tsx          # 共享组件库（12 个组件）
│   │   │   ├── PageWrapper.tsx # 页面统一布局
│   │   │   ├── Sidebar.tsx     # 侧边栏导航（memo + 渐变 Logo）
│   │   │   ├── SafeRender.tsx  # 页面级错误边界
│   │   │   └── nsfwEditor.tsx  # NSFW 角色卡编辑
│   │   ├── pages/              # 所有页面（21 个目录）
│   │   │   ├── dashboard/      # 仪表盘
│   │   │   ├── deduce/         # 一键推导
│   │   │   ├── longPlan/       # 长篇规划
│   │   │   ├── continue/       # 自动续写
│   │   │   ├── polish/         # 文本润色
│   │   │   ├── write/          # 写作区
│   │   │   ├── chat/           # AI 对话
│   │   │   ├── character/      # 角色管理
│   │   │   ├── world/          # 世界观管理
│   │   │   ├── plotView/       # 剧情可视化（9 Tab）
│   │   │   ├── emotionFlow/    # 感情线编辑器
│   │   │   ├── lustCurve/      # 肉欲线编辑器
│   │   │   ├── tags/           # 智能标签
│   │   │   ├── templates/      # 模板库
│   │   │   ├── memory/         # 记忆系统
│   │   │   ├── aiModel/        # AI 模型配置
│   │   │   ├── export/         # 导出中心
│   │   │   ├── logs/           # 日志中心
│   │   │   ├── settings/       # 设置中心
│   │   │   ├── chunkDeduce/    # 分块推导
│   │   │   └── deduce/         # 一键推导
│   │   ├── store/
│   │   │   └── index.ts        # Zustand store（500+ 行）
│   │   ├── services/
│   │   │   ├── aiService.ts    # 统一 AI 调用（流式/非流式）
│   │   │   └── aiDispatcher.ts # AI 调度（限流/重试/Prompt 构建）
│   │   ├── hooks/
│   │   │   ├── useWriting.ts   # 写作 Hook
│   │   │   ├── usePolish.ts    # 润色 Hook（智能分割）
│   │   │   ├── useChat.ts      # 对话 Hook（mountedRef 防泄漏）
│   │   │   ├── useMemory.ts    # 记忆 Hook
│   │   │   └── memoryExtractor.ts # 记忆提取（规则引擎）
│   │   ├── types/
│   │   │   └── types.ts        # 全局类型定义
│   │   └── utils/
│   │       ├── character.ts    # 角色系统常量
│   │       ├── characterAI.ts  # 角色 AI 辅助
│   │       ├── tagPrompts.ts   # 标签系统常量
│   │       ├── promptLoader.ts # 提示词加载
│   │       ├── markdownParser.ts # Markdown 解析
│   │       ├── deduceParser.ts # 推导结果解析
│   │       ├── deduceTransformer.ts # 转换层
│   │       └── markdownParser.ts # Markdown 字段提取
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

---

## 许可证

MIT License

Copyright (c) 2025 Private Novel Studio Pro
