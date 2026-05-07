/**
 * 一键推导页面 — UI 常量配置
 *
 * 从 deduce/index.tsx 中抽离的内联常量
 * 供组件和工具函数共享使用
 */

import type { NovelLength } from '@cfg/types'

// ==================== 长度选项卡片 ====================

export interface LengthOption {
  value: NovelLength
  label: string
  description: string
  chapterCount: string
  icon: string
  color: string
}

/** 5 档长度选择卡片配置 */
export const LENGTH_OPTIONS: LengthOption[] = [
  {
    value: '3000',
    label: '3千字',
    description: '短篇故事',
    chapterCount: '5-8章',
    icon: '📄',
    color: '#10b981',
  },
  {
    value: '30000',
    label: '3万字',
    description: '中篇小说',
    chapterCount: '15-25章',
    icon: '📖',
    color: '#6366f1',
  },
  {
    value: '100000',
    label: '10万字',
    description: '长篇小说',
    chapterCount: '30-50章',
    icon: '📚',
    color: '#a855f7',
  },
  {
    value: '500000',
    label: '50万字',
    description: '超长篇',
    chapterCount: '80-120章',
    icon: '🏛️',
    color: '#f59e0b',
  },
  {
    value: '1000000',
    label: '100万字',
    description: '史诗巨著',
    chapterCount: '150-300章',
    icon: '🌟',
    color: '#ef4444',
  },
]

// ==================== 字数映射 ====================

/** 长度值 → 显示标签 */
export const LENGTH_LABEL_MAP: Record<NovelLength, string> = {
  '3000': '3,000字',
  '30000': '3万字',
  '100000': '10万字',
  '500000': '50万字',
  '1000000': '100万字',
}

/** 长度值 → 章节数范围 */
export const CHAPTER_COUNT_MAP: Record<NovelLength, string> = {
  '3000': '5-8章',
  '30000': '15-25章',
  '100000': '30-50章',
  '500000': '80-120章',
  '1000000': '150-300章',
}

/** 长度值 → 目标字数（数值） */
export const TARGET_WORDS_MAP: Record<NovelLength, number> = {
  '3000': 3000,
  '30000': 30000,
  '100000': 100000,
  '500000': 500000,
  '1000000': 1000000,
}

// ==================== 主题模板 ====================

export interface ThemeTemplate {
  id: string
  name: string
  theme: string
  icon: string
  color: string
  description: string
  defaultMale: number
  defaultFemale: number
  defaultLength: NovelLength
}

/** 6 个预设主题模板 */
export const THEME_TEMPLATES: ThemeTemplate[] = [
  {
    id: 'urban-romance',
    name: '都市言情',
    theme: '都市办公室恋情，霸道总裁与职场新人的甜蜜纠葛',
    icon: '🏙️',
    color: '#ec4899',
    description: '都市背景，情感为主',
    defaultMale: 1,
    defaultFemale: 2,
    defaultLength: '30000',
  },
  {
    id: 'xuanhuan',
    name: '玄幻修仙',
    theme: '玄幻修仙世界，废柴逆袭成为至强者的热血之路',
    icon: '⚔️',
    color: '#8b5cf6',
    description: '升级打怪，热血逆袭',
    defaultMale: 2,
    defaultFemale: 1,
    defaultLength: '100000',
  },
  {
    id: 'suspense',
    name: '悬疑推理',
    theme: '悬疑推理，连环凶案背后的惊天阴谋与人性暗面',
    icon: '🔍',
    color: '#6366f1',
    description: '烧脑推理，层层反转',
    defaultMale: 1,
    defaultFemale: 1,
    defaultLength: '30000',
  },
  {
    id: 'apocalypse',
    name: '末世求生',
    theme: '末世废土求生，异变降临后的生存挣扎与人性考验',
    icon: '☢️',
    color: '#f59e0b',
    description: '末世生存，人性考验',
    defaultMale: 2,
    defaultFemale: 2,
    defaultLength: '100000',
  },
  {
    id: 'campus',
    name: '校园青春',
    theme: '校园青春恋爱，学霸与转学生的清新纯爱故事',
    icon: '🎓',
    color: '#10b981',
    description: '校园日常，清新纯爱',
    defaultMale: 1,
    defaultFemale: 2,
    defaultLength: '30000',
  },
  {
    id: 'isekai',
    name: '穿越异世界',
    theme: '穿越到异世界，带着现代知识开创传奇帝国的冒险之旅',
    icon: '🌀',
    color: '#ef4444',
    description: '异世界，知识碾压',
    defaultMale: 1,
    defaultFemale: 3,
    defaultLength: '100000',
  },
]

// ==================== 结果字段定义 ====================

export interface ResultFieldConfig {
  key: string
  label: string
  icon: string
  color: string
  bgColor: string
  description: string
}

/** 10 个结果字段的图标/颜色/标签定义 */
export const RESULT_FIELDS: ResultFieldConfig[] = [
  {
    key: 'title',
    label: '小说标题',
    icon: '📋',
    color: '#6366f1',
    bgColor: 'rgba(99,102,241,0.1)',
    description: 'AI 生成的小说标题',
  },
  {
    key: 'summary',
    label: '故事简介',
    icon: '📝',
    color: '#10b981',
    bgColor: 'rgba(16,185,129,0.1)',
    description: '故事核心梗概',
  },
  {
    key: 'protagonist',
    label: '主角设定',
    icon: '🦸',
    color: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.1)',
    description: '主角姓名、外貌、性格、背景',
  },
  {
    key: 'supporting',
    label: '配角设定',
    icon: '👥',
    color: '#a855f7',
    bgColor: 'rgba(168,85,247,0.1)',
    description: '男配角、女配角详细设定',
  },
  {
    key: 'worldview',
    label: '世界观',
    icon: '🌍',
    color: '#06b6d4',
    bgColor: 'rgba(6,182,212,0.1)',
    description: '世界背景、规则、地理',
  },
  {
    key: 'emotionalLine',
    label: '感情/冲突线',
    icon: '💕',
    color: '#ec4899',
    bgColor: 'rgba(236,72,153,0.1)',
    description: '感情发展与冲突脉络',
  },
  {
    key: 'chapterOutline',
    label: '剧情大纲',
    icon: '🗺️',
    color: '#8b5cf6',
    bgColor: 'rgba(139,92,246,0.1)',
    description: '整体剧情走向规划',
  },
  {
    key: 'chapterList',
    label: '章节目录',
    icon: '📑',
    color: '#3b82f6',
    bgColor: 'rgba(59,130,246,0.1)',
    description: '各章节标题与摘要',
  },
  {
    key: 'firstChapter',
    label: '第一章正文',
    icon: '✍️',
    color: '#ef4444',
    bgColor: 'rgba(239,68,68,0.1)',
    description: 'AI 撰写的第一章内容',
  },
  {
    key: 'meta',
    label: '统计信息',
    icon: '📊',
    color: '#64748b',
    bgColor: 'rgba(100,116,139,0.1)',
    description: '角色数、章节数等统计',
  },
]

// ==================== 进度阶段配置 ====================

export interface ProgressPhase {
  minChars: number
  percent: number
  label: string
}

/** 进度阶段：根据已接收字数判断当前阶段 */
export const PROGRESS_PHASES: ProgressPhase[] = [
  { minChars: 0,    percent: 10, label: '正在连接 AI 模型并构思框架...' },
  { minChars: 300,  percent: 30, label: '正在生成主角与配角设定...' },
  { minChars: 1200, percent: 50, label: '正在构建世界观与背景规则...' },
  { minChars: 2500, percent: 65, label: '正在设计冲突线与感情脉络...' },
  { minChars: 4500, percent: 80, label: '正在规划章节目录...' },
  { minChars: 7000, percent: 92, label: '正在撰写第一章正文...' },
]

/**
 * 根据已接收字数获取当前进度阶段
 */
export function getProgressPhase(textLength: number): { percent: number; label: string } {
  let phase = PROGRESS_PHASES[0]
  for (const p of PROGRESS_PHASES) {
    if (textLength >= p.minChars) phase = p
    else break
  }
  return { percent: phase.percent, label: phase.label }
}

// ==================== 功能说明卡片 ====================

export interface FeatureCard {
  icon: string
  title: string
  description: string
  color: string
}

/** 功能说明卡片配置 */
export const FEATURE_CARDS: FeatureCard[] = [
  {
    icon: '📝',
    title: '智能解析',
    description: '自动提取标题、角色、世界观、冲突线、感情线、肉欲线、章节目录',
    color: '#6366f1',
  },
  {
    icon: '🗂️',
    title: '自动归档',
    description: '推导结果自动存入全局项目，无需手动复制粘贴',
    color: '#10b981',
  },
  {
    icon: '🚀',
    title: '一键跳转',
    description: '完成后自动进入剧情观可视化页面展示完整结构',
    color: '#a855f7',
  },
]
