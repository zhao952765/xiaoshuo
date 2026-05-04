/**
 * ==========================================
 * 全局类型定义 - Private Novel Studio Pro
 * 零 any，全部类型安全
 * ==========================================
 */

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

// ==========================================
// 核心数据模型（10个主接口）
// ==========================================

/**
 * 1. 小说项目
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
  createdAt: number;
  updatedAt: number;
  emotionEvents?: Array<{
    id: string;
    title: string;
    description: string;
    type: 'emotion' | 'adult';
    characterIds: string[];
    order: number;
  }>;
  outlineNodes?: Array<{
    id: string;
    title: string;
    content: string;
    order: number;
  }>;
}

/**
 * 2. 角色
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
    metadata?: Record<string, string | number | boolean>;
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
  data?: Record<string, string | number | boolean>;
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

/** 一键推导生成结果 */
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
