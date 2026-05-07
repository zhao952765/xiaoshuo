/**
 * 推导结果解析器
 *
 * 吸收自 F:\1\old 新组件的两遍扫描法（parseGenerationResult）
 * 并增强为适配现有项目数据结构（Character / WorldSetting / PlotLine 等）
 *
 * 核心改进：
 * 1. isTitleLine() — 改进的标题行判断，只匹配行首格式化标题
 * 2. parseGenerationResult() — 两遍扫描法替代旧的正则区块提取
 * 3. parseSupportingChars() — 按 markdown 加粗格式结构化解析配角，提取名字+属性+关系
 * 4. extractProtagonistName() — 从主角段落提取名字
 * 5. parseWorldview() — 从世界观文本解析结构化数据
 *
 * 与 deduceTransformer.ts 的关系：
 *   deduceParser.ts 负责「AI文本 → 原始JSON字段」
 *   deduceTransformer.ts 负责「原始JSON → 前端可视化数据」
 */

import type { Character, WorldSetting } from '../types/types'
import { parseMarkdownFields, cleanMarkdown } from './markdownParser'

// ==================== P0: isTitleLine 改进版 ====================
// 此段吸收自 F:\1\old OneClickDerivation.tsx isTitleLine
// 关键改进：只匹配行首的格式化标题，而非行内任意位置的关键字

/**
 * 判断一行文本是否是「字段标题行」
 * 标题行特征：以 【、#、**、数字. 等格式标记开头
 * 这避免了正文中恰好包含"世界观""性格"等关键字时被误判为标题
 */
export function isTitleLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false

  // 严格模式：只匹配格式化标题，不匹配纯文本短行
  if (
    /^【/.test(trimmed) ||               // 【小说标题】
    /^#{1,4}\s/.test(trimmed) ||         // ## 小说标题
    /^\*\*[^*]/.test(trimmed) ||          // **小说标题**（至少有一个非*字符）
    /^\d+[.、．\s]/.test(trimmed) ||      // 1. 小说标题
    /^第[一二三四五六七八九十\d]+[章节卷篇]/.test(trimmed) // 第一章/节/卷/篇
  ) {
    return true
  }

  // 限定条件：中文字符 2-7 字且不含标点，才视为可能的标题
  const chineseOnly = trimmed.replace(/[^\u4e00-\u9fff]/g, '')
  if (chineseOnly.length >= 2 && chineseOnly.length <= 7 && chineseOnly === trimmed.replace(/\s/g, '')) {
    // 排除常见非标题词汇
    const nonTitle = /^(?:姓名|名字|性别|年龄|职业|外貌|性格|背景|能力|目标|关系|描述|介绍|设定|总结|备注|备注|说明)$/
    return !nonTitle.test(chineseOnly)
  }

  return false
}

// ==================== 两遍扫描法字段定义 ====================

/** 生成结果的字段定义 */
export interface GenerationFields {
  title: string
  synopsis: string
  protagonist: string
  maleSupportingChars: string
  femaleSupportingChars: string
  supportingChars: string
  worldview: string
  emotionalLine: string
  chapterOutline: string
  chapterList: string
  firstChapter: string
}

type FieldKey = keyof GenerationFields

/** 字段匹配规则 */
interface FieldRule {
  key: FieldKey
  keywords: string[]
}

/** 字段匹配规则表 */
const FIELD_RULES: FieldRule[] = [
  { key: 'title',                keywords: ['小说标题', '小说题目'] },
  { key: 'synopsis',             keywords: ['小说简介', '故事简介', '内容简介'] },
  { key: 'protagonist',          keywords: ['主角设定', '主角介绍'] },
  { key: 'maleSupportingChars',  keywords: ['男配角', '男角色', '男性配角'] },
  { key: 'femaleSupportingChars', keywords: ['女配角', '女角色', '女性配角'] },
  { key: 'supportingChars',      keywords: ['主要配角设定', '配角设定', '其他配角', '配角介绍'] },
  { key: 'worldview',            keywords: ['世界观与氛围', '世界观', '世界背景'] },
  { key: 'emotionalLine',        keywords: ['感情/肉欲发展线', '感情发展线', '情感发展线', '主要冲突线与感情', '冲突线与感情', '冲突线与情感', '感情线', '情感线'] },
  { key: 'chapterOutline',       keywords: ['剧情大纲', '整体规划'] },
  { key: 'chapterList',          keywords: ['章节目录'] },
  { key: 'firstChapter',         keywords: ['第一章正文', '正文内容'] },
]

// ==================== P0: parseGenerationResult 两遍扫描法 ====================
// 此段吸收自 F:\1\old OneClickDerivation.tsx parseGenerationResult
// 关键改进：先定位标题行，再按区间提取内容，避免正则跨区块误匹配

/**
 * 两遍扫描法解析 AI 生成结果
 *
 * 第一遍：扫描全文定位字段标题行位置
 * 第二遍：按标题行区间提取各字段内容
 *
 * 优势：不会把正文中恰好出现的"世界观""性格"等关键字误判为标题
 */
export function parseGenerationResult(text: string): GenerationFields {
  const result: GenerationFields = {
    title: '',
    synopsis: '',
    protagonist: '',
    maleSupportingChars: '',
    femaleSupportingChars: '',
    supportingChars: '',
    worldview: '',
    emotionalLine: '',
    chapterOutline: '',
    chapterList: '',
    firstChapter: '',
  }

  const lines = text.split('\n')
  const foundHeaders: { key: FieldKey; lineIdx: number }[] = []

  // ── 第一遍：定位字段标题行 ──
  for (let i = 0; i < lines.length; i++) {
    const trimmedLine = lines[i].trim()
    if (!trimmedLine) continue

    // 只在标题行格式上匹配关键字
    if (!isTitleLine(trimmedLine)) continue

    for (const rule of FIELD_RULES) {
      const matched = rule.keywords.some(kw => trimmedLine.includes(kw))
      if (!matched) continue

      // 避免同一行同一 key 重复添加
      if (foundHeaders.some(h => h.key === rule.key && h.lineIdx === i)) continue

      foundHeaders.push({ key: rule.key, lineIdx: i })
      break
    }
  }

  // 后备扫描：firstChapter 未匹配时，查找独立的「第一章」标题行
  if (!foundHeaders.some(h => h.key === 'firstChapter')) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line || foundHeaders.some(h => h.lineIdx === i)) continue
      if (/^#{1,3}\s*第一章/.test(line) || /^\*\*第一章/.test(line) ||
          /^【第一章/.test(line) || /^第一章正文/.test(line)) {
        foundHeaders.push({ key: 'firstChapter', lineIdx: i })
        break
      }
    }
  }

  // 后备：emotionalLine 未匹配时，用更宽泛的关键字在标题行中查找
  if (!foundHeaders.some(h => h.key === 'emotionalLine')) {
    const EMOTION_EXTRA_KW = ['情感发展', '感情线', '肉欲发展', '情欲发展', '冲突线', '主要冲突', '冲突设计']
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line || !isTitleLine(line)) continue
      if (foundHeaders.some(h => h.lineIdx === i)) continue
      if (EMOTION_EXTRA_KW.some(kw => line.includes(kw))) {
        foundHeaders.push({ key: 'emotionalLine', lineIdx: i })
        break
      }
    }
  }

  // 后备：chapterOutline 未匹配时，查找包含「大纲」的标题行
  if (!foundHeaders.some(h => h.key === 'chapterOutline')) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line || !isTitleLine(line)) continue
      if (foundHeaders.some(h => h.lineIdx === i)) continue
      if (line.includes('大纲')) {
        foundHeaders.push({ key: 'chapterOutline', lineIdx: i })
        break
      }
    }
  }

  // 按 lineIdx 排序
  foundHeaders.sort((a, b) => a.lineIdx - b.lineIdx)

  // ── 第二遍：按区间提取内容 ──
  for (let h = 0; h < foundHeaders.length; h++) {
    const { key, lineIdx } = foundHeaders[h]

    // 下一个字段标题行位置
    let endIdx = lines.length
    for (let k = h + 1; k < foundHeaders.length; k++) {
      if (foundHeaders[k].lineIdx > lineIdx) {
        endIdx = foundHeaders[k].lineIdx
        break
      }
    }

    // 标题行后缀内容（去掉格式标记）
    const headerLine = lines[lineIdx]
    let inlineSuffix = headerLine
      .replace(/^[\d\s#.*（）()、\-—]+/, '')
      .replace(/^【[^】]*】/, '')
      .replace(/^\*\*[^*]+\*\*\s*[：:]*/, '')
      .replace(/^[^：:]*[：:]/, '')
      .trim()

    // 去掉标题行中已匹配到的关键字（如"小说简介""主角设定"等）
    for (const rule of FIELD_RULES) {
      if (rule.key !== key) continue
      for (const kw of rule.keywords) {
        if (inlineSuffix.startsWith(kw)) {
          inlineSuffix = inlineSuffix.slice(kw.length).replace(/^[：:\s]+/, '')
          break
        }
      }
      if (inlineSuffix !== headerLine.trim()) break
    }

    // 标题行后到 endIdx 的所有行
    const afterLines = lines.slice(lineIdx + 1, endIdx)
    while (afterLines.length > 0 && !afterLines[afterLines.length - 1].trim()) afterLines.pop()
    const afterContent = afterLines.join('\n').trim()

    // 合并行内后缀 + 后续内容
    const parts: string[] = []
    if (inlineSuffix && inlineSuffix !== headerLine.trim()) parts.push(inlineSuffix)
    if (afterContent) parts.push(afterContent)
    const combined = parts.join('\n').trim()

    // 追加或赋值
    if (result[key] && combined) {
      result[key] += '\n\n' + combined
    } else if (combined) {
      result[key] = combined
    }
  }

  // ── 步骤3：配角设定智能分配 ──
  // 如果只有 supportingChars 而没有分男女，自动按关键词拆分
  if (result.supportingChars && !result.maleSupportingChars && !result.femaleSupportingChars) {
    const content = result.supportingChars
    const maleIdx = content.search(/男配角|男角色|男性/)
    const femaleIdx = content.search(/女配角|女角色|女性/)

    if (maleIdx >= 0 && femaleIdx >= 0 && maleIdx < femaleIdx) {
      result.maleSupportingChars = content.slice(0, femaleIdx).trim()
      result.femaleSupportingChars = content.slice(femaleIdx).trim()
    } else if (femaleIdx >= 0 && maleIdx < 0) {
      result.femaleSupportingChars = content
    } else {
      result.maleSupportingChars = content
    }
  }

  // ── 步骤4：后备处理 ──
  // 后备：chapterList 为空时，扫描全文收集「第X章」行
  if (!result.chapterList) {
    const chLines = lines
      .map((l, i) => ({ line: l.trim(), idx: i }))
      .filter(({ line, idx }) => {
        if (foundHeaders.some(h => h.lineIdx === idx)) return false
        return /第[一二三四五六七八九十百\d]+章|^\s*\d+[.、．]/.test(line)
      })
    if (chLines.length > 0) {
      result.chapterList = chLines.map(c => c.line).join('\n')
    }
  }

  // 简介清理
  if (result.synopsis) {
    result.synopsis = result.synopsis
      .replace(/^小说简介[：:]\s*/m, '')
      .replace(/^故事简介[：:]\s*/m, '')
      .replace(/^内容简介[：:]\s*/m, '')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !/^[小故内]小说?故?[事容介]简介/.test(l))
      .join('\n')
      .trim()
  }

  // 后备：没有任何解析结果时，整段作为第一章
  if (!Object.values(result).some(v => v.length > 0)) {
    result.firstChapter = text
  }

  // 标题清理
  if (result.title) {
    result.title = result.title
      .replace(/[*#【】「」《》\"']/g, '')
      .replace(/^小说标题[：:]\s*/m, '')
      .replace(/^小说题目[：:]\s*/m, '')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !/^小说[标题题目]/.test(l))
      .join(' ')
      .trim()
  }

  return result
}

// ==================== P0: extractProtagonistName ====================
// 修复 Bug：旧代码 extractField 只取 Key: Value 行内格式，
// AI 输出经常把名字放在标题行或段落首行，导致主角名提取失败

/**
 * 从主角段落文本中提取名字
 * 支持多种格式：
 * 1. 姓名：XXX / 名字：XXX（行内键值对）
 * 2. 【主角】张三 / ## 主角：张三（标题行后缀）
 * 3. 段落首行的 2-8 字中文名（后备）
 */
export function extractProtagonistName(text: string): string {
  if (!text.trim()) return ''

  // 模式1：键值对格式
  const kvMatch =
    text.match(/姓名[：:\s]*[^\n]*?([^\n,，、\s]{1,10})/) ||
    text.match(/名字[：:\s]*[^\n]*?([^\n,，、\s]{1,10})/) ||
    text.match(/名称[：:\s]*[^\n]*?([^\n,，、\s]{1,10})/)
  if (kvMatch) {
    const name = kvMatch[1].replace(/^[：:\-\s]+/, '').trim()
    if (name && name.length <= 10 && !/设定|介绍|描述|性格|外貌/.test(name)) {
      return name
    }
  }

  // 模式2：标题行后缀（## 主角设定：张三）
  const titleMatch = text.match(/^(?:#{1,4}\s*(?:主角[^\n：:]*?[：:]\s*|.*?名[：:]\s*))([^\n,，、]{2,8})/m)
  if (titleMatch) {
    const name = titleMatch[1].replace(/^[：:\-\s]+/, '').trim()
    if (name && name.length <= 8 && !/设定|介绍|描述|性格|外貌/.test(name)) {
      return name
    }
  }

  // 模式3：首行短名（2-4个中文字符，不含常见标题关键词）
  const firstLine = text.split('\n').find(l => l.trim().length > 0)
  if (firstLine) {
    const cleanLine = firstLine.replace(/^[#\-*\d.、\s【】]+/, '').trim()
    const shortName = cleanLine.match(/^([\u4e00-\u9fff]{2,4})(?:[：:,，\s]|$)/)
    if (shortName && !/设定|介绍|描述|性格|外貌|主角|配角|背景|角色|名$/.test(shortName[1])) {
      return shortName[1]
    }
  }

  return ''
}

// ==================== P0: parseSupportingChars ====================
// 使用 markdownParser 工具函数进行结构化解析

/**
 * 从配角文本块中按 markdown 格式解析出各配角
 * 支持多种分割策略：markdown **名字** / 数字序号 1. 2. / 空行分隔
 */
export function parseSupportingChars(text: string, now: number, defaultGender?: string): Character[] {
  if (!text.trim()) return [];

  const chars: Character[] = [];

  // 策略1: 按 markdown 格式 **名字** 或 **数字. 名字** 分割
  // 策略2: 按数字序号 1. 2. 3. 分割
  // 策略3: 按空行分割

  let entries: string[] = [];

  // 尝试策略1: markdown 格式
  const mdSplit = text.split(/\n(?=\s*\*\*(?:\d+\.\s*)?[^*]+\*\*(?:[：:\s]|$))/);
  if (mdSplit.length > 1) {
    entries = mdSplit;
  }
  // 尝试策略2: 数字序号格式
  else if (text.match(/^\s*\d+[\.、．]\s*/m)) {
    entries = text.split(/\n(?=\s*\d+[\.、．]\s+)/).filter(Boolean);
  }
  // 策略3: 按空行分割
  else {
    entries = text.split(/\n\s*\n/).filter(Boolean);
  }

  // 过滤无意义条目
  entries = entries.filter((e) => {
    const t = e.trim()
    if (!t) return false
    if (t.length < 4) return false // 太短的无意义
    if (/^第[一二三四五六七八九十\d]+[章节卷]/.test(t)) return false // 章节标题
    if (/^#{1,4}\s/.test(t)) return false // markdown 标题
    return true
  })

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i].trim();
    if (!entry) continue;

    // 提取姓名（多种策略）
    let name = '';
    const firstLine = entry.split('\n')[0].trim();

    // 策略A: **名字** 格式
    const mdNameMatch = firstLine.match(/^\s*\*\*(?:\d+\.\s*)?([^*]+?)\*\*/);
    if (mdNameMatch) {
      name = cleanMarkdown(mdNameMatch[1]).trim();
    }

    // 策略B: 数字. 名字 格式
    if (!name) {
      const numNameMatch = entry.match(/^\s*\d+[\.、．]\s*([^\n#：:\-——（）()]{2,10})/);
      if (numNameMatch) {
        name = numNameMatch[1].trim().replace(/^#+\s*/, '').trim();
      }
    }

    // 策略C: 行首纯文本短名（2-4字中文，不包含非名字关键词）
    if (!name) {
      const clean = cleanMarkdown(firstLine)
        .replace(/^[-•·\s\d.、．#]+/, '')
        .replace(/[（(].*?[)）]/, '')
        .trim()
      // 只取首词，限定为纯中文名 2-4 字
      const word = clean.split(/[，,、\s]/)[0]
      if (word && /^[\u4e00-\u9fff]{2,4}$/.test(word) &&
          !/^(?:设定|介绍|描述|性格|外貌|背景|姓名|性别|年龄|能力|备注)$/.test(word)) {
        name = word
      }
    }

    if (!name || name.length < 2 || name.length > 10) continue;

    // 提取字段（使用 parseMarkdownFields + 正则回退）
    const fields = parseMarkdownFields(entry);

    // 性别
    let gender = '';
    const genderText = fields['性别'] || '';
    if (genderText.includes('男')) gender = '男';
    else if (genderText.includes('女')) gender = '女';
    if (!gender && defaultGender) gender = defaultGender;

    // 年龄
    let age = '';
    const ageMatch = (fields['年龄'] || entry).match(/(\d{1,3})\s*岁/);
    if (ageMatch) age = ageMatch[1] + '岁';

    // 外貌（支持多种字段名）
    const appearance = cleanMarkdown(
      fields['外貌'] || fields['外貌特征'] || fields['形象'] || fields['长相'] || ''
    );

    // 性格（支持多种字段名）
    const personalityText = cleanMarkdown(
      fields['性格'] || fields['性格特点'] || fields['性格核心'] || fields['个性'] || ''
    );
    const personality = personalityText
      .split(/[,，、;；]/)
      .map(s => s.trim())
      .filter(s => s.length >= 2 && s.length <= 20);

    // 背景（支持多种字段名）
    const background = cleanMarkdown(
      fields['背景'] || fields['背景经历'] || fields['身世'] || fields['经历'] || ''
    );

    // 能力/特长（修复：此前永远为空字符串）
    const abilities = cleanMarkdown(
      fields['能力'] || fields['特长'] || fields['技能'] || fields['异能'] || fields['法术'] || ''
    );

    // 目标/人物弧线（修复：此前永远为空字符串）
    const arc = cleanMarkdown(
      fields['目标'] || fields['核心动机'] || fields['动机'] || fields['人物弧线'] || fields['弧线'] || fields['追求'] || ''
    );

    // 关系
    const relationships: Character['relationships'] = [];
    const relText = cleanMarkdown(
      fields['与主角关系'] || fields['关系'] || fields['人物关系'] || ''
    );
    if (relText) {
      relationships.push({
        targetId: '',
        targetName: '主角',
        type: relText,
        description: '',
      });
    }

    chars.push({
      id: `sup_${now}_${i}_${Math.random().toString(36).slice(2, 4)}`,
      name,
      roleType: 'supporting',
      avatar: '',
      basicInfo: { age, gender, occupation: '' },
      appearance,
      personality,
      background,
      abilities,
      relationships,
      voice: '',
      innerWorld: '',
      arc,
      tags: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  return chars;
}

// ==================== P0: parseWorldview ====================
// 修复 Bug：旧代码 parseWorldSetting 只用 extractField 单行提取，
// 无法处理 AI 输出中的多行规则/地点列表

/** 世界观解析结果 */
export interface ParsedWorldview {
  overview: string
  rules: WorldSetting['rules']
  locations: WorldSetting['locations']
  timeline: WorldSetting['timeline']
  society: string
  culture: string
  economy: string
}

/**
 * 从世界观文本解析结构化数据
 * 使用两遍扫描法先定位各子标题，再按区间提取
 */
export function parseWorldview(text: string): ParsedWorldview {
  if (!text.trim()) {
    return {
      overview: '',
      rules: [],
      locations: [],
      timeline: [],
      society: '',
      culture: '',
      economy: '',
    }
  }

  // 用两遍扫描法提取世界观各子区块
  const sections = parseGenerationResult(
    '## 世界观\n' + text  // 包裹一层让扫描器能识别
  )

  // 概述
  const overview = sections.worldview || text.slice(0, 600)

  // 规则
  const rulesText = sections.chapterOutline || '' // 后备
  const rulesRaw = extractSubSection(text, ['规则', '关键规则', '禁忌', '法则', '核心规则'])
  const rules = parseRuleList(rulesRaw || rulesText)

  // 地点
  const locRaw = extractSubSection(text, ['场景', '地点', '特色场景', '地理', '地理环境'])
  const locations = parseLocationList(locRaw)

  // 时间线
  const timelineRaw = extractSubSection(text, ['历史', '时间线', '历史事件', '编年'])
  const timeline = parseTimelineList(timelineRaw)

  // 社会/文化/经济
  const society = extractSubSection(text, ['社会', '社会结构', '势力', '势力划分']) || ''
  const culture = extractSubSection(text, ['文化', '风俗', '传统']) || ''
  const economy = extractSubSection(text, ['经济', '资源', '经济体系']) || ''

  return {
    overview,
    rules,
    locations,
    timeline,
    society,
    culture,
    economy,
  }
}

/**
 * 从文本中提取指定子区块（兼容多种标题格式）
 * 使用改进的 isTitleLine 判断 + 关键字匹配
 */
function extractSubSection(text: string, titles: string[]): string {
  const lines = text.split('\n')

  for (const title of titles) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      // 检测是否为包含关键字的标题行（兼容 ### 历史 / **历史** 等格式）
      const isTitle = line.includes(title) && (
        isTitleLine(line) || /^#{1,4}\s/.test(line) || 
        new RegExp(`(?:^|#{1,4}\\s|【|\\*\\*)\\s*${title}`).test(line)
      )
      if (!isTitle) continue

      // 找到标题行，提取后续内容直到下一个标题行
      const endIdx = findNextTitleLine(lines, i + 1)
      const contentLines = lines.slice(i + 1, endIdx)
        .map(l => l.trim())
        .filter(l => l.length > 0)

      // 也提取标题行后缀
      const suffix = line
        .replace(/^[\d\s#.*（）()、\-—]+/, '')
        .replace(/^【[^】]*】/, '')
        .replace(/^\*\*[^*]+\*\*\s*[：:]*/, '')
        .replace(/^[^：:]*[：:]/, '')
        .trim()

      const parts: string[] = []
      if (suffix && suffix !== line.trim() && suffix !== title) parts.push(suffix)
      if (contentLines.length > 0) parts.push(contentLines.join('\n'))
      const result = parts.join('\n').replace(/^[-•·]\s*/gm, '').trim()

      if (result) return result
    }
  }

  return ''
}

/** 从指定行开始找下一个标题行 */
function findNextTitleLine(lines: string[], startIdx: number): number {
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    if (isTitleLine(line)) return i
  }
  return lines.length
}

/** 解析规则列表（过滤子标题行） */
function parseRuleList(text: string): WorldSetting['rules'] {
  if (!text.trim()) return []
  const TITLE_KW = /^(?:规则|关键规则|禁忌|法则|核心规则|特色场景|地理|社会|历史|文化|经济)[：:]*$/
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 3 && !TITLE_KW.test(l))
    .slice(0, 8)
    .map(l => ({
      name: l.replace(/^[-\d\.\s•]+/, '').split(/[:：]/)[0] || '规则',
      description: l.replace(/^[-\d\.\s•]+/, ''),
      scope: '',
      limit: '',
      sideEffect: '',
    }))
}

/** 解析地点列表（过滤子标题行） */
function parseLocationList(text: string): WorldSetting['locations'] {
  if (!text.trim()) return []
  const TITLE_KW = /^(?:场景|地点|特色场景|地理|地理环境|规则|社会|历史|文化|经济)[：:]*$/
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 3 && !TITLE_KW.test(l))
    .slice(0, 8)
    .map(l => ({
      name: l.replace(/^[-\d\.\s•]+/, '').split(/[:：]/)[0] || '地点',
      type: '场景',
      description: l.replace(/^[-\d\.\s•]+/, ''),
      atmosphere: '',
      scenes: [] as string[],
    }))
}

/** 解析时间线列表（过滤子标题行） */
function parseTimelineList(text: string): WorldSetting['timeline'] {
  if (!text.trim()) return []
  const TITLE_KW = /^(?:历史|时间线|历史事件|编年|规则|社会|文化|经济|场景|地理)[：:]*$/
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 3 && !TITLE_KW.test(l))
    .slice(0, 8)
    .map(l => ({
      era: '',
      title: l.replace(/^[-\d\.\s•]+/, '').split(/[:：]/)[0] || '事件',
      description: l.replace(/^[-\d\.\s•]+/, ''),
      impact: '',
    }))
}


