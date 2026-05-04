import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store'
import PageWrapper from '../../components/PageWrapper'
import { loadPrompt } from '../../utils/promptLoader'
import type {
  AIModel,
  OneClickResult,
  Character,
  WorldSetting,
  PlotLine,
  NovelLength,
} from '../../../config/types'

// ==========================================
// 工具函数
// ==========================================

const genId = (): string =>
  `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

/** 进度阶段计算：根据已接收字数判断当前阶段 */
function getProgressPhase(textLength: number): { percent: number; label: string } {
  if (textLength < 300) return { percent: 10, label: '正在连接 AI 模型并构思框架...' }
  if (textLength < 1200) return { percent: 30, label: '正在生成主角与配角设定...' }
  if (textLength < 2500) return { percent: 50, label: '正在构建世界观与背景规则...' }
  if (textLength < 4500) return { percent: 65, label: '正在设计冲突线与感情脉络...' }
  if (textLength < 7000) return { percent: 80, label: '正在规划章节目录...' }
  return { percent: 92, label: '正在撰写第一章正文...' }
}

// ==========================================
// AI 流式调用
// ==========================================

async function callAIModelStream(
  model: AIModel,
  systemPrompt: string,
  userPrompt: string,
  onChunk: (text: string) => void
): Promise<string> {
  const url = model.baseUrl.replace(/\/+$/, '') + '/chat/completions'

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${model.apiKey}`,
    },
    body: JSON.stringify({
      model: model.modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: model.temperature,
      max_tokens: model.maxTokens,
      stream: true,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`AI 请求失败 (${res.status}): ${errText || res.statusText}`)
  }

  const reader = res.body?.getReader()
  const decoder = new TextDecoder()
  let fullText = ''

  if (!reader) throw new Error('响应流不可用，请检查模型配置')

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') continue
      try {
        const parsed = JSON.parse(data)
        const content = parsed.choices?.[0]?.delta?.content
        if (typeof content === 'string') {
          fullText += content
          onChunk(fullText)
        }
      } catch {
        // SSE 数据解析失败时安全忽略
      }
    }
  }

  return fullText
}

// ==========================================
// 文本提取与解析工具
// ==========================================

/** 从 AI 返回文本中提取指定区块，兼容 【】、** **、### 三种标题格式 */
function extractSection(text: string, titles: string[]): string {
  // 模式 1：【标题】内容
  for (const t of titles) {
    const reg = new RegExp(`【${t}】([\\s\\S]*?)(?=【|$)`)
    const m = text.match(reg)
    if (m) return m[1].trim()
  }
  // 模式 2：**标题**
  for (const t of titles) {
    const reg = new RegExp(
      `\\*\\*${t}\\*\\*([\\s\\S]*?)(?=\\d+\\.\\s*\\*\\*|\\*\\*[^*]+\\*\\*|$)`
    )
    const m = text.match(reg)
    if (m) return m[1].trim()
  }
  // 模式 3：### 标题
  for (const t of titles) {
    const reg = new RegExp(`###\\s*${t}[\\s\\S]*?(?=###|$)`)
    const m = text.match(reg)
    if (m) return m[0].replace(/###\s*/, '').trim()
  }
  // 模式 4：数字. 标题（如 1. 小说标题）
  for (const t of titles) {
    const reg = new RegExp(`\\d+\\.\\s*${t}[\\s\\S]*?(?=\\d+\\.\\s|$)`)
    const m = text.match(reg)
    if (m) return m[0].replace(/\d+\.\s*/, '').trim()
  }
  // 模式 5：按行模糊匹配
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (titles.some((t) => lines[i].includes(t))) {
      const end = lines.findIndex(
        (l, idx) =>
          idx > i &&
          (l.startsWith('【') ||
            /^\d+\.\s*\*\*/.test(l) ||
            l.startsWith('###') ||
            l.startsWith('**'))
      )
      return lines
        .slice(i + 1, end === -1 ? undefined : end)
        .join('\n')
        .trim()
    }
  }
  return ''
}

/** 从文本块中提取 "Key: Value" 形式的字段 */
function extractField(text: string, keys: string[]): string {
  for (const key of keys) {
    const reg = new RegExp(`${key}[:：]\\s*(.+)`)
    const m = text.match(reg)
    if (m) return m[1].trim()
  }
  return ''
}

// ==========================================
// 各模块解析器
// ==========================================

function parseProtagonist(text: string): Character {
  const name = extractField(text, ['姓名', '名字']) || '主角'
  const age = extractField(text, ['年龄', '年纪']) || '未知'
  const gender = extractField(text, ['性别']) || '未知'
  const appearance =
    extractField(text, ['外貌', '外貌特征', '长相', '身材', '外形']) || text.slice(0, 200)
  const personalityRaw =
    extractField(text, ['性格', '性格核心', '个性', '性格关键词']) || ''
  const personality = personalityRaw
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length < 15)
    .slice(0, 5)
  const background = extractField(text, ['背景', '经历', '背景经历', '身世']) || ''
  const occupation = extractField(text, ['职业', '身份', '工作', '职位']) || ''

  return {
    id: genId(),
    name,
    roleType: 'protagonist',
    avatar: '',
    basicInfo: { age, gender, occupation },
    appearance,
    personality: personality.length ? personality : ['未知'],
    background,
    abilities: extractField(text, ['能力', '技能', '特长', '异能']) || '',
    relationships: [],
    voice: '',
    innerWorld: extractField(text, ['内心', '内心世界', '心理', '内心独白']) || '',
    arc: extractField(text, ['目标', '动机', '核心动机', '追求']) || '',
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function parseSingleSupporting(text: string, idx: number): Character {
  const name = extractField(text, ['姓名', '名字']) || `配角${idx + 1}`
  const age = extractField(text, ['年龄', '年纪']) || '未知'
  const gender = extractField(text, ['性别']) || '未知'
  const appearance =
    extractField(text, ['外貌', '外貌特征', '长相', '身材']) || text.slice(0, 150)
  const personalityRaw =
    extractField(text, ['性格', '个性', '性格关键词']) || ''
  const personality = personalityRaw
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length < 15)
    .slice(0, 5)

  return {
    id: genId(),
    name,
    roleType: 'supporting',
    avatar: '',
    basicInfo: {
      age,
      gender,
      occupation: extractField(text, ['职业', '身份', '工作']) || '',
    },
    appearance,
    personality: personality.length ? personality : ['未知'],
    background: extractField(text, ['背景', '经历']) || '',
    abilities: '',
    relationships: [],
    voice: '',
    innerWorld: '',
    arc:
      extractField(text, ['作用', '在故事中的作用', '与主角的关系', '关系']) ||
      '',
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function parseSupporting(text: string): Character[] {
  if (!text.trim()) return []
  const blocks = text
    .split(/\n(?=\d+[、\.\)])/)
    .filter((b) => b.trim().length > 5)
  if (blocks.length <= 1) {
    return [parseSingleSupporting(text, 0)]
  }
  return blocks.map((b, i) => parseSingleSupporting(b, i))
}

function parseWorldSetting(text: string): WorldSetting {
  const overview = text.slice(0, 600)
  const rulesText =
    extractField(text, ['规则', '关键规则', '禁忌', '法则']) || ''
  const rules = rulesText
    .split('\n')
    .filter((l) => l.trim().length > 3)
    .slice(0, 6)
    .map((l) => ({
      name: l.replace(/^[-\d\.\s•]+/, '').split(/[:：]/)[0] || '规则',
      description: l.replace(/^[-\d\.\s•]+/, ''),
      scope: '',
      limit: '',
      sideEffect: '',
    }))

  const locText =
    extractField(text, ['场景', '地点', '特色场景', '地理']) || ''
  const locations = locText
    .split('\n')
    .filter((l) => l.trim().length > 3)
    .slice(0, 6)
    .map((l) => ({
      name: l.replace(/^[-\d\.\s•]+/, '').split(/[:：]/)[0] || '地点',
      type: '场景',
      description: l.replace(/^[-\d\.\s•]+/, ''),
      atmosphere: '',
      scenes: [] as string[],
    }))

  return {
    id: genId(),
    name: '世界观设定',
    worldType: 'custom',
    description: overview.slice(0, 200),
    overview,
    rules,
    locations,
    timeline: [],
    society: extractField(text, ['社会', '社会结构', '势力', '势力划分']) || '',
    culture: extractField(text, ['文化', '风俗', '传统']) || '',
    economy: extractField(text, ['经济', '资源']) || '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function parseChapters(
  text: string
): Array<{ title: string; summary: string }> {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
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

function parsePlotLine(
  text: string,
  chapters: Array<{ title: string; summary: string }>
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
    description: text.slice(0, 1000),
    events,
    relatedCharacters: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

/** 核心解析入口：将 AI 原始返回文本解析为结构化结果 */
function parseDeduceResult(raw: string): OneClickResult {
  const title =
    extractSection(raw, ['小说标题', '标题']).split('\n')[0].trim() ||
    '未命名小说'
  const summary =
    extractSection(raw, ['小说简介', '简介']).slice(0, 1000) || ''
  const protagonistText = extractSection(raw, [
    '主角设定',
    '主角',
    '主人公设定',
  ])
  const supportingText = extractSection(raw, [
    '配角设定',
    '配角',
    '主要配角设定',
  ])
  const worldText = extractSection(raw, [
    '世界观',
    '世界观与氛围',
    '世界设定',
  ])
  const plotText = extractSection(raw, [
    '感情/肉欲发展线',
    '感情发展线',
    '肉欲发展线',
    '冲突线',
    '剧情线',
    '发展线',
    '冲突与情感',
  ])
  const chapterText = extractSection(raw, ['章节目录', '目录', '章节规划'])
  const firstChapter =
    extractSection(raw, ['第一章正文', '第一章', '正文']).slice(0, 12000) || ''

  const protagonist = parseProtagonist(protagonistText)
  const supporting = parseSupporting(supportingText)
  const worldSetting = parseWorldSetting(worldText)
  const chapters = parseChapters(chapterText)
  const plotLine = parsePlotLine(plotText, chapters)

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

// ==========================================
// 主组件
// ==========================================

export default function DeducePage() {
  const navigate = useNavigate()

  const aiModels = useAppStore((s) => s.aiModels)
  const currentModel = useAppStore((s) => s.currentModel)
  const currentNovel = useAppStore((s) => s.currentNovel)
  const resetAll = useAppStore((s) => s.resetAll)
  const adultMode = useAppStore((s) => s.adultMode)
  const importFromDeduce = useAppStore((s) => s.importFromDeduce)
  const addLog = useAppStore((s) => s.addLog)
  const updateChapter = useAppStore((s) => s.updateChapter)

  const [theme, setTheme] = useState('')
  const [selectedModelId, setSelectedModelId] = useState(
    currentModel?.id ?? ''
  )
  const [length, setLength] = useState<NovelLength>('30000')
  const [maleCount, setMaleCount] = useState(1)
  const [femaleCount, setFemaleCount] = useState(2)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [streamText, setStreamText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const streamRef = useRef('')

  const handleReDeduce = () => {
    if (!confirm('重新推导会清空当前所有数据（角色、章节、世界观等），确定吗？')) return
    resetAll()
    setTheme('')
    setProgress(0)
    setProgressLabel('')
    setStreamText('')
    setError(null)
  }

  const selectedModel =
    aiModels.find((m) => m.id === selectedModelId) || currentModel

  const handleDeduce = useCallback(async () => {
    if (!theme.trim()) {
      setError('请输入主题或关键词')
      return
    }
    if (!selectedModel) {
      setError('请先配置并选择一个 AI 模型')
      return
    }

    setError(null)
    setLoading(true)
    setProgress(5)
    setProgressLabel('正在连接 AI 模型...')
    setStreamText('')
    streamRef.current = ''

    try {
      // ---- 加载并提取提示词 ----
      const fullText = loadPrompt('prompts')
      if (!fullText) {
        throw new Error('提示词文件加载失败，请检查 prompts.md 是否存在')
      }

      // 提取系统提示词（成人模式 / 普通模式）
      const systemPattern = adultMode
        ? /## 系统提示词：成人情色小说专用（强烈推荐固定使用）\s*([\s\S]*?)(?=\n\s*---|\n\s*## |$)/
        : /## 系统提示词：通用小说创作大师\s*([\s\S]*?)(?=\n\s*---|\n\s*## |$)/
      const systemMatch = fullText.match(systemPattern)
      const systemPrompt = systemMatch
        ? systemMatch[1].trim()
        : adultMode
          ? '你是一位顶尖的中文成人情色文学作家，擅长创作极致沉浸式成人小说。'
          : '你是一位顶级小说创作大师，精通各类小说体裁的创作技巧。'

      // 提取用户提示词模板
      const userPattern = adultMode
        ? /## 成人情色小说 - 一键推导生成用户提示词模板\s*([\s\S]*?)(?=\n\s*---|\n\s*## 成人情色小说 - 自动续写|$)/
        : /## 一键推导生成 - 用户提示词模板\s*([\s\S]*?)(?=\n\s*---|\n\s*## 续写提示词|$)/
      const userMatch = fullText.match(userPattern)
      let userTemplate = userMatch ? userMatch[1].trim() : ''

      if (!userTemplate) {
        throw new Error('未能从提示词文件中提取到用户模板')
      }

      // 变量映射
      const lengthLabelMap: Record<string, string> = {
        '3000': '3,000字',
        '30000': '3万字',
        '100000': '10万字',
        '500000': '50万字',
        '1000000': '100万字',
      }
      const chapterCountMap: Record<string, string> = {
        '3000': '5-8章',
        '30000': '15-25章',
        '100000': '30-50章',
        '500000': '80-120章',
        '1000000': '150-300章',
      }

      const vars: Record<string, string> = {
        theme: theme.trim(),
        length: lengthLabelMap[length],
        wordCount: length,
        maleCount: String(maleCount),
        femaleCount: String(femaleCount),
        chapterCount: chapterCountMap[length],
        characterCount: String(maleCount + femaleCount),
        modelName: selectedModel.name,
        selectedTags: '无',
        tagsSection: '',
      }

      let userPrompt = userTemplate
      for (const [key, value] of Object.entries(vars)) {
        userPrompt = userPrompt.split(`{${key}}`).join(value)
      }

      // ---- 调用 AI 流式生成 ----
      const fullResult = await callAIModelStream(
        selectedModel,
        systemPrompt,
        userPrompt,
        (text) => {
          streamRef.current = text
          const phase = getProgressPhase(text.length)
          setProgress(phase.percent)
          setProgressLabel(phase.label)
          setStreamText(text)
        }
      )

      // ---- 解析结果 ----
      setProgress(95)
      setProgressLabel('正在解析 AI 返回结果...')
      const result = parseDeduceResult(fullResult)

      if (!result.title || result.title === '未命名小说') {
        throw new Error('未能从 AI 返回中解析出有效标题，请检查模型输出格式')
      }

      // ---- 存入全局 Store ----
      setProgress(98)
      setProgressLabel('正在保存到项目...')
      importFromDeduce(result)

      // 将第一章正文写入 store
      const storeState = useAppStore.getState()
      const firstCh = storeState.chapters.slice().sort((a, b) => a.order - b.order)[0]
      if (firstCh && result.firstChapter) {
        updateChapter(firstCh.id, { content: result.firstChapter })
      }

      // 等待 React 状态更新完成
      await new Promise((resolve) => setTimeout(resolve, 150))

      setProgress(100)
      setProgressLabel('推导完成！即将跳转到剧情可视化...')
      setLoading(false)

      addLog({ type: 'success', message: `一键推导完成：${result.title}`, detail: `主题：${theme.trim()}，共生成 ${result.chapters.length} 章，角色 ${1 + result.supporting.length} 人` })

      // 安全跳转
      setTimeout(() => navigate('/plotview'), 300)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误'
      setError(`推导失败：${msg}`)
      addLog({ type: 'error', message: '一键推导失败', detail: msg })
      setLoading(false)
    }
  }, [
    theme,
    selectedModel,
    adultMode,
    length,
    maleCount,
    femaleCount,
    importFromDeduce,
    addLog,
    updateChapter,
    navigate,
  ])

  // ==========================================
  // 渲染
  // ==========================================
  return (
    <PageWrapper
      title="一键推导"
      subtitle={currentNovel ? `当前项目：${currentNovel.title}` : '输入主题或关键词，AI 将为你生成完整的小说结构、角色设定、世界观和章节目录'}
    >
      {/* 重新推导提示 */}
      {currentNovel && (
        <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#818cf8', fontSize: '14px' }}>⚠️ 已有项目数据，重新推导将覆盖现有内容</span>
          <button onClick={handleReDeduce} style={{ padding: '6px 16px', background: '#ef4444', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>
            🔄 重新推导
          </button>
        </div>
      )}
      {/* 输入面板 */}
      <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* 主题输入 */}
        <div>
          <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '8px' }}>
            主题 / 关键词
            <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>
          </div>
          <input
            type="text"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="例如：都市异能、穿越修仙、办公室恋情、末世求生..."
            style={{ width: '100%', padding: '10px 14px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* 参数网格 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
          {/* AI 模型 */}
          <div>
            <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '8px' }}>
              AI 模型
              <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>
            </div>
            <select
              value={selectedModelId}
              onChange={(e) => setSelectedModelId(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
            >
              {aiModels.length === 0 && (
                <option value="">未配置模型</option>
              )}
              {aiModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* 目标长度 */}
          <div>
            <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '8px' }}>目标长度</div>
            <select
              value={length}
              onChange={(e) => setLength(e.target.value as NovelLength)}
              style={{ width: '100%', padding: '10px 14px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
            >
              <option value="3000">3千字（短篇）</option>
              <option value="30000">3万字（中篇）</option>
              <option value="100000">10万字（长篇）</option>
              <option value="500000">50万字（超长篇）</option>
              <option value="1000000">100万字（史诗）</option>
            </select>
          </div>

          {/* 男角色 */}
          <div>
            <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '8px' }}>男角色数</div>
            <input
              type="number"
              min={0}
              max={10}
              value={maleCount}
              onChange={(e) =>
                setMaleCount(
                  Math.max(0, Math.min(10, Number(e.target.value)))
                )
              }
              style={{ width: '100%', padding: '10px 14px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* 女角色 */}
          <div>
            <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '8px' }}>女角色数</div>
            <input
              type="number"
              min={0}
              max={10}
              value={femaleCount}
              onChange={(e) =>
                setFemaleCount(
                  Math.max(0, Math.min(10, Number(e.target.value)))
                )
              }
              style={{ width: '100%', padding: '10px 14px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {/* 成人模式提示 */}
        {adultMode && (
          <div style={{ background: '#6366f110', border: '1px solid #6366f140', borderRadius: '8px', padding: '12px 16px', fontSize: '14px', color: '#6366f1' }}>
            当前处于成人模式，AI 将使用成人情色小说专用提示词进行推导
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div style={{ background: '#ef444410', border: '1px solid #ef444440', borderRadius: '8px', padding: '12px 16px', fontSize: '14px', color: '#ef4444' }}>
            {error}
          </div>
        )}

        {/* 推导按钮 */}
        <button
          onClick={handleDeduce}
          disabled={loading}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: loading ? '#6366f180' : '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px 16px', fontSize: '14px', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? (
            <>
              <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid #ffffff40', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              推导中...
            </>
          ) : (
            <>
              <span>⚡</span>
              一键推导
            </>
          )}
        </button>
      </div>

      {/* 进度面板 */}
      {loading && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '14px' }}>
            <span style={{ color: '#aaa' }}>{progressLabel}</span>
            <span style={{ color: '#6366f1', fontFamily: 'monospace' }}>{progress}%</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: '#0f0f0f', borderRadius: '9999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#6366f1', borderRadius: '9999px', width: `${progress}%` }} />
          </div>
          {/* 流式预览 */}
          {streamText.length > 0 && (
            <div>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>实时输出预览</div>
              <div style={{ background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '16px', maxHeight: '256px', overflow: 'auto', fontSize: '12px', color: '#aaa', whiteSpace: 'pre-wrap', fontFamily: 'monospace', lineHeight: 1.6 }}>
                {streamText.slice(-2000)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 功能说明卡片 */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px' }}>
            <div style={{ color: '#6366f1', fontSize: '18px', marginBottom: '8px' }}>📝</div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#ccc' }}>智能解析</div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              自动提取标题、角色、世界观、冲突线、感情线、肉欲线、章节目录
            </div>
          </div>
          <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px' }}>
            <div style={{ color: '#6366f1', fontSize: '18px', marginBottom: '8px' }}>🗂️</div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#ccc' }}>自动归档</div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              推导结果自动存入全局项目，无需手动复制粘贴
            </div>
          </div>
          <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px' }}>
            <div style={{ color: '#6366f1', fontSize: '18px', marginBottom: '8px' }}>🚀</div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#ccc' }}>一键跳转</div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              完成后自动进入剧情观可视化页面展示完整结构
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  )
}
