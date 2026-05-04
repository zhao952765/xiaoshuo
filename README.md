# Private Novel Studio Pro

**私人小说创作工作室** — AI 辅助小说创作桌面应用

基于 Electron 35 + React 19 + TypeScript 6 + Vite 8 的全栈桌面应用。集成一键推导、长篇规划、自动续写、文本润色、角色/世界观管理、智能标签、剧情可视化、AI 对话等功能，支持国内外主流 AI 模型。

---

## 目录

- [功能一览](#-功能一览)
- [快速开始](#-快速开始)
- [技术栈](#-技术栈)
- [架构概览](#-架构概览)
- [路由与页面](#-路由与页面)
- [模块详解](#-模块详解)
- [Store API](#-store-api)
- [类型系统](#-类型系统)
- [AI 模型配置](#-ai-模型配置)
- [数据持久化](#-数据持久化)
- [打包构建](#-打包构建)
- [许可证](#-许可证)

---

## ✨ 功能一览

| 模块 | 路由 | 核心能力 |
|------|------|----------|
| **仪表盘** | `/` | 项目总览、统计卡片 |
| **一键推导** | `/deduce` | 输入主题 → AI 自动生成完整小说（标题/简介/角色/世界观/章节/首章） |
| **长篇规划** | `/longplan` | 分卷 + 章节 AI 规划，快速/流水线模式 |
| **自动续写** | `/continue` | 基于上下文自动续写，批量和单章模式 |
| **文本润色** | `/polish` | AI 味检测、多种风格润色、去AI味 |
| **角色管理** | `/character` | 头像/性格标签/关系图谱/AI 辅助生成 |
| **世界观管理** | `/world` | 规则/地点/时间线/社会/文化/经济 |
| **剧情可视化** | `/plotview` | 时间轴/大纲编辑/章节目录/关系图谱/世界观查阅 |
| **智能标签** | `/tags` | 7 大分类、关键词识别、预设模板、导出导入 |
| **AI 模型** | `/aimodel` | 集成 DeepSeek/通义千问/百度等，自定义 Base URL |
| **AI 对话** | `/chat` | 携带项目上下文的 AI 助手 |
| **记忆系统** | `/memory` | LLM 调用统计、自动/手动记忆 |
| **日志** | `/logs` | 操作日志记录与查看 |
| **设置** | `/settings` | 外观/数据管理/生成参数/隐私安全 |

---

## 🚀 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/your-username/private-novel-studio-pro.git
cd private-novel-studio-pro

# 2. 安装依赖
npm install

# 3. 启动开发模式（Electron + Vite HMR）
npm run dev

# 4. 构建生产版本
npm run build

# 5. 打包桌面应用
npm run pack
```

**前置要求：** Node.js >= 18，npm >= 9

---

## 🏗️ 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| **Electron** | ^35.0.0 | 桌面应用框架（Chromium + Node.js） |
| **React** | ^19.2.5 | UI 组件库 |
| **TypeScript** | ~6.0.2 | 类型安全（零 `any` 设计目标） |
| **Vite** | ^8.0.10 | 构建工具 / HMR / 编译时 glob 导入 |
| **Zustand** | ^5.0.12 | 状态管理 + `persist` 中间件持久化 |
| **React Router** | ^7.14.2 | HashRouter 客户端路由 |
| **React Flow (xyflow)** | ^12.10.2 | 关系图谱/节点编辑器 |
| **Lucide React** | ^1.14.0 | 图标库 |
| **Framer Motion** | ^12.38.0 | 动画/过渡效果 |
| **Ant Design / @ant-design/icons** | ^6.x | 部分 UI 组件 |
| **electron-builder** | ^26.8.1 | NSIS 安装包打包 |
| **vite-plugin-electron** | ^0.29.1 | Electron + Vite 集成插件 |

---

## 🏛️ 架构概览

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Main Process                 │
│  src/main/index.ts                                      │
│  └── 创建窗口、管理生命周期、窗口关闭时持久化数据          │
├─────────────────────────────────────────────────────────┤
│                    Electron Preload                      │
│  electron/preload.ts                                     │
│  └── contextBridge.exposeInMainWorld('electronAPI', ...) │
├─────────────────────────────────────────────────────────┤
│                    React Renderer                         │
│                                                          │
│  ┌──────────┐  ┌────────────────────────────────────┐   │
│  │  Sidebar  │  │  Routes (HashRouter):              │   │
│  │           │  │  / → Dashboard                     │   │
│  │ 导航菜单  │  │  /deduce → Deduce (一键推导)       │   │
│  │           │  │  /longplan → LongPlan              │   │
│  │           │  │  /continue → ContinueWrite         │   │
│  │           │  │  /polish → Polish                  │   │
│  │           │  │  /character → Character            │   │
│  │           │  │  /world → World                    │   │
│  │           │  │  /plotview → PlotView              │   │
│  │           │  │  /tags → Tags                      │   │
│  │           │  │  /memory → Memory                  │   │
│  │           │  │  /aimodel → AIModel                │   │
│  │           │  │  /chat → Chat                      │   │
│  │           │  │  /logs → Logs                      │   │
│  │           │  │  /settings → Settings               │   │
│  └──────────┘  └────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │            Store (Zustand + persist)              │   │
│  │  22 个持久化字段 + 50+ 个 Action 方法             │   │
│  │  自动同步 localStorage + beforeunload 双保险       │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │            Utils                                  │   │
│  │  promptLoader.ts → Vite glob 加载 .md 提示词文件   │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 数据流

```
用户输入 → 页面组件 (UI State)
         → Store Action → Zustand set() → persist 中间件 → localStorage
                                                ↓
                                  beforeunload / Electron close → 强制全量写入
```

---

## 📁 项目结构

```
private-novel-studio-pro/
├── electron/
│   ├── main.ts              # Electron 主进程（窗口创建、生命周期）
│   └── preload.ts           # preload 桥接脚本
├── assets/                   # 图标等静态资源
├── public/                   # 公共静态文件
├── src/
│   ├── config/
│   │   ├── types.ts          # 全局类型定义（16+ 接口 + 13+ 类型别名）
│   │   └── prompts/          # AI 提示词 .md 文件（编译时 glob 导入）
│   ├── main/
│   │   └── index.ts          # Electron 主进程入口
│   ├── renderer/
│   │   ├── App.tsx           # 应用入口 + beforeunload 持久化
│   │   ├── main.tsx          # React render 入口
│   │   ├── index.css         # 全局样式（滚动条/选择颜色）
│   │   ├── components/
│   │   │   ├── PageWrapper.tsx    # 页面统一布局包装器
│   │   │   ├── Sidebar.tsx        # 侧边栏导航
│   │   │   ├── ErrorBoundary.tsx  # 错误边界
│   │   │   └── tagPrompts.ts      # 标签提示词（旧副本）
│   │   ├── constants/
│   │   │   └── tagPrompts.ts      # 标签系统常量配置
│   │   ├── core/                  # 核心创作功能
│   │   │   ├── deduce/            # 一键推导
│   │   │   ├── longPlan/          # 长篇规划
│   │   │   ├── continue/          # 续写
│   │   │   └── polish/            # 润色 & AI味检测
│   │   ├── modules/               # 辅助业务模块
│   │   │   ├── character/         # 角色管理
│   │   │   ├── world/             # 世界观
│   │   │   ├── plotView/          # 剧情可视化
│   │   │   ├── tags/              # 智能标签
│   │   │   ├── memory/            # 记忆系统
│   │   │   └── chat/              # AI 对话
│   │   ├── pages/                 # 路由页面
│   │   │   ├── dashboard/         # 首页
│   │   │   ├── aiModel/           # AI 模型配置
│   │   │   ├── logs/              # 日志查看
│   │   │   └── settings/          # 设置中心
│   │   ├── store/
│   │   │   └── index.ts           # Zustand 全局状态（791 行）
│   │   └── utils/
│   │       └── promptLoader.ts    # 提示词加载工具
│   ├── index.css
│   └── main.tsx
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

---

## 📦 模块详解

### 1. 一键推导 (`/deduce`)

**核心文件**: `src/renderer/core/deduce/index.tsx`

| 函数 | 说明 |
|------|------|
| `callAIModelStream()` | SSE 流式调用 AI API，逐 token 收集 |
| `extractBlock(text, keywords)` | 通用 Markdown 块提取器，支持 `#` / `##` / `**` / `【】` / `第X章` 等格式 |
| `parseDeduceResult(aiText)` | 解析 AI 返回文本 → 提取标题/简介/章节/配角/世界观/剧情线 |

**流程**: 用户输入主题 → 加载 `prompts.md` 模板 → 替换变量 → 调用 AI 流式 API → `parseDeduceResult` 解析 → 存入 Store → 用户保存/放弃

**解析器支持格式**:
- 章节: `第X章 标题` / `## 第X章` / `### 第X章` / `Chapter X`
- 配角: `- 名字：描述` / `**名字**：描述` / 姓名: XXX
- 世界观: `规则` / `地点` / `时间线` 区块自动提取
- 感情线: 从 `感情线` 区块提取编号事件，无则从章节生成

#### 统一转换层 (`src/renderer/utils/deduceTransformer.ts`)

`parseDeduceResult()` 解析出原始 JSON 后，`transformDeduceToAppData()` 将其转换为前端所有 6 个可视化模块的完整数据。

| 函数 | 说明 | 输出给 |
|------|------|--------|
| `transformDeduceToAppData(input)` | **统一入口**，一次调用生成全部模块所需数据 | 全部模块 |
| `buildRelationships(chars)` | 自动生成角色双向关系：主角↔配角(相识)、主角↔反派(对立)、配角之间(同伴/相识) | 关系图谱 ReactFlow edges |
| `buildEmotionEvents(events, chapters, charIds, adultMode?)` | 从 plotLine.events 或 chapters 生成感情线事件，type 自动轮换 `emotion→conflict→climax→adult` | 感情线时间轴 |
| `buildOutline(events, chapters)` | 从 events 或 chapters 生成大纲节点，最后兜底 4 幕默认结构 | 剧情大纲编辑区 |

**数据流**:
```
AI 原始文本
  → parseDeduceResult()         [提取原始 JSON]
    → transformDeduceToAppData() [统一转换]
      ├── buildRelationships()   → characters[].relationships 填充 → ReactFlow edges
      ├── buildEmotionEvents()   → emotionEvents[] 生成         → 感情线时间轴
      ├── buildOutline()         → outlineNodes[] 生成           → 大纲编辑区
      └── chapters/worldSetting  → 直接映射                     → 章节目录/世界观
```

**关系生成示例**（3 个角色：主角 + 女配角 + 男反派）：
```
主角.relationships = [
  { targetId: 女配角.id, type: '相识' },
  { targetId: 男反派.id, type: '对立' }
]
女配角.relationships = [
  { targetId: 主角.id,  type: '相识' },
  { targetId: 男反派.id, type: '相识' }
]
男反派.relationships = [
  { targetId: 主角.id,  type: '对立' },
  { targetId: 女配角.id, type: '相识' }
]
```

**感情线生成规则**（每轮循环取下一个 type）：
```
第1个事件 → 'emotion'  第2个 → 'conflict'  第3个 → 'climax'
第4个 → 'emotion'  第5个 → 'adult'(成人模式)  第6个 → 'climax'
...
至少保证 3 个事件，最多取 8 个。
```

---

### 2. 长篇规划 (`/longplan`)

**核心文件**: `src/renderer/core/longPlan/index.tsx`

| 功能 | 说明 |
|------|------|
| AI 大纲生成 | 目标字数 + 卷数 → AI 生成卷列表 + 空章节 |
| 快速规划 | 一行一个章节的快速录入模式 |
| 流水线规划 | 批量生成多卷结构 |
| 章节编辑器 | 大文本域 + 字数统计 + 状态切换（草稿/完成/已润色） |

---

### 3. 自动续写 (`/continue`)

**核心文件**: `src/renderer/core/continue/index.tsx`

| 模式 | 说明 |
|------|------|
| 下一章 | 基于上一章内容生成下一章 |
| 续写当前章 | 在选中的章节末尾追加内容 |
| 批量续写 | 选中多个章节依次续写，支持暂停/停止 |

- 6 种续写方向预设：自然推进 / 高潮爆发 / 温情过渡 / 悬念铺设 / 反转突变 / 揭秘真相
- 4 档目标字数选择

---

### 4. 文本润色 (`/polish`)

**核心文件**: `src/renderer/core/polish/index.tsx`

| 功能 | 说明 |
|------|------|
| AI 味检测 | 基于 `AI_FLAVOR_WORDS` 词库检测 + 评分 0-100 + 高亮标记 |
| 润色模式 | 普通润色 / 去 AI 味 |
| 润色深度 | 轻度 / 中度 / 重度 |
| 文风选择 | 网文爽文 / 都市现实 / 出版文学 / 悬疑电影 / 日系轻小说 / 细腻情感 / 自定义 |

---

### 5. 角色管理 (`/character`)

**核心文件**: `src/renderer/modules/character/index.tsx`

- 40 个头像选项
- 性格标签库：48 个（正面 16 / 负面 16 / 中性 16）
- AI 辅助：角色生成 / 角色扩展 / 语言风格
- 关系生成：选两个角色 + 背景 → AI 生成关系
- 导出角色 MD / 导出全部 JSON

---

### 6. 世界观管理 (`/world`)

**核心文件**: `src/renderer/modules/world/index.tsx`

| 字段 | 说明 |
|------|------|
| `rules` | 规则数组（name/description/scope/limit） |
| `locations` | 地点数组（name/type/description/atmosphere/scenes） |
| `timeline` | 时间线数组（era/title/description/impact） |
| `society` | 社会结构描述 |
| `culture` | 文化风俗描述 |
| `economy` | 经济体系描述 |

- 8 种世界类型：奇幻/科幻/玄幻/都市/历史/末世/武侠/自定义
- AI 一键生成 + 区域/规则/历史扩展
- 6 组预设世界观模板

---

### 7. 剧情可视化 (`/plotview`)

**核心文件**: `src/renderer/modules/plotView/index.tsx`

| 标签页 | 内容 |
|--------|------|
| 故事梗概 | 标题 + 简介编辑 |
| 角色档案 | 3 列网格展示所有角色 |
| 世界观 | 规则/地点/时间线/社会/文化/经济完整展示 |
| 感情线 | 时间轴形式，类型切换（感情/肉欲），关联角色 |
| 剧情大纲 | 可编辑的大纲节点，支持排序 |
| 章节目录 | 章节列表 + 字数 + 状态 |
| 关系图谱 | React Flow 交互图，roleType 着色（主角/反派/配角） |

#### 剧情观数据格式

```typescript
// ====== 感情线事件 ======
interface EmotionEvent {
  id: string;
  title: string;        // 事件标题，如"初次相遇"
  description: string;  // 事件详细描述
  type: 'emotion' | 'adult';  // 感情线 / 肉欲线
  characterIds: string[];     // 关联角色 ID 列表
  order: number;              // 排序序号
}

// ====== 剧情大纲节点 ======
interface OutlineNode {
  id: string;
  title: string;        // 节点标题，如"第一幕 开端"
  content: string;      // 内容概要
  order: number;        // 排序序号
}
```

**存储位置**：根状态 (`emotionEvents`, `outlineNodes`)，不嵌套在 `novel` 对象中，避免同步问题。<br>
**持久化**：通过 Zustand `partialize` 自动保存到 `localStorage`。

**关系图谱数据源**：

```typescript
// 节点：直接来源于 store.characters（每个角色为一个节点）
interface GraphNode {
  id: string;          // character.id
  data: { label: string };  // character.name
  position: { x: number; y: number };
  style: {
    background: string;  // 按 roleType 着色
    border: string;      // 主角紫 / 反派红 / 配角粉
  };
}

// 边：来源于 character.relationships
interface GraphEdge {
  id: string;          // `e-{char.id}-{rel.targetId}`
  source: string;      // char.id
  target: string;      // rel.targetId
  label: string;       // rel.type（如"恋人"、"仇敌"）
  animated: boolean;
  style: { stroke: string; strokeWidth: number };
}
```

**感情线时间轴渲染**：左侧垂直线性渐变（粉→紫→红），每个事件前有对应颜色的圆点标记，点击可编辑类型/标题/描述/关联角色。

**大纲编辑器**：节点可添加/删除/上下排序，每个节点包含 `input`（标题）+ `textarea`（内容）。

---

### 8. 智能标签 (`/tags`)

**核心文件**: `src/renderer/modules/tags/index.tsx`

| 功能 | 说明 |
|------|------|
| 7 大分类 | character / profession / scene / plot / fetish / costume / fantasy |
| 关键词识别 | 输入关键词 → 自动分类 + 扩展关联标签 |
| 预设模板 | 8 组预设标签组合（高H御姐/人妻NTR/办公室黑丝等） |
| 导出 | JSON 导出 / CSV 按分类分组导出 |
| 导入 | JSON 导入 / CSV 导入（自动去重） |
| 批量操作 | 全选/取消全选/批量删除/清空全部 |

**常量配置**: `src/renderer/constants/tagPrompts.ts`

| 导出 | 说明 |
|------|------|
| `TAG_CATEGORY_CONFIG` | 7 分类颜色/图标/描述 |
| `PRESET_TAG_GROUPS` | 8 组预设标签 |
| `CATEGORY_PRIORITY` | 匹配优先级（fetish > costume > ... > character） |
| `TAG_WEIGHT_RECOMMENDATIONS` | 35+ 标签的 AI 权重值（1.25~1.58） |
| `CATEGORY_DEFAULT_WEIGHT` | 分类兜底权重 |
| `TAG_KEYWORD_MAP` | 分类→关键词映射 |
| `LOCAL_TAG_RULES` | 离线扩展规则 |
| `offlineExpand(keywords)` | 关键词 → 多分类扩展 |
| `autoDetectCategory(tag)` | 单标签自动分类 |
| `getRecommendedWeight(tag)` | 精确 + 模糊匹配权重 |
| `generateWeightedPrompt(keywords, options?)` | 生成带 (标签:1.35) 格式的提示词 |
| `generateNegativePrompt(options?)` | 3 级严格度负面提示词 |
| `createFullPrompt(keywords, options?)` | 统一入口，返回 { positive, negative, tags, meta } |

---

### 9. AI 模型管理 (`/aimodel`)

**核心文件**: `src/renderer/pages/aiModel/index.tsx`

- 内置预设：DeepSeek / 月之暗面 / 通义千问 / 百度千帆 / 硅基流动
- 当前字段：名称 / Base URL / API Key / 模型 ID / Temperature / Max Tokens / Stream
- 功能：测试连接 / 获取模型列表 / 编辑已添加模型
- 持久化存储，每次启动自动还原当前模型

---

### 10. 全局状态 Store

**核心文件**: `src/renderer/store/index.ts`

**状态字段（22 个持久化）**:

| 分组 | 字段 | 类型 |
|------|------|------|
| 核心数据 | `currentNovel` | `Novel \| null` |
| | `characters` | `Character[]` |
| | `worldSettings` | `WorldSetting[]` |
| | `chapters` | `Chapter[]` |
| | `volumes` | `Volume[]` |
| | `plotLines` | `PlotLine[]` |
| | `tags` | `Tag[]` |
| | `memories` | `Memory[]` |
| | `logs` | `Log[]` |
| | `conversations` | `Conversation[]` |
| AI 模型 | `aiModels` | `AIModel[]` |
| | `currentModel` | `AIModel \| null` |
| 衍生数据 | `emotionEvents` | `EmotionEvent[]` |
| | `outlineNodes` | `OutlineNode[]` |
| 推导状态 | `deduceTask` | `DeduceTask \| null` |
| UI 状态 | `isLoading` | `boolean`（非持久化） |
| | `adultMode` | `boolean` |
| | `selectedTagIds` | `string[]` |
| 设置 | `fontSize` | `'small' \| 'medium' \| 'large'` |
| | `autoSaveInterval` | `number`（分钟） |
| | `autoBackup` | `boolean` |
| | `defaultTemperature` | `number` |
| | `defaultMaxTokens` | `number` |
| | `apiTimeout` | `number`（秒） |

**核心 Action 方法（50+）**:

| 分类 | 方法 | 说明 |
|------|------|------|
| 项目 | `setNovel()` `updateNovel()` | 设置/更新当前小说 |
| 角色 CRUD | `addCharacter()` `updateCharacter()` `removeCharacter()` | 角色增删改 |
| 世界观 CRUD | `addWorldSetting()` `updateWorldSetting()` `removeWorldSetting()` | 世界观增删改 |
| 章节 CRUD | `addChapter()` `updateChapter()` `removeChapter()` `reorderChapters()` | 章节增删改 + 排序 |
| 卷 CRUD | `addVolume()` `updateVolume()` `removeVolume()` | 卷增删改 |
| 剧情线 | `addPlotLine()` `updatePlotLine()` `removePlotLine()` | 剧情线操作 |
| 标签 | `addTag()` `updateTag()` `removeTag()` `removeTagsBatch()` `clearAllTags()` `toggleTagSelection()` `toggleTagFavorite()` `clearSelection()` | 标签完整操作 |
| 记忆 | `addMemory()` `updateMemory()` `removeMemory()` `clearMemories()` | 记忆 CRUD |
| AI 模型 | `setCurrentModel()` `addModel()` `removeModel()` `updateModel()` `setDefaultModel()` `validateCurrentModel()` | 模型管理 |
| 日志 | `addLog()` `clearLogs()` | 日志 |
| 对话 | `addConversation()` `updateConversation()` `removeConversation()` `clearConversations()` | 对话 |
| 推导任务 | `startDeduceTask()` `completeDeduceTask()` `failDeduceTask()` `clearDeduceTask()` | 跨页面任务跟踪 |
| 导入导出 | `importFromDeduce()` `importFromLongPlan()` `applyPolishResult()` `exportProject()` `loadProject()` `resetAll()` | 数据导入导出 |
| 设置 | `setFontSize()` `setAutoSaveInterval()` `setAutoBackup()` `setDefaultTemperature()` `setDefaultMaxTokens()` `setApiTimeout()` | 应用设置 |

---

## 📐 类型系统

**核心文件**: `src/config/types.ts`

**基础类型别名（13 个）**:

| 类型 | 可选值 |
|------|--------|
| `RoleType` | `'protagonist' \| 'supporting' \| 'minor' \| 'antagonist'` |
| `ChapterStatus` | `'draft' \| 'completed' \| 'polished'` |
| `TagCategory` | `'character' \| 'profession' \| 'scene' \| 'plot' \| 'fetish' \| 'costume' \| 'fantasy'` |
| `WorldType` | `'campus' \| 'urban' \| 'apocalypse' \| 'fantasy' \| 'scifi' \| 'xuanhuan' \| 'historical' \| 'wuxia' \| 'custom'` |
| `PlotLineType` | `'main' \| 'romance' \| 'erotic' \| 'side' \| 'character'` |
| `LogType` | `'info' \| 'warn' \| 'error' \| 'success'` |
| `AIModelType` | `'openai' \| 'anthropic' \| 'google' \| 'azure' \| 'local' \| 'custom'` |
| `MemoryType` | `'auto' \| 'manual' \| 'llm' \| 'error'` |
| `NovelLength` | `'3000' \| '30000' \| '100000' \| '500000' \| '1000000'` |
| `PolishLevel` | `'light' \| 'medium' \| 'deep'` |
| `StyleType` | `'webnovel' \| 'urban' \| 'literary' \| 'suspense' \| 'lightnovel' \| 'emotional' \| 'custom'` |

**核心接口（16 个）**:

```typescript
Novel               // 小说项目（id/title/summary/adultMode/characters[]/chapters[]/emotionEvents/outlineNodes）
Character           // 角色（id/name/roleType/basicInfo/appearance/personality[]/background/relationships[]）
WorldSetting        // 世界观（rules[]/locations[]/timeline[]/society/culture/economy）
Chapter             // 章节（title/summary/content/order/status/wordCount）
PlotLine            // 剧情线（events[]/relatedCharacters[]）
Tag                 // 标签（name/category/color/isFavorite）
Memory              // 记忆（type/content/source/tags）
AIModel             // AI 模型（apiKey/baseUrl/modelId/temperature/maxTokens/stream）
Conversation        // 对话会话（messages[]/context）
Log                 // 日志（type/message/detail/timestamp）
Volume              // 卷
OneClickResult      // 一键推导结果
PolishResult        // 润色结果
TagExpansionResult  // 标签扩展结果
RelationNode        // 关系图谱节点
RelationEdge        // 关系图谱边
AppState            // 应用全局状态
```

---

## 🤖 AI 模型配置

| 类型 | 服务商 | 配置示例 |
|------|--------|----------|
| 海外 | OpenAI / Anthropic / Google / Azure | 标准 API Key + 官方 Base URL |
| 国产 | DeepSeek / 月之暗面 / 通义千问 / 百度千帆 / 硅基流动 | 内置预设，一键添加 |
| 本地 | Ollama / 兼容 OpenAI API | 自定义 Base URL，如 `http://localhost:11434/v1` |

支持自定义 Temperature（0-2）、Max Tokens、Stream 开关。添加后可测试连接和获取模型列���。

---

## 💾 数据持久化

使用 Zustand `persist` 中间件 + `localStorage`：

- **自动同步**: 每次 `set()` 调用后通过 `localStorage.setItem` 同步写入
- **双保险机制**:
  1. `beforeunload` 事件（浏览器刷新/关闭）
  2. Electron `close` 事件 → `executeJavaScript` 强制写入
- **持久化键名**: `private-novel-studio-pro-storage`
- **数据迁移**: `loadProject()` 兼容旧版本字段（自动补充缺失字段默认值）

---

## 📡 工具函数

### `src/renderer/utils/promptLoader.ts`

| 函数 | 签名 | 说明 |
|------|------|------|
| `loadPrompt` | `(filename: string): string` | 加载 `.md` 提示词文件（编译时 glob） |
| `loadPromptWithVars` | `(filename, vars): string` | 加载 + 替换 `{key}` 占位符 |
| `listPrompts` | `(): string[]` | 列出所有可用提示词文件名 |

提示词文件位于 `src/config/prompts/*.md`，通过 Vite `import.meta.glob` 编译时导入。

---

## 📦 打包构建

```bash
# 构建前端 + Electron 主进程
npm run build

# 打包为 Windows NSIS 安装程序
npm run pack

# 输出目录：release/
```

打包配置参数（`package.json` `"build"` 字段）：

| 参数 | 值 | 说明 |
|------|-----|------|
| `appId` | `com.private.novel.studio` | 应用 ID |
| `productName` | `Private Novel Studio Pro` | 产品名称 |
| `win.target` | `nsis` | Windows 安装包格式 |
| `nsis.oneClick` | `false` | 非一键安装，显示安装向导 |
| `nsis.allowToChangeInstallationDirectory` | `true` | 允许自定义安装路径 |
| `icon` | `assets/123.ico` | 应用图标 |

---

## 📄 许可证

MIT License

Copyright (c) 2025 Private Novel Studio Pro
