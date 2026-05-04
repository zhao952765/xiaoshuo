/**
 * 推导结果 → 前端可视化数据 统一转换层
 *
 * parseDeduceResult() 从 AI 文本提取原始 JSON
 * transformDeduceToAppData() 将原始 JSON 转换为全部前端模块所需结构
 *
 * 转换目标：
 *   characters    → 自动生成 relationships → ReactFlow edges 有数据
 *   emotionEvents → 从 plotLine.events 或 chapters 生成
 *   outlineNodes  → 从 plotLine.events 或 chapters 生成
 *   chapters      → 完整 Chapter 对象
 *   worldSetting  → 结构化世界观
 */

import type { Character } from '../../config/types'

// ==================== ID 生成 ====================
const genId = (): string => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

// ==================== 关系生成 ====================
/**
 * 自动为角色列表生成关系（主角↔每个配角/反派）
 * 返回填充了 relationships 的完整角色数组
 */
export function buildRelationships(chars: Character[]): Character[] {
  if (chars.length < 2) return chars

  const protagonist = chars.find(c => c.roleType === 'protagonist')
  if (!protagonist) return chars

  const others = chars.filter(c => c.id !== protagonist.id)

  // 对每个非主角角色生成关系
  const charMap = new Map<string, Character>()
  chars.forEach(c => charMap.set(c.id, { ...c, relationships: [] }))

  const prot = charMap.get(protagonist.id)!

  for (const other of others) {
    const isAntagonist = other.roleType === 'antagonist'
    const relType = isAntagonist ? '对立' : '相识'
    const relDesc = isAntagonist ? '故事中的对立势力' : '与主角有交集的人物'

    // 主角 → 对方
    prot.relationships.push({
      targetId: other.id,
      targetName: other.name,
      type: relType,
      description: relDesc,
    })

    // 对方 → 主角
    const o = charMap.get(other.id)!
    o.relationships.push({
      targetId: protagonist.id,
      targetName: protagonist.name,
      type: isAntagonist ? '对立' : '相识',
      description: isAntagonist ? '故事中的对立势力' : '与主角有交集的人物',
    })

    // 配角之间也生成关系（同类型之间 "同伴"，不同类型 "相识"）
    for (const other2 of others) {
      if (other2.id === other.id) continue
      const o2 = charMap.get(other2.id)!
      const sameRole = other.roleType === other2.roleType
      const relBt = sameRole ? '同伴' : '相识'
      // 避免重复添加
      if (!o.relationships.some(r => r.targetId === other2.id)) {
        o.relationships.push({
          targetId: other2.id,
          targetName: other2.name,
          type: relBt,
          description: '',
        })
      }
      if (!o2.relationships.some(r => r.targetId === other.id)) {
        o2.relationships.push({
          targetId: other.id,
          targetName: other.name,
          type: relBt,
          description: '',
        })
      }
    }
  }

  return Array.from(charMap.values())
}

// ==================== 感情线事件生成 ====================
export type EmotionEventType = 'emotion' | 'conflict' | 'climax' | 'adult'

export interface EmotionEvent {
  id: string
  title: string
  description: string
  type: EmotionEventType
  characterIds: string[]
  order: number
}

/**
 * 从剧情线事件生成感情线时间线
 * type 按轮次循环：emotion → conflict → climax → emotion → ...
 * 无 events 时从章节标题生成
 */
export function buildEmotionEvents(
  events: Array<{ title: string; description?: string }>,
  chapters: Array<{ title: string; summary?: string }>,
  charIds: string[],
  adultMode?: boolean,
): EmotionEvent[] {
  const source = events.length > 0 ? events : chapters.map((ch, i) => ({
    title: ch.title,
    description: ch.summary || '',
  }))

  const typeCycle: EmotionEventType[] = adultMode
    ? ['emotion', 'adult', 'emotion', 'conflict', 'adult', 'climax']
    : ['emotion', 'conflict', 'emotion', 'conflict', 'climax', 'emotion']

  const emotionEvents: EmotionEvent[] = source.slice(0, Math.min(source.length, 8)).map((e, idx) => ({
    id: genId(),
    title: e.title || `事件 ${idx + 1}`,
    description: e.description || '',
    type: typeCycle[idx % typeCycle.length],
    characterIds: charIds.slice(0, 2),
    order: idx,
  }))

  // 至少生成 3 个
  while (emotionEvents.length < 3) {
    const idx = emotionEvents.length
    emotionEvents.push({
      id: genId(),
      title: `感情发展 ${idx + 1}`,
      description: '待补充事件描述...',
      type: typeCycle[idx % typeCycle.length],
      characterIds: charIds.slice(0, 2),
      order: idx,
    })
  }

  return emotionEvents
}

// ==================== 剧情大纲生成 ====================
export interface OutlineNode {
  id: string
  title: string
  content: string
  order: number
}

/**
 * 从 events 或 chapters 生成剧情大纲节点
 * 优先使用 plotLine.events，退回到 chapters，最后使用默认 4 幕结构
 */
export function buildOutline(
  events: Array<{ title: string; description?: string }>,
  chapters: Array<{ title: string; summary?: string }>,
  maxNodes?: number,
): OutlineNode[] {
  const limit = maxNodes || 12
  const source = events.length > 0
    ? events
    : chapters.length > 0
      ? chapters.map((ch, i) => ({ title: ch.title, description: ch.summary || '' }))
      : []

  if (source.length > 0) {
    return source.slice(0, limit).map((e, idx) => ({
      id: genId(),
      title: e.title || `剧情节点 ${idx + 1}`,
      content: e.description || '',
      order: idx,
    }))
  }

  // 完全无数据时的默认 4 幕结构
  const defaultActs = [
    { title: '第一幕 开端', content: '故事背景介绍，主角登场，铺垫核心冲突' },
    { title: '第二幕 发展', content: '冲突升级，矛盾激化，关键角色悉数登场' },
    { title: '第三幕 高潮', content: '最终对决，真相揭晓，情感爆发点' },
    { title: '第四幕 结局', content: '尘埃落定，角色命运收束，留下余韵' },
  ]
  return defaultActs.map((act, i) => ({
    id: genId(),
    title: act.title,
    content: act.content,
    order: i,
  }))
}

// ==================== 总转换函数 ====================

export interface DeduceInput {
  title: string
  summary: string
  firstChapter?: string
  chapters: Array<{ title: string; summary: string }>
  supporting: any[]
  protagonist: any
  worldSetting: any
  plotLine: any
}

export interface AppData {
  characters: Character[]
  chapters: Array<{
    id: string
    title: string
    summary: string
    content: string
    order: number
    status: 'draft' | 'completed' | 'polished'
    volumeId: string | null
    wordCount: number
    characters: string[]
    createdAt: number
    updatedAt: number
    [key: string]: any
  }>
  worldSetting: any
  emotionEvents: EmotionEvent[]
  outlineNodes: OutlineNode[]
  plotLine: any
  charIds: string[]
}

/**
 * 统一转换：将 parseDeduceResult 的原始 JSON 转换为前端全部模块所需结构
 *
 * 输入：parseDeduceResult() 输出
 * 输出：可直接注入 store 的完整数据结构（characters 已含 relationships）
 */
export function transformDeduceToAppData(
  input: DeduceInput,
  options?: { firstChapterContent?: string; adultMode?: boolean },
): AppData {
  const { firstChapterContent, adultMode } = options || {}

  // 1. 安全降级原始数据
  const safe = {
    title: input.title || '未命名项目',
    summary: input.summary || '',
    protagonist: input.protagonist || { id: genId(), name: '主角', roleType: 'protagonist', avatar: '', basicInfo: { age: '', gender: '', occupation: '' }, appearance: '', personality: [], background: '', abilities: '', relationships: [], voice: '', innerWorld: '', arc: '', tags: [], createdAt: Date.now(), updatedAt: Date.now() },
    supporting: input.supporting || [],
    worldSetting: input.worldSetting || { id: genId(), name: '默认世界观', worldType: 'custom', description: '', overview: '', rules: [], locations: [], timeline: [], society: '', culture: '', economy: '', createdAt: Date.now(), updatedAt: Date.now() },
    plotLine: input.plotLine || { id: genId(), type: 'main', name: '主线', description: '', events: [], relatedCharacters: [], createdAt: Date.now(), updatedAt: Date.now() },
    chapters: input.chapters?.length > 0 ? input.chapters : [],
    firstChapter: input.firstChapter || '',
  }

  // 确保有至少 5 章
  if (safe.chapters.length === 0) {
    safe.chapters = [
      { title: '第一章 开端', summary: '故事开始...' },
      { title: '第二章 发展', summary: '冲突升级...' },
      { title: '第三章 转折', summary: '意外发现...' },
      { title: '第四章 高潮', summary: '最终对决...' },
      { title: '第五章 结局', summary: '尘埃落定...' },
    ]
  }

  // 2. 构建角色列表 + 分配 roleType
  const fixRoleType = (c: any, defaultRole: string) => ({
    ...c,
    roleType: (['protagonist', 'supporting', 'antagonist', 'minor'].includes(c.roleType) ? c.roleType : defaultRole),
  })

  const rawChars: Character[] = [
    fixRoleType(safe.protagonist, 'protagonist'),
    ...safe.supporting.map((c: any, index: number) => {
      const roleType = c.roleType || (index === 0 ? 'supporting' : index === 1 ? 'antagonist' : 'minor')
      return fixRoleType({ ...c, roleType }, roleType)
    }),
  ]

  // 3. 生成关系（核心修复：为所有角色填充 relationships）
  const characters = buildRelationships(rawChars)
  const charIds = characters.map(c => c.id)

  // 4. 生成完整章节对象
  const chapters = safe.chapters.map((ch: any, index: number) => ({
    id: genId(),
    title: ch.title,
    summary: ch.summary || '',
    content: index === 0 && (firstChapterContent || safe.firstChapter) ? (firstChapterContent || safe.firstChapter) : '',
    order: index,
    status: 'draft' as const,
    volumeId: null,
    wordCount: 0,
    mood: '',
    characters: charIds,
    hooks: '',
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }))

  // 5. 构建感情线事件
  const plotEvents: Array<{ title: string; description: string }> =
    (safe.plotLine.events || []).map((e: any) => ({
      title: e.title || '',
      description: e.description || e.summary || '',
    }))
  const emotionEvents = buildEmotionEvents(plotEvents, safe.chapters, charIds, adultMode)

  // 6. 构建剧情大纲
  const outlineNodes = buildOutline(plotEvents, safe.chapters)

  // 7. 保证 plotLine.events 非空（供前端事件计数等使用）
  const finalPlotLine = {
    ...safe.plotLine,
    events: safe.plotLine.events?.length > 0
      ? safe.plotLine.events
      : safe.chapters.map((ch: any, idx: number) => ({
          id: genId(),
          title: ch.title,
          description: ch.summary || '',
          order: idx,
          chapterId: null,
        })),
  }

  return {
    characters,
    chapters,
    worldSetting: safe.worldSetting,
    emotionEvents,
    outlineNodes,
    plotLine: finalPlotLine,
    charIds,
  }
}
