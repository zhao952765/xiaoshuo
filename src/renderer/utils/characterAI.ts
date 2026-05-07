/**
 * 角色 AI 辅助工具
 * 吸收自 F:\1\old 新组件的 applyAIResult 和 handleOneClickAdultMode
 * 适配现有数据结构（Character 接口）
 *
 * 关键映射：
 * - 姓名 → name
 * - 年龄 → basicInfo.age
 * - 性别 → basicInfo.gender
 * - 外貌 → appearance
 * - 性格 → personality[] (string[])
 * - 关系 → relationships[] (结构化数组)
 * - 语言风格 → voice
 * - 背景故事 → background
 * - 能力 → abilities
 * - 内心世界 → innerWorld
 * - 目标/动机 → arc
 */

import type { Character } from '@cfg/types'
import { PERSONALITY_TAGS } from '../constants/character'

// ==========================================
// AI 结果自动解析回填（P0 核心资产）
// 此段吸收自 F:\1\old CharacterCreator.tsx applyAIResult
// 增强版：支持更多格式 + 映射到现有数据结构
// ==========================================

export interface ParsedAICharacter {
  name: string
  age: string
  gender: string
  appearance: string
  personalityTags: string[]       // 匹配到标签库的标签
  personalityExtra: string        // 未匹配标签库的额外文本
  relationships: Array<{
    targetName: string
    type: string
    description: string
  }>
  voice: string
  background: string
  abilities: string
  innerWorld: string
  arc: string
  occupation: string
}

/**
 * 从 AI 生成文本中解析角色信息
 * 支持多种格式：## 标题、**标题**、【标题】、数字. 标题
 */
export function parseAICharacterResult(text: string): ParsedAICharacter {
  const result: ParsedAICharacter = {
    name: '',
    age: '',
    gender: '',
    appearance: '',
    personalityTags: [],
    personalityExtra: '',
    relationships: [],
    voice: '',
    background: '',
    abilities: '',
    innerWorld: '',
    arc: '',
    occupation: '',
  }

  // ---- 提取姓名 ----
  const nameMatch =
    text.match(/姓名[：:\s]*[^\n]*?([^\n,，、\s]{1,10})/) ||
    text.match(/名字[：:\s]*[^\n]*?([^\n,，、\s]{1,10})/) ||
    text.match(/名称[：:\s]*[^\n]*?([^\n,，、\s]{1,10})/)
  if (nameMatch) {
    const generatedName = nameMatch[1].replace(/^[：:\-\s]+/, '').trim()
    if (generatedName && generatedName.length <= 10) {
      result.name = generatedName
    }
  }

  // ---- 提取年龄 ----
  const ageMatch = text.match(/年龄[：:\s]*(\d+\s*岁?半?)/)
  if (ageMatch) {
    result.age = ageMatch[1].trim()
  }

  // ---- 提取性别 ----
  const genderFemale = text.match(/性别[：:\s]*(女|女性|Female)/i)
  const genderMale = text.match(/性别[：:\s]*(男|男性|Male)/i)
  if (genderFemale) result.gender = '女'
  else if (genderMale) result.gender = '男'

  // ---- 提取职业/身份 ----
  const occupationMatch =
    text.match(/(?:身份|职业|职位)[：:\s]*([^\n,，、]{1,20})/)
  if (occupationMatch) {
    result.occupation = occupationMatch[1].replace(/^[：:\-\s]+/, '').trim()
  }

  // ---- 提取外貌 ----
  const appearanceText = extractSection(text, ['外貌特征', '外貌', '外表', '外观'])
  if (appearanceText) {
    result.appearance = appearanceText.replace(/^[-•·]\s*/gm, '').trim()
  }

  // ---- 提取性格 → 解析为 personalityTags[] + personalityExtra ----
  const personalityText = extractSection(text, ['性格特点', '性格', '个性', '性格关键词'])
  if (personalityText) {
    const cleaned = personalityText.replace(/^[-•·]\s*/gm, '').trim()
    const allKnownTags = [
      ...PERSONALITY_TAGS.positive,
      ...PERSONALITY_TAGS.negative,
      ...PERSONALITY_TAGS.neutral,
      ...PERSONALITY_TAGS.nsfw,
    ]

    // 按常见分隔符拆分
    const tokens = cleaned.split(/[,，、；;\n\s]+/).map(s => s.trim()).filter(s => s.length > 0 && s.length < 15)

    const matchedTags: string[] = []
    const extraParts: string[] = []

    for (const token of tokens) {
      // 去掉前缀标记
      const clean = token.replace(/^[-•·\d.、)\]]+\s*/, '').trim()
      if (!clean) continue

      if ((allKnownTags as readonly string[]).includes(clean)) {
        matchedTags.push(clean)
      } else if (clean.length <= 8) {
        // 短词可能是标签（不在库中的）
        matchedTags.push(clean)
      } else {
        extraParts.push(clean)
      }
    }

    result.personalityTags = matchedTags
    result.personalityExtra = extraParts.join('；')
  }

  // ---- 提取关系 → 解析为 relationships[] 结构化数组 ----
  const relText = extractSection(text, ['人际关系', '关系', '人物关系', '社交关系'])
  if (relText) {
    const cleaned = relText.replace(/^[-•·]\s*/gm, '').trim()
    // 按行分割，尝试提取关系
    const lines = cleaned.split('\n').filter(l => l.trim().length > 2)
    for (const line of lines) {
      // 尝试匹配 "与XX的关系：..." 或 "XX：..." 或 "XX和XX：..."
      const relPattern1 = line.match(/(?:与|和)?(.{1,8}?)(?:的)?(?:关系|之间)[：:\s]*(.+)/)
      const relPattern2 = line.match(/(.{1,8}?)[：:]\s*(.+)/)

      if (relPattern1) {
        result.relationships.push({
          targetName: relPattern1[1].trim(),
          type: inferRelType(relPattern1[2]),
          description: relPattern1[2].trim(),
        })
      } else if (relPattern2 && relPattern2[1].trim().length <= 8) {
        result.relationships.push({
          targetName: relPattern2[1].trim(),
          type: inferRelType(relPattern2[2]),
          description: relPattern2[2].trim(),
        })
      }
    }
    // 如果没提取到结构化关系，整段作为一条
    if (result.relationships.length === 0 && cleaned.length > 5) {
      result.relationships.push({
        targetName: '主角',
        type: '相识',
        description: cleaned.slice(0, 200),
      })
    }
  }

  // ---- 提取语言风格 → voice ----
  const voiceText = extractSection(text, ['语言风格', '说话方式', '口头禅', '对话风格'])
  if (voiceText) {
    result.voice = voiceText.replace(/^[-•·]\s*/gm, '').trim()
  }

  // ---- 提取背景故事 → background ----
  const bgText = extractSection(text, ['背景故事', '背景', '经历', '身世', '成长经历'])
  if (bgText) {
    result.background = bgText.replace(/^[-•·]\s*/gm, '').trim()
  }

  // ---- 提取能力 → abilities ----
  const abilityText = extractSection(text, ['能力与特长', '能力', '技能', '特长', '异能'])
  if (abilityText) {
    result.abilities = abilityText.replace(/^[-•·]\s*/gm, '').trim()
  }

  // ---- 提取内心世界 → innerWorld ----
  const innerText = extractSection(text, ['内心世界', '内心', '心理', '内心独白'])
  if (innerText) {
    result.innerWorld = innerText.replace(/^[-•·]\s*/gm, '').trim()
  }

  // ---- 提取目标/动机 → arc ----
  const arcText = extractSection(text, ['目标', '动机', '核心动机', '追求', '角色弧线'])
  if (arcText) {
    result.arc = arcText.replace(/^[-•·]\s*/gm, '').trim()
  }

  return result
}

/**
 * 将解析结果应用到 Character 表单
 * 仅填充空字段，不覆盖用户已填写的内容
 */
export function applyParsedToForm(
  parsed: ParsedAICharacter,
  currentForm: Character,
): Character {
  const form = { ...currentForm }

  // 姓名（仅空时填充）
  if (!form.name.trim() && parsed.name) {
    form.name = parsed.name
  }

  // 年龄
  if (!form.basicInfo.age.trim() && parsed.age) {
    form.basicInfo = { ...form.basicInfo, age: parsed.age }
  }

  // 性别
  if (!form.basicInfo.gender.trim() && parsed.gender) {
    form.basicInfo = { ...form.basicInfo, gender: parsed.gender }
  }

  // 职业
  if (!form.basicInfo.occupation.trim() && parsed.occupation) {
    form.basicInfo = { ...form.basicInfo, occupation: parsed.occupation }
  }

  // 外貌（追加）
  if (parsed.appearance) {
    form.appearance = form.appearance
      ? form.appearance + '\n\n' + parsed.appearance
      : parsed.appearance
  }

  // 性格标签（追加去重）
  if (parsed.personalityTags.length > 0) {
    const existing = new Set(form.personality)
    const newTags = parsed.personalityTags.filter(t => !existing.has(t))
    form.personality = [...form.personality, ...newTags]
  }

  // 性格额外描述 → 追加到 background 或 innerWorld
  if (parsed.personalityExtra && !form.background.trim()) {
    form.background = parsed.personalityExtra
  }

  // 关系（追加）
  if (parsed.relationships.length > 0) {
    const existingTargets = new Set(form.relationships.map(r => r.targetName))
    const newRels = parsed.relationships
      .filter(r => !existingTargets.has(r.targetName))
      .map(r => ({
        targetId: '',  // 暂无 ID，用户后续可关联
        targetName: r.targetName,
        type: r.type,
        description: r.description,
      }))
    form.relationships = [...form.relationships, ...newRels]
  }

  // 语言风格（追加到 voice）
  if (parsed.voice) {
    form.voice = form.voice
      ? form.voice + '\n\n' + parsed.voice
      : parsed.voice
  }

  // 背景
  if (!form.background.trim() && parsed.background) {
    form.background = parsed.background
  }

  // 能力
  if (!form.abilities.trim() && parsed.abilities) {
    form.abilities = parsed.abilities
  }

  // 内心世界
  if (!form.innerWorld.trim() && parsed.innerWorld) {
    form.innerWorld = parsed.innerWorld
  }

  // 目标/动机
  if (!form.arc.trim() && parsed.arc) {
    form.arc = parsed.arc
  }

  return form
}

// ==========================================
// 一键成人模式（P1）
// 此段吸收自 F:\1\old CharacterCreator.tsx handleOneClickAdultMode
// 适配现有 string[] personality 和结构化 relationships
// ==========================================

export interface AdultModeResult {
  personalityTags: string[]
  appearance: string
  innerWorld: string
  arc: string
}

export function generateAdultModeContent(currentGender: string): AdultModeResult {
  // 成人向性格标签
  const adultTags = [
    '淫荡', '淫乱', '发情', '身体敏感', '主动诱惑', '骚浪', '欲女', '痴女',
    '敏感体质', '易潮吹', '巨乳', '露出癖', '言语挑逗', '享受被操',
    '浪叫', '肉欲强烈', '羞耻心低', 'M属性', 'S属性', '高H', 'NSFW',
    '色情', '湿润', '多汁', '性饥渴', '渴望被插', '性瘾', '高潮不断',
  ]

  // 根据性别生成外貌描述
  const isFemale = currentGender === '女'
  const appearance = isFemale
    ? `身材火辣劲爆，三围 95-55-96，F罩杯巨乳沉甸甸晃荡，细腰肥臀翘挺诱人，修长美腿裹着黑丝或肉丝，皮肤白皙细腻敏感。乳头和阴蒂是敏感带，轻轻一碰就颤抖不止。穿着低胸露脐装或真空上阵，短裙下若隐若现的骚穴散发着诱人的荷尔蒙气息。`
    : `身材健硕结实，肌肉线条分明，宽肩窄腰，体格壮硕有力。六块腹肌分明，臂膀粗壮有力，皮肤散发着强烈的男性荷尔蒙气息。下体尺寸惊人，勃起后粗长硬挺，龟头饱满充血，让每个接触的人都欲罢不能。`

  const innerWorld = isFemale
    ? `外表清纯甜美，内心却是个骚浪贱货。性欲旺盛到极点，身体敏感得吓人，只要被触碰乳房、阴蒂或骚穴就会立刻发情，淫水直流。羞耻心极低，喜欢主动勾引主角，说各种下流骚话挑逗，享受被粗暴插入、深喉口交、后入爆操、露出调教、连续高潮和内射。发情后会主动骑乘求欢，浪叫呻吟不绝于耳，是个被操得高潮迭起也不满足的极品欲女。`
    : `外表冷酷强势，内心却有着强烈的支配欲和性欲。喜欢掌控一切，尤其是床上，享受将对方操到求饶的快感。性欲旺盛，持久力惊人，可以连续作战数小时不停歇。`

  const arc = `对主角充满强烈的占有欲和性欲，随时随地都渴望与主角发生激烈性关系，喜欢在各种场合主动挑逗勾引。`

  return {
    personalityTags: adultTags,
    appearance,
    innerWorld,
    arc,
  }
}

// ==========================================
// 内部工具
// ==========================================

/** 从 AI 文本中提取指定区块，兼容 ## / ** / 【】 / 数字. 四种标题格式 */
function extractSection(text: string, titles: string[]): string {
  // 模式1：## 标题
  for (const t of titles) {
    const reg = new RegExp(`##\\s*${t}[：:\\s]*\\n([\\s\\S]*?)(?=\\n##|$)`, 'i')
    const m = text.match(reg)
    if (m) return m[1].trim()
  }
  // 模式2：**标题**
  for (const t of titles) {
    const reg = new RegExp(`\\*\\*${t}[：:\\s]*\\*\\*[\\s\\S]*?\\n([\\s\\S]*?)(?=\\n\\d+\\.\\s*\\*\\*|\\*\\*[^*]+\\*\\*|$)`, 'i')
    const m = text.match(reg)
    if (m) return m[1].trim()
  }
  // 模式3：【标题】
  for (const t of titles) {
    const reg = new RegExp(`【${t}】[：:\\s]*\\n?([\\s\\S]*?)(?=【|$)`, 'i')
    const m = text.match(reg)
    if (m) return m[1].trim()
  }
  // 模式4：数字. 标题
  for (const t of titles) {
    const reg = new RegExp(`\\d+\\.\\s*${t}[：:\\s]*\\n([\\s\\S]*?)(?=\\n\\d+\\.\\s|$)`, 'i')
    const m = text.match(reg)
    if (m) return m[1].trim()
  }
  return ''
}

/** 从关系描述文本推断关系类型 */
function inferRelType(desc: string): string {
  const d = desc.toLowerCase()
  if (/敌|对手|仇|对立/.test(d)) return '对立'
  if (/恋人|爱人|情侣|相恋/.test(d)) return '恋人'
  if (/师|徒弟|老师|弟子/.test(d)) return '师徒'
  if (/亲|兄|弟|姐|妹|父|母/.test(d)) return '亲人'
  if (/友|朋友|挚友/.test(d)) return '朋友'
  if (/主|仆|奴/.test(d)) return '主仆'
  if (/情|性|肉体|操/.test(d)) return '肉体关系'
  return '相识'
}
