/**
 * 推导结果 → 前端可视化数据 统一转换层
 *
 * mapOldResultToCurrent() 从 AI 原始文本解析为结构化 DeduceInput（调用 deduceParser 的解析函数）
 * transformDeduceToAppData() 将结构化 DeduceInput 转换为全部前端模块所需结构
 *
 * 转换目标：
 *   characters    → 自动生成 relationships → ReactFlow edges 有数据
 *   emotionEvents → 从 plotLine.events 或 chapters 生成
 *   outlineNodes  → 从 plotLine.events 或 chapters 生成
 *   chapters      → 完整 Chapter 对象
 *   worldSetting  → 结构化世界观
 *
 * 依赖关系：
 *   deduceParser.ts 负责「AI文本 → 原始JSON字段」
 *   deduceTransformer.ts 负责「原始JSON → 前端可视化数据」
 */

import type { Character, WorldSetting, PlotLine, Chapter } from '../../config/types'
import {
  parseGenerationResult,
  parseSupportingChars,
  parseWorldview,
} from './deduceParser'
import { parseMarkdownFields, cleanMarkdown, extractNameFromText } from './markdownParser'

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
 *
 * 修复4：智能配对 characterIds（主角 + 按顺序取配角）
 * 修复5：只在完全无数据时生成1个兜底事件
 */
export function buildEmotionEvents(
  events: Array<{ title: string; description?: string }>,
  chapters: Array<{ title: string; summary?: string }>,
  characters: Character[],
  adultMode?: boolean,
): EmotionEvent[] {
  const source = events.length > 0 ? events : chapters.map((ch) => ({
    title: ch.title,
    description: ch.summary || '',
  }))

  const typeCycle: EmotionEventType[] = adultMode
    ? ['emotion', 'adult', 'emotion', 'conflict', 'adult', 'climax']
    : ['emotion', 'conflict', 'emotion', 'conflict', 'climax', 'emotion']

  // 智能配对：主角 + 按顺序取配角
  const protagonist = characters.find(c => c.roleType === 'protagonist')
  const supporters = characters.filter(c => c.roleType !== 'protagonist')

  const getCharIds = (idx: number): string[] => {
    const ids: string[] = []
    if (protagonist) ids.push(protagonist.id)
    const partner = supporters[idx % supporters.length]
    if (partner) ids.push(partner.id)
    return ids.slice(0, 2)
  }

  const emotionEvents: EmotionEvent[] = source.slice(0, Math.min(source.length, 8)).map((e, idx) => ({
    id: genId(),
    title: e.title || `事件 ${idx + 1}`,
    description: e.description || '',
    type: typeCycle[idx % typeCycle.length],
    characterIds: getCharIds(idx),
    order: idx,
  }))

  // 修复5：只在完全无数据时补1个兜底事件
  if (emotionEvents.length === 0) {
    emotionEvents.push({
      id: genId(),
      title: '主要感情发展',
      description: '待补充...',
      type: 'emotion',
      characterIds: getCharIds(0),
      order: 0,
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
      ? chapters.map((ch) => ({ title: ch.title, description: ch.summary || '' }))
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
  return defaultActs.map((act, idx) => ({
    id: genId(),
    title: act.title,
    content: act.content,
    order: idx,
  }))
}

// ==================== 旧结果映射：AI文本 → DeduceInput ====================

/**
 * 将 AI 原始返回文本映射为当前版本的 DeduceInput
 *
 * 修复的 Bug：
 * 1. 主角解析：旧代码只取 KV 行内格式，现在使用 parseProtagonist() 支持 **姓名** 加粗格式 + KV 格式双模式
 * 2. 配角解析：旧代码 parseSupporting 只按 "数字." 分割，现在调用 parseSupportingChars() 支持 **名字** 加粗格式 + 多种分隔
 * 3. 世界观创建：旧代码 parseWorldSetting 只用 extractField 单行提取，现在调用 parseWorldview() 两遍扫描提取多行规则/地点/时间线
 *
 * @param raw AI 返回的原始文本
 * @returns 结构化的 DeduceInput，可直接传给 transformDeduceToAppData()
 */
export function mapOldResultToCurrent(raw: string): DeduceInput {
  // 1. 两遍扫描法提取各字段文本
  const fields = parseGenerationResult(raw)

  // 2. 标题
  const title = fields.title || '未命名小说'

  // 3. 简介
  const summary = fields.synopsis || ''

  // ── 4. 主角（结构化解析：使用 parseMarkdownFields 提取字段）──
  const now = Date.now()
  const protagonist = parseProtagonist(fields.protagonist, now)

  // ── 5. 配角（结构化解析：合并男/女/通用配角后统一解析）──
  const allSupportingText = [
    fields.maleSupportingChars,
    fields.femaleSupportingChars,
    fields.supportingChars,
  ].filter(Boolean).join('\n\n')
  const supporting = parseSupportingChars(allSupportingText, now)

  // ── 6. 世界观（修复：使用 parseWorldview 替代旧 parseWorldSetting）──
  const worldSetting = buildWorldSettingFromParser(fields.worldview)

  // 7. 章节
  const chapters = parseChapterListFromParser(fields.chapterList)

  // 8. 剧情线
  const plotLine = buildPlotLineFromParser(fields.emotionalLine, fields.chapterOutline, chapters)

  // 9. 第一章
  const firstChapter = fields.firstChapter || ''

  return {
    title,
    summary,
    protagonist,
    supporting,
    worldSetting,
    plotLine,
    chapters,
    firstChapter,
  }
}

// ==================== mapOldResultToCurrent 内部构建函数 ====================

/** 主角信息结构化解析：使用 markdownParser 提取结构化字段 */
function parseProtagonist(text: string, now: number): Character {
  const fields = parseMarkdownFields(text);

  // 提取姓名
  const name = extractNameFromText(text) || '主角';

  // 提取性别
  let gender = '';
  const genderText = fields['性别'] || '';
  if (genderText.includes('男')) gender = '男';
  else if (genderText.includes('女')) gender = '女';

  // 提取年龄
  let age = '';
  const ageMatch = (fields['年龄'] || text).match(/(\d{1,3})\s*岁/);
  if (ageMatch) age = ageMatch[1] + '岁';

  // 提取外貌
  const appearance = cleanMarkdown(
    fields['外貌'] || fields['外貌特征'] || fields['形象'] || ''
  );

  // 提取性格（按逗号/顿号拆分）
  const personalityText = cleanMarkdown(
    fields['性格'] || fields['性格特点'] || fields['性格核心'] || ''
  );
  const personality = personalityText
    .split(/[,，、;；]/)
    .map(s => s.trim())
    .filter(s => s.length >= 2 && s.length <= 20);

  // 提取背景
  const background = cleanMarkdown(
    fields['背景'] || fields['背景经历'] || fields['身世'] || ''
  );

  // 提取能力/特长
  const abilities = cleanMarkdown(
    fields['能力'] || fields['特长'] || fields['技能'] || ''
  );

  return {
    id: `prot_${now}`,
    name,
    roleType: 'protagonist',
    avatar: '',
    basicInfo: { age, gender, occupation: '' },
    appearance,
    personality,
    background,
    abilities,
    relationships: [],
    voice: '',
    innerWorld: '',
    arc: '',
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** 使用 parseWorldview 构建世界观数据 */
function buildWorldSettingFromParser(text: string): WorldSetting {
  const parsed = parseWorldview(text)
  return {
    id: genId(),
    name: '世界观设定',
    worldType: 'custom',
    description: parsed.overview.slice(0, 200),
    overview: parsed.overview,
    rules: parsed.rules,
    locations: parsed.locations,
    timeline: parsed.timeline,
    society: parsed.society,
    culture: parsed.culture,
    economy: parsed.economy,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

/** 解析章节目录文本 */
function parseChapterListFromParser(text: string): Array<{ title: string; summary: string }> {
  if (!text.trim()) return [{ title: '第一章', summary: '开篇' }]

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const result: Array<{ title: string; summary: string }> = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = line.match(/(?:第\s*(\d+)\s*章|第\s*[一二三四五六七八九十]+\s*章|(\d+)[\.\、\)])\s*[:：]?\s*(.+)/)
    if (m) {
      const title = m[3].trim()
      let summary = ''
      if (i + 1 < lines.length) {
        const next = lines[i + 1]
        if (!next.match(/(?:第\s*\d+\s*章|第\s*[一二三四五六七八九十]+\s*章|\d+[\.\、\)])\s*[:：]?/)) {
          summary = next
        }
      }
      result.push({ title, summary })
    }
  }

  return result.length ? result : [{ title: '第一章', summary: '开篇' }]
}

/** 从情感线+大纲构建 PlotLine */
function buildPlotLineFromParser(
  emotionalText: string,
  outlineText: string,
  chapters: Array<{ title: string; summary: string }>,
): PlotLine {
  const events = chapters.map((ch, idx) => ({
    id: genId(),
    title: ch.title,
    description: ch.summary,
    order: idx,
    chapterId: null as string | null,
  }))

  return {
    id: genId(),
    type: 'main',
    name: '主线剧情',
    description: (emotionalText || outlineText || '').slice(0, 1000),
    events,
    relatedCharacters: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

// ==================== 总转换函数 ====================

export interface DeduceInput {
  title: string
  summary: string
  firstChapter?: string
  chapters: Array<{ title: string; summary: string }>
  supporting: Character[]
  protagonist: Character
  worldSetting: WorldSetting
  plotLine: PlotLine
}

export interface AppData {
  characters: Character[]
  chapters: Chapter[]
  worldSetting: WorldSetting
  emotionEvents: EmotionEvent[]
  outlineNodes: OutlineNode[]
  plotLine: PlotLine
  charIds: string[]
}

/**
 * 统一转换：将 mapOldResultToCurrent 的输出转换为前端全部模块所需结构
 *
 * 输入：mapOldResultToCurrent() 输出的 DeduceInput
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
  const fixRoleType = (c: Character, defaultRole: Character['roleType']): Character => ({
    ...c,
    roleType: (['protagonist', 'supporting', 'antagonist', 'minor'].includes(c.roleType) ? c.roleType : defaultRole) as Character['roleType'],
  })

  const rawChars: Character[] = [
    fixRoleType(safe.protagonist, 'protagonist'),
    ...safe.supporting.map((c, index) => {
      const roleType = c.roleType || (index === 0 ? 'supporting' : index === 1 ? 'antagonist' : 'minor')
      return fixRoleType({ ...c, roleType: roleType as Character['roleType'] }, roleType as Character['roleType'])
    }),
  ]

  // 3. 生成关系（核心修复：为所有角色填充 relationships）
  const characters = buildRelationships(rawChars)
  const charIds = characters.map(c => c.id)

  // 4. 生成完整章节对象
  const firstChapterFinal = firstChapterContent || safe.firstChapter
  const chapters: Chapter[] = safe.chapters.map((ch, index) => {
    const content = index === 0 && firstChapterFinal ? firstChapterFinal : ''
    return {
      id: genId(),
      title: ch.title,
      summary: ch.summary || '',
      content,
      order: index,
      status: (index === 0 && content ? 'completed' : 'draft') as Chapter['status'],
      volumeId: null,
      wordCount: content ? content.length : 0,
      mood: '',
      characters: charIds,
      hooks: '',
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
  })

  // 5. 构建感情线事件
  const plotEvents: Array<{ title: string; description: string }> =
    (safe.plotLine.events || []).map((e) => ({
      title: e.title || '',
      description: e.description || '',
    }))
  const emotionEvents = buildEmotionEvents(plotEvents, safe.chapters, characters, adultMode)

  // 6. 构建剧情大纲
  const outlineNodes = buildOutline(plotEvents, safe.chapters)

  // 7. 保证 plotLine.events 非空（供前端事件计数等使用）
  const finalPlotLine: PlotLine = {
    ...safe.plotLine,
    events: safe.plotLine.events?.length > 0
      ? safe.plotLine.events
      : safe.chapters.map((ch, idx) => ({
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
