/**
 * 推导结果 → 前端可视化数据 统一转换层
 * SRS v2.3 统一整合版
 *
 * 转换目标：
 * characters → 自动生成 relationships → ReactFlow edges 有数据
 * emotionArc → { nodes: EmotionArcNode[], edges: EmotionArcEdge[], timeline: EmotionArcEvent[] }
 * lustArc → { intensityCurve: LustIntensityPoint[], climaxPoints: LustClimaxPoint[] }
 * chapters → 完整 Chapter 对象
 * worldSetting → 结构化世界观
 * outlineNodes → 剧情大纲节点
 * tags → 自动标签
 * prompts → Prompt 模板
 *
 * 依赖关系：
 * deduceParser.ts 负责「AI文本 → 原始JSON字段」
 * deduceTransformer.ts 负责「原始JSON → 前端可视化数据」
 */

import type {
  Character,
  WorldSetting,
  PlotLine,
  Chapter,
  EmotionArc,
  EmotionArcNode,
  EmotionArcEdge,
  EmotionArcEvent,
  EmotionEventType,
  LustArc,
  LustIntensityPoint,
  LustClimaxPoint,
  Tag,
  OutlineNode,
} from '../../config/types'
import {
  parseGenerationResult,
  parseSupportingChars,
  parseWorldview,
} from './deduceParser'
import { parseProtagonistFields, cleanMarkdown, extractNameFromText } from './markdownParser'

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

  const charMap = new Map<string, Character>()
  chars.forEach(c => charMap.set(c.id, { ...c, relationships: [] }))

  const prot = charMap.get(protagonist.id)!

  for (const other of others) {
    const isAntagonist = other.roleType === 'antagonist'
    const relType = isAntagonist ? '对立' : '相识'
    const relDesc = isAntagonist ? '故事中的对立势力' : '与主角有交集的人物'

    prot.relationships.push({
      targetId: other.id,
      targetName: other.name,
      type: relType,
      description: relDesc,
    })

    const o = charMap.get(other.id)!
    o.relationships.push({
      targetId: protagonist.id,
      targetName: protagonist.name,
      type: isAntagonist ? '对立' : '相识',
      description: isAntagonist ? '故事中的对立势力' : '与主角有交集的人物',
    })

    for (const other2 of others) {
      if (other2.id === other.id) continue
      const o2 = charMap.get(other2.id)!
      const sameRole = other.roleType === other2.roleType
      const relBt = sameRole ? '同伴' : '相识'
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

// ==================== SRS v2.3 新增：感情线 React Flow 生成 ====================

const EMOTION_TYPE_COLORS: Record<EmotionEventType, string> = {
  emotion: '#ec4899', // pink-500
  conflict: '#f59e0b', // amber-500
  climax: '#ef4444', // red-500
  adult: '#a855f7', // purple-500
}

const EMOTION_TYPE_LABELS: Record<EmotionEventType, string> = {
  emotion: '感情',
  conflict: '冲突',
  climax: '高潮',
  adult: '肉欲',
}

/**
 * SRS v2.3: 生成感情线完整结构 { nodes, edges, timeline }
 * 从剧情线事件或章节生成，支持 React Flow 可视化
 */
export function buildEmotionArc(
  events: Array<{ title: string; description?: string }>,
  chapters: Array<{ title: string; summary?: string }>,
  characters: Character[],
  novelId: string,
  adultMode?: boolean,
): EmotionArc {
  const source = events.length > 0
    ? events
    : chapters.map((ch) => ({ title: ch.title, description: ch.summary || '' }))

  const typeCycle: EmotionEventType[] = adultMode
    ? ['emotion', 'adult', 'emotion', 'conflict', 'adult', 'climax']
    : ['emotion', 'conflict', 'emotion', 'conflict', 'climax', 'emotion']

  const protagonist = characters.find(c => c.roleType === 'protagonist')
  const supporters = characters.filter(c => c.roleType !== 'protagonist')

  const getCharIds = (idx: number): string[] => {
    const ids: string[] = []
    if (protagonist) ids.push(protagonist.id)
    const partner = supporters[idx % supporters.length]
    if (partner) ids.push(partner.id)
    return ids.slice(0, 2)
  }

  const limitedSource = source.slice(0, Math.min(source.length, 12))
  const nodes: EmotionArcNode[] = []
  const timeline: EmotionArcEvent[] = []
  const edges: EmotionArcEdge[] = []

  limitedSource.forEach((e, idx) => {
    const type = typeCycle[idx % typeCycle.length]
    const charIds = getCharIds(idx)
    const nodeId = genId()
    const intensity = type === 'climax' ? 90 : type === 'adult' ? 85 : type === 'conflict' ? 70 : 50

    // React Flow 节点：水平排列，每个节点间隔 200px
    nodes.push({
      id: nodeId,
      type,
      position: { x: idx * 220, y: type === 'climax' ? 0 : type === 'adult' ? 40 : type === 'conflict' ? -30 : 20 },
      data: {
        label: e.title || `事件 ${idx + 1}`,
        description: e.description || '',
        intensity,
        characterIds: charIds,
        chapterId: null,
        color: EMOTION_TYPE_COLORS[type],
      },
    })

    timeline.push({
      id: genId(),
      title: e.title || `事件 ${idx + 1}`,
      description: e.description || '',
      type,
      characterIds: charIds,
      order: idx,
      intensity,
      nodeId,
    })

    // 生成边：连接相邻节点
    if (idx > 0) {
      const prevNodeId = nodes[idx - 1].id
      edges.push({
        id: `e-${prevNodeId}-${nodeId}`,
        source: prevNodeId,
        target: nodeId,
        type: 'smoothstep',
        label: '',
        animated: type === 'climax' || type === 'adult',
        style: {
          stroke: EMOTION_TYPE_COLORS[type],
          strokeWidth: type === 'climax' ? 3 : 2,
        },
      })
    }
  })

  // 兜底：完全无数据时生成1个默认节点
  if (nodes.length === 0) {
    const nodeId = genId()
    nodes.push({
      id: nodeId,
      type: 'emotion',
      position: { x: 0, y: 0 },
      data: {
        label: '主要感情发展',
        description: '待补充...',
        intensity: 50,
        characterIds: getCharIds(0),
        chapterId: null,
        color: EMOTION_TYPE_COLORS.emotion,
      },
    })
    timeline.push({
      id: genId(),
      title: '主要感情发展',
      description: '待补充...',
      type: 'emotion',
      characterIds: getCharIds(0),
      order: 0,
      intensity: 50,
      nodeId,
    })
  }

  return {
    id: genId(),
    novelId,
    nodes,
    edges,
    timeline,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

// ==================== SRS v2.3 新增：肉欲线生成 ====================

const SCENE_TYPE_CYCLE = ['暧昧', '接触', '挑逗', '亲密', '高潮', '余韵']
const CLIMAX_TYPE_CYCLE: LustClimaxPoint['type'][] = ['tease', 'buildup', 'climax', 'afterglow']

/**
 * SRS v2.3: 生成肉欲线完整结构 { intensityCurve, climaxPoints }
 * 从章节和 adultMode 标志生成强度曲线与高潮点
 */
export function buildLustArc(
  chapters: Array<{ title: string; summary?: string }>,
  characters: Character[],
  novelId: string,
  adultMode?: boolean,
): LustArc {
  if (!adultMode || chapters.length === 0) {
    return {
      id: genId(),
      novelId,
      intensityCurve: [],
      climaxPoints: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
  }

  const protagonist = characters.find(c => c.roleType === 'protagonist')
  const supporters = characters.filter(c => c.roleType !== 'protagonist')
  const getCharIds = (idx: number): string[] => {
    const ids: string[] = []
    if (protagonist) ids.push(protagonist.id)
    const partner = supporters[idx % supporters.length]
    if (partner) ids.push(partner.id)
    return ids.slice(0, 2)
  }

  // 强度曲线：按章节分布，模拟起伏
  const intensityCurve: LustIntensityPoint[] = chapters.map((ch, idx) => {
    const progress = idx / Math.max(chapters.length - 1, 1)
    // 使用正弦波 + 随机扰动模拟自然起伏
    const baseValue = Math.sin(progress * Math.PI * 2) * 30 + 50
    const randomOffset = Math.sin(idx * 1.7) * 15
    const sceneBoost = idx % 3 === 0 ? 20 : 0 // 每第3章一个小高峰
    const value = Math.min(100, Math.max(0, Math.round(baseValue + randomOffset + sceneBoost)))

    return {
      id: genId(),
      chapterId: null,
      chapterTitle: ch.title,
      value,
      description: ch.summary || '',
      characters: getCharIds(idx),
      sceneType: SCENE_TYPE_CYCLE[idx % SCENE_TYPE_CYCLE.length],
      order: idx,
    }
  })

  // 高潮点：识别强度 > 75 的章节作为高潮点
  const climaxPoints: LustClimaxPoint[] = intensityCurve
    .filter(pt => pt.value > 75)
    .map((pt, idx) => ({
      id: genId(),
      chapterId: pt.chapterId,
      chapterTitle: pt.chapterTitle,
      intensity: pt.value,
      description: pt.description,
      characters: pt.characters,
      type: CLIMAX_TYPE_CYCLE[idx % CLIMAX_TYPE_CYCLE.length],
      order: pt.order,
    }))

  // 如果没有高潮点，在最高强度处生成一个
  if (climaxPoints.length === 0 && intensityCurve.length > 0) {
    const maxPt = intensityCurve.reduce((max, cur) => cur.value > max.value ? cur : max, intensityCurve[0])
    climaxPoints.push({
      id: genId(),
      chapterId: maxPt.chapterId,
      chapterTitle: maxPt.chapterTitle,
      intensity: maxPt.value,
      description: maxPt.description,
      characters: maxPt.characters,
      type: 'climax',
      order: maxPt.order,
    })
  }

  return {
    id: genId(),
    novelId,
    intensityCurve,
    climaxPoints,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

// ==================== 剧情大纲生成 ====================

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

// ==================== SRS v2.3 新增：标签生成 ====================

/**
 * 从推导结果自动生成标签
 */
export function buildTags(
  title: string,
  summary: string,
  characters: Character[],
  worldSetting: WorldSetting,
): Tag[] {
  const tags: Tag[] = []
  const now = Date.now()

  // 从标题和简介提取情节标签
  const plotKeywords = ['复仇', '穿越', '重生', '系统', '修仙', '末世', '悬疑', '恋爱', '职场', '权谋']
  plotKeywords.forEach((kw, idx) => {
    if (title.includes(kw) || summary.includes(kw)) {
      tags.push({
        id: genId(),
        name: kw,
        category: 'plot',
        color: '#3b82f6',
        isFavorite: false,
        createdAt: now + idx,
      })
    }
  })

  // 从角色提取人物标签
  characters.forEach((char, idx) => {
    if (char.personality.length > 0) {
      char.personality.slice(0, 3).forEach((p) => {
        if (!tags.some(t => t.name === p)) {
          tags.push({
            id: genId(),
            name: p,
            category: 'character',
            color: '#10b981',
            isFavorite: false,
            createdAt: now + 100 + idx,
          })
        }
      })
    }
  })

  // 从世界观提取场景标签
  if (worldSetting.worldType) {
    const worldTypeMap: Record<string, string> = {
      fantasy: '奇幻', scifi: '科幻', xuanhuan: '玄幻', urban: '都市',
      historical: '历史', wuxia: '武侠', apocalypse: '末世', campus: '校园',
    }
    const wt = worldTypeMap[worldSetting.worldType] || worldSetting.worldType
    tags.push({
      id: genId(),
      name: wt,
      category: 'scene',
      color: '#f59e0b',
      isFavorite: false,
      createdAt: now + 200,
    })
  }

  return tags
}

// ==================== SRS v2.3 新增：Prompt 模板生成 ====================

export interface PromptTemplate {
  id: string
  name: string
  content: string
  category: 'deduce' | 'write' | 'polish' | 'character' | 'world'
}

/**
 * 生成默认 Prompt 模板
 */
export function buildPrompts(title: string, summary: string): PromptTemplate[] {
  const now = Date.now()
  return [
    {
      id: genId(),
      name: '续写引导',
      category: 'write',
      content: `基于小说《${title}》的当前章节上下文，保持角色性格一致性，延续已有情节节奏进行续写。`,
    },
    {
      id: genId(),
      name: '润色-文学化',
      category: 'polish',
      content: '对以下文本进行文学化润色，提升画面感和情感张力，去除口语化表达。',
    },
    {
      id: genId(),
      name: '润色-情欲强化',
      category: 'polish',
      content: '强化文本中的情欲氛围描写，增加感官细节和心理活动，保持优雅不粗俗。',
    },
    {
      id: genId(),
      name: '角色扩展',
      category: 'character',
      content: `为《${title}》中的选定角色生成更详细的背景故事、语言风格样本和人际关系网络。`,
    },
    {
      id: genId(),
      name: '世界观扩展',
      category: 'world',
      content: `扩展《${title}》的世界观设定，补充社会结构细节、历史文化和经济体系。`,
    },
  ].map((p, idx) => ({ ...p, id: genId(), createdAt: now + idx })) as PromptTemplate[]
}

// ==================== 旧结果映射：AI文本 → DeduceInput ====================

/**
 * 将 AI 原始返回文本映射为当前版本的 DeduceInput
 */
export function mapOldResultToCurrent(raw: string): DeduceInput {
  const fields = parseGenerationResult(raw)

  const title = fields.title || '未命名小说'
  const summary = fields.synopsis || ''
  const now = Date.now()
  const protagonist = parseProtagonist(fields.protagonist, now)

  const allSupportingText = [
    fields.maleSupportingChars,
    fields.femaleSupportingChars,
    fields.supportingChars,
  ].filter(Boolean).join('\n\n')
  const supporting = parseSupportingChars(allSupportingText, now)

  const worldSetting = buildWorldSettingFromParser(fields.worldview)
  const chapters = parseChapterListFromParser(fields.chapterList)
  const plotLine = buildPlotLineFromParser(fields.emotionalLine, fields.chapterOutline, chapters)
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

function parseProtagonist(text: string, now: number): Character {
  const fields = parseProtagonistFields(text)
  const name = extractNameFromText(text) || '主角'

  let gender = ''
  const genderText = fields['性别'] || ''
  if (genderText.includes('男')) gender = '男'
  else if (genderText.includes('女')) gender = '女'

  let age = ''
  const ageMatch = (fields['年龄'] || text).match(/(\d{1,3})\s*岁/)
  if (ageMatch) age = ageMatch[1] + '岁'

  const appearance = cleanMarkdown(
    fields['外貌'] || fields['外貌特征'] || fields['形象'] || ''
  )

  const personalityText = cleanMarkdown(
    fields['性格'] || fields['性格特点'] || fields['性格核心'] || ''
  )
  const personality = personalityText
    .split(/[,，、;；]/)
    .map(s => s.trim())
    .filter(s => s.length >= 2 && s.length <= 20)

  const background = cleanMarkdown(
    fields['背景'] || fields['背景经历'] || fields['身世'] || ''
  )

  const abilities = cleanMarkdown(
    fields['能力'] || fields['特长'] || fields['技能'] || fields['异能'] || fields['法术'] || fields['武功'] || ''
  )

  const arc = cleanMarkdown(
    fields['目标'] || fields['核心动机'] || fields['动机'] || fields['人物弧线'] || fields['弧线'] || fields['追求'] || fields['梦想'] || ''
  )

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
    arc,
    tags: [],
    createdAt: now,
    updatedAt: now,
  }
}

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
  emotionArc: EmotionArc
  lustArc: LustArc
  outlineNodes: OutlineNode[]
  plotLine: PlotLine
  charIds: string[]
  tags: Tag[]
  prompts: PromptTemplate[]
}

/**
 * 统一转换：将 mapOldResultToCurrent 的输出转换为前端全部模块所需结构
 * SRS v2.3 修复：新增 emotionArc / lustArc / tags / prompts 生成
 */
export function transformDeduceToAppData(
  input: DeduceInput,
  options?: { firstChapterContent?: string; adultMode?: boolean; novelId?: string },
): AppData {
  const { firstChapterContent, adultMode, novelId: explicitNovelId } = options || {}
  const novelId = explicitNovelId || genId()

  const safe = {
    title: input.title || '未命名项目',
    summary: input.summary || '',
    protagonist: input.protagonist || {
      id: genId(), name: '主角', roleType: 'protagonist', avatar: '',
      basicInfo: { age: '', gender: '', occupation: '' },
      appearance: '', personality: [], background: '', abilities: '',
      relationships: [], voice: '', innerWorld: '', arc: '', tags: [],
      createdAt: Date.now(), updatedAt: Date.now(),
    },
    supporting: input.supporting || [],
    worldSetting: input.worldSetting || {
      id: genId(), name: '默认世界观', worldType: 'custom', description: '',
      overview: '', rules: [], locations: [], timeline: [], society: '',
      culture: '', economy: '', createdAt: Date.now(), updatedAt: Date.now(),
    },
    plotLine: input.plotLine || {
      id: genId(), type: 'main', name: '主线', description: '',
      events: [], relatedCharacters: [], createdAt: Date.now(), updatedAt: Date.now(),
    },
    chapters: input.chapters?.length > 0 ? input.chapters : [],
    firstChapter: input.firstChapter || '',
  }

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
    roleType: (['protagonist', 'supporting', 'antagonist', 'minor'].includes(c.roleType)
      ? c.roleType
      : defaultRole) as Character['roleType'],
  })

  const rawChars: Character[] = [
    fixRoleType(safe.protagonist, 'protagonist'),
    ...safe.supporting.map((c, index) => {
      const roleType = c.roleType || (index === 0 ? 'supporting' : index === 1 ? 'antagonist' : 'minor')
      return fixRoleType({ ...c, roleType: roleType as Character['roleType'] }, roleType as Character['roleType'])
    }),
  ]

  // 3. 生成关系
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

  // 5. SRS v2.3: 构建感情线（React Flow 格式）
  const plotEvents: Array<{ title: string; description: string }> =
    (safe.plotLine.events || []).map((e) => ({
      title: e.title || '',
      description: e.description || '',
    }))
  const emotionArc = buildEmotionArc(plotEvents, safe.chapters, characters, novelId, adultMode)

  // 6. SRS v2.3: 构建肉欲线
  const lustArc = buildLustArc(safe.chapters, characters, novelId, adultMode)

  // 7. 构建剧情大纲
  const outlineNodes = buildOutline(plotEvents, safe.chapters)

  // 8. 保证 plotLine.events 非空
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

  // 9. SRS v2.3: 生成标签
  const tags = buildTags(safe.title, safe.summary, characters, safe.worldSetting)

  // 10. SRS v2.3: 生成 Prompt 模板
  const prompts = buildPrompts(safe.title, safe.summary)

  return {
    characters,
    chapters,
    worldSetting: safe.worldSetting,
    emotionArc,
    lustArc,
    outlineNodes,
    plotLine: finalPlotLine,
    charIds,
    tags,
    prompts,
  }
}

// ==================== 兼容旧版导出 ====================

/**
 * 兼容旧版：将 emotionArc.timeline 转为旧版 emotionEvents 格式
 */
export function emotionArcToEvents(arc: EmotionArc): Array<{
  id: string
  title: string
  description: string
  type: EmotionEventType
  characterIds: string[]
  order: number
}> {
  return arc.timeline.map(t => ({
    id: t.id,
    title: t.title,
    description: t.description,
    type: t.type,
    characterIds: t.characterIds,
    order: t.order,
  }))
}
