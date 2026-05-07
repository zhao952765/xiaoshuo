/**
 * ==========================================
 * 全局类型定义 - Private Novel Studio Pro
 * 统一数据结构版本
 * ==========================================
 */

// ==========================================
// 基础响应类型
// ==========================================

/** AI 响应统一格式 */
export interface AIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/** AI 请求参数 */
export interface AIRequest {
  prompt: string;
  model?: string;
  temperature?: number;
}

// ==========================================
// 消息与结果类型
// ==========================================

/** 对话消息 */
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

/** 写作结果 */
export interface WritingResult {
  id: string;
  content: string;
  createdAt: number;
}

// ==========================================
// 应用状态（已合并到下方完整版）
// ==========================================

// ==========================================
// 基础联合类型
// ==========================================

/** 角色类型 */
export type RoleType = 'protagonist' | 'supporting' | 'minor' | 'antagonist';

/** 章节状态 */
export type ChapterStatus = 'draft' | 'completed' | 'polished';

/** 标签分类 */
export type TagCategory = 'character' | 'profession' | 'scene' | 'plot' | 'fetish' | 'costume' | 'fantasy';

/** 世界观类型 */
export type WorldType = 'campus' | 'urban' | 'apocalypse' | 'fantasy' | 'scifi' | 'xuanhuan' | 'historical' | 'wuxia' | 'custom';

/** 剧情线类型 */
export type PlotLineType = 'main' | 'romance' | 'erotic' | 'side' | 'character';

/** 日志类型 */
export type LogType = 'info' | 'warn' | 'error' | 'success';

/** AI 模型提供商 */
export type AIModelType = 'openai' | 'anthropic' | 'google' | 'azure' | 'local' | 'custom';

/** 记忆来源类型 */
export type MemoryType = 'auto' | 'manual' | 'llm' | 'error';

/** 小说长度档位 */
export type NovelLength = '3000' | '30000' | '100000' | '500000' | '1000000';

/** 润色深度 */
export type PolishLevel = 'light' | 'medium' | 'deep';

/** 文风类型 */
export type StyleType = 'webnovel' | 'urban' | 'literary' | 'suspense' | 'lightnovel' | 'emotional' | 'custom';

/** 关系图谱节点类型 */
export type RelationNodeType = 'character' | 'event' | 'item' | 'location' | 'custom';

/** 关系图谱边类型 */
export type RelationEdgeType = 'default' | 'straight' | 'step' | 'smoothstep' | 'bezier';

/** 感情线事件类型 */
export type EmotionEventType = 'emotion' | 'conflict' | 'climax' | 'adult';

// ==========================================
// 核心数据模型（10个主接口 + SRS v2.3 新增）
// ==========================================

/**
 * 1. 小说项目
 * SRS v2.3 修复：新增 emotionArcId / lustArcId 关联
 */
export interface Novel {
  id: string;
  title: string;
  summary: string;
  adultMode: boolean;
  tags: string[];
  targetWords: NovelLength;
  characters: string[];
  worldSettings: string[];
  chapters: string[];
  plotLines: string[];
  /** SRS v2.3: 关联感情线数据 */
  emotionArcId: string | null;
  /** SRS v2.3: 关联肉欲线数据 */
  lustArcId: string | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * 2. 角色
 * SRS v2.3 修复：NSFW 卡字段扩展
 */
export interface Character {
  id: string;
  name: string;
  roleType: RoleType;
  avatar: string;
  basicInfo: {
    age: string;
    gender: string;
    occupation: string;
  };
  appearance: string;
  personality: string[];
  background: string;
  abilities: string;
  relationships: Array<{
    targetId: string;
    targetName: string;
    type: string;
    description: string;
  }>;
  voice: string;
  innerWorld: string;
  arc: string;
  tags: string[];
  /** SRS v2.3 新增：NSFW 专用字段 */
  nsfwProfile?: {
    bodyType: string;
    sensitiveZones: string[];
    sexualTraits: string[];
    fetishTags: string[];
    experienceLevel: string;
  };
  createdAt: number;
  updatedAt: number;
}

/**
 * 3. 世界观设定
 */
export interface WorldSetting {
  id: string;
  name: string;
  worldType: WorldType;
  description: string;
  overview: string;
  rules: Array<{
    name: string;
    description: string;
    scope: string;
    limit: string;
    sideEffect: string;
  }>;
  locations: Array<{
    name: string;
    type: string;
    description: string;
    atmosphere: string;
    scenes: string[];
  }>;
  timeline: Array<{
    era: string;
    title: string;
    description: string;
    impact: string;
  }>;
  society: string;
  culture: string;
  economy: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * 4. 章节
 */
export interface Chapter {
  id: string;
  title: string;
  summary: string;
  content: string;
  order: number;
  status: ChapterStatus;
  volumeId: string | null;
  wordCount: number;
  mood: string;
  characters: string[];
  hooks: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

/**
 * 5. 剧情线
 */
export interface PlotLine {
  id: string;
  type: PlotLineType;
  name: string;
  description: string;
  events: Array<{
    id: string;
    title: string;
    description: string;
    order: number;
    chapterId: string | null;
  }>;
  relatedCharacters: string[];
  createdAt: number;
  updatedAt: number;
}

/**
 * 6. 标签
 */
export interface Tag {
  id: string;
  name: string;
  category: TagCategory;
  color: string;
  isFavorite: boolean;
  createdAt: number;
}

/**
 * 7. 本地记忆
 */
export interface Memory {
  id: string;
  type: MemoryType;
  content: string;
  source: string;
  tags: string[];
  modelName: string | null;
  projectId: string | null;
  timestamp: number;
  duration: number | null;
}

/**
 * 8. AI 模型配置
 */
export interface AIModel {
  id: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  modelType: AIModelType;
  modelId: string;
  temperature: number;
  maxTokens: number;
  stream: boolean;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * 9. 日志
 */
export interface Log {
  id: string;
  type: LogType;
  message: string;
  detail: string | null;
  timestamp: number;
}

/**
 * 10. 关系图谱节点
 */
export interface RelationNode {
  id: string;
  type: RelationNodeType;
  position: { x: number; y: number };
  data: {
    label: string;
    description?: string;
    color?: string;
    icon?: string;
    metadata?: Record<string, any>;
  };
  width?: number;
  height?: number;
}

/**
 * 关系图谱边
 */
export interface RelationEdge {
  id: string;
  source: string;
  target: string;
  type: RelationEdgeType;
  label?: string;
  animated?: boolean;
  style?: { stroke?: string; strokeWidth?: number };
  data?: Record<string, any>;
}

/** 对话消息 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

/** 对话会话 */
export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  context: {
    characters: boolean;
    worldSettings: boolean;
    chapters: boolean;
  };
  createdAt: number;
  updatedAt: number;
}

// ==========================================
// SRS v2.3 新增：感情线 & 肉欲线 核心数据结构
// ==========================================

/**
 * 感情线节点（React Flow 用）
 * SRS v2.3: emotion_arc.json → nodes[]
 */
export interface EmotionArcNode {
  id: string;
  type: 'emotion' | 'conflict' | 'climax' | 'adult' | 'custom';
  position: { x: number; y: number };
  data: {
    label: string;
    description: string;
    intensity: number; // 0-100
    characterIds: string[];
    chapterId: string | null;
    color: string;
  };
}

/**
 * 感情线边（React Flow 用）
 * SRS v2.3: emotion_arc.json → edges[]
 */
export interface EmotionArcEdge {
  id: string;
  source: string;
  target: string;
  type: 'smoothstep' | 'default' | 'straight';
  label: string;
  animated: boolean;
  style: {
    stroke: string;
    strokeWidth: number;
  };
}

/**
 * 感情线时间轴事件（兼容旧版 + SRS v2.3）
 * SRS v2.3: emotion_arc.json → timeline[]
 */
export interface EmotionArcEvent {
  id: string;
  title: string;
  description: string;
  type: EmotionEventType;
  characterIds: string[];
  order: number;
  intensity: number; // 0-100，SRS v2.3 新增
  nodeId: string | null; // 关联到 React Flow node
}

/**
 * 感情线完整结构
 * SRS v2.3: emotion_arc.json 标准格式
 */
export interface EmotionArc {
  id: string;
  novelId: string;
  nodes: EmotionArcNode[];
  edges: EmotionArcEdge[];
  timeline: EmotionArcEvent[];
  createdAt: number;
  updatedAt: number;
}

/**
 * 肉欲线强度点
 * SRS v2.3: lust_arc.json → intensity_curve[]
 */
export interface LustIntensityPoint {
  id: string;
  chapterId: string | null;
  chapterTitle: string;
  value: number; // 0-100 强度值
  description: string;
  characters: string[];
  sceneType: string; // 如 "暧昧", "接触", "亲密", "高潮"
  order: number;
}

/**
 * 肉欲线高潮点
 * SRS v2.3: lust_arc.json → climax_points[]
 */
export interface LustClimaxPoint {
  id: string;
  chapterId: string | null;
  chapterTitle: string;
  intensity: number; // 0-100
  description: string;
  characters: string[];
  type: 'tease' | 'buildup' | 'climax' | 'afterglow';
  order: number;
}

/**
 * 肉欲线完整结构
 * SRS v2.3: lust_arc.json 标准格式
 */
export interface LustArc {
  id: string;
  novelId: string;
  intensityCurve: LustIntensityPoint[];
  climaxPoints: LustClimaxPoint[];
  createdAt: number;
  updatedAt: number;
}

// ==========================================
// 辅助类型（适配旧提示词返回结构）
// ==========================================

/** 卷（长篇小说分卷） */
export interface Volume {
  id: string;
  novelId: string;
  name: string;
  summary: string;
  order: number;
  chapters: string[];
  statusColor: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * 一键推导生成结果
 * SRS v2.3 修复：新增 emotionArc / lustArc / tags / prompts
 */
export interface OneClickResult {
  title: string;
  summary: string;
  protagonist: Character;
  supporting: Character[];
  worldSetting: WorldSetting;
  plotLine: PlotLine;
  chapters: Array<{
    title: string;
    summary: string;
  }>;
  firstChapter: string;
  /** SRS v2.3 新增：感情线完整数据 */
  emotionArc: EmotionArc;
  /** SRS v2.3 新增：肉欲线完整数据 */
  lustArc: LustArc;
  /** SRS v2.3 新增：标签数据 */
  tags: Tag[];
  /** SRS v2.3 新增：Prompt 模板 */
  prompts: Array<{
    id: string;
    name: string;
    content: string;
    category: 'deduce' | 'write' | 'polish' | 'character' | 'world';
  }>;
}

/** 标签扩展结果 */
export interface TagExpansionResult {
  character: string[];
  profession: string[];
  scene: string[];
  plot: string[];
  atmosphere: string[];
  fetish: string[];
}

/** 润色结果 */
export interface PolishResult {
  original: string;
  polished: string;
  aiScore: number;
  aiWords: string[];
  level: PolishLevel;
  style: StyleType;
}

/** 应用全局状态 */
export interface AppState {
  currentProjectId: string | null;
  currentModelId: string | null;
  theme: 'light' | 'dark';
  fontSize: 'small' | 'medium' | 'large';
  accentColor: string;
  sidebarCollapsed: boolean;
  autoSave: boolean;
  autoSaveInterval: number;
  streamOutput: boolean;
  eroticMode: boolean;
}

// ==========================================
// SRS v2.3 新增：项目数据包结构
// ==========================================

/**
 * 项目数据包 manifest
 * SRS v2.3: project/manifest.json
 */
export interface ProjectManifest {
  version: string;
  projectId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  files: {
    manifest: string;
    storyOverview: string;
    world: string;
    emotionArc: string;
    lustArc: string;
    outline: string;
    characters: string;
    tags: string;
    prompts: string;
  };
}

/**
 * 大纲节点（剧情观用）
 * 兼容旧版
 */
export interface OutlineNode {
  id: string;
  title: string;
  content: string;
  order: number;
}
