/**
 * 一键推导页面 — 全面重写版
 *
 * 升级内容：
 * - Framer Motion 进场/退场动画
 * - 标准/成人模式切换（带图标+颜色）
 * - 主题模板面板（6组预设）
 * - 5档长度可视化卡片
 * - 角色数量 +/- 按钮组
 * - 流式输出打字机光标+实时字数
 * - 结果双视图（卡片/文档）
 * - 可展开卡片（复制/编辑/导出/展开）
 * - handleSave 修复：requestAnimationFrame + 合并首章
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store'
import PageWrapper from '../../components/PageWrapper'
import { loadPrompt } from '../../utils/promptLoader'
import { mapOldResultToCurrent } from '../../utils/deduceTransformer'
import type {
  AIModel,
  OneClickResult,
  NovelLength,
  Novel,
  Character,
  WorldSetting,
  Chapter,
  PlotLine,
} from '../../../config/types'
import {
  LENGTH_OPTIONS,
  LENGTH_LABEL_MAP,
  CHAPTER_COUNT_MAP,
  THEME_TEMPLATES,
  RESULT_FIELDS,
  getProgressPhase,
  FEATURE_CARDS,
} from './constants'

// ==========================================
// 动画配置
// ==========================================

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.3 },
}

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.06 } },
}

const staggerItem = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
}

// ==========================================
// AI 流式调用
// ==========================================

async function callAIModelStream(
  model: AIModel,
  systemPrompt: string,
  userPrompt: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal
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
    signal,
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
// 结果字段内容提取辅助
// ==========================================

function getResultFieldContent(result: OneClickResult, key: string): { text: string; wordCount: number } {
  let text = ''
  switch (key) {
    case 'title':
      text = result.title || ''
      break
    case 'summary':
      text = result.summary || ''
      break
    case 'protagonist':
      text = result.protagonist
        ? `姓名：${result.protagonist.name}\n性别：${result.protagonist.basicInfo?.gender || '未知'}\n年龄：${result.protagonist.basicInfo?.age || '未知'}\n外貌：${result.protagonist.appearance || ''}\n性格：${(result.protagonist.personality || []).join('、')}\n背景：${result.protagonist.background || ''}\n能力：${result.protagonist.abilities || ''}\n目标：${result.protagonist.arc || ''}`
        : ''
      break
    case 'supporting':
      text = (result.supporting || [])
        .map((c, i) => `${i + 1}. ${c.name}（${c.roleType === 'antagonist' ? '反派' : '配角'}）\n   性别：${c.basicInfo?.gender || '未知'}，年龄：${c.basicInfo?.age || '未知'}\n   外貌：${c.appearance || ''}\n   性格：${(c.personality || []).join('、')}\n   背景：${c.background || ''}`)
        .join('\n\n')
      break
    case 'worldview':
      text = result.worldSetting
        ? `概述：${result.worldSetting.overview || result.worldSetting.description || ''}\n\n规则：\n${(result.worldSetting.rules || []).map((r, i) => `${i + 1}. ${r.name}：${r.description}`).join('\n')}\n\n地点：\n${(result.worldSetting.locations || []).map((l, i) => `${i + 1}. ${l.name}（${l.type}）：${l.description}`).join('\n')}\n\n时间线：\n${(result.worldSetting.timeline || []).map((t, i) => `${i + 1}. ${t.era} - ${t.title}：${t.description}`).join('\n')}`
        : ''
      break
    case 'emotionalLine':
      text = result.plotLine?.description || ''
      break
    case 'chapterOutline':
      text = result.plotLine?.events
        ? result.plotLine.events.map((e, i: number) => `${i + 1}. ${e.title}：${e.description || ''}`).join('\n')
        : ''
      break
    case 'chapterList':
      text = (result.chapters || [])
        .map((ch, i) => `第${i + 1}章 ${ch.title}${ch.summary ? `：${ch.summary}` : ''}`)
        .join('\n')
      break
    case 'firstChapter':
      text = result.firstChapter || ''
      break
    case 'meta':
      text = `角色数：${1 + (result.supporting?.length || 0)}\n章节数：${result.chapters?.length || 0}\n首章字数：${result.firstChapter?.length || 0}\n世界观规则：${result.worldSetting?.rules?.length || 0}\n世界观地点：${result.worldSetting?.locations?.length || 0}`
      break
  }
  return { text, wordCount: text.length }
}

// ==========================================
// 从 store 实时重建 OneClickResult（用于查看已保存内容）
// ==========================================

function rebuildResultFromStore(
  novel: Novel,
  allCharacters: Character[],
  allWorlds: WorldSetting[],
  allChapters: Chapter[],
  allPlotLines: PlotLine[],
): OneClickResult | null {
  const now = Date.now()
  const novelChars = allCharacters.filter((c) => novel.characters.includes(c.id))
  const protagonist = novelChars.find((c) => c.roleType === 'protagonist') || {
    id: '', name: '未命名主角', roleType: 'protagonist' as const, avatar: '',
    basicInfo: { age: '', gender: '', occupation: '' },
    appearance: '', personality: [], background: '', abilities: '',
    relationships: [], voice: '', innerWorld: '', arc: '', tags: [],
    createdAt: now, updatedAt: now,
  }
  const supporting = novelChars.filter((c) => c.roleType !== 'protagonist')
  const novelWorlds = allWorlds.filter((w) => novel.worldSettings.includes(w.id))
  const novelChapters = allChapters.filter((ch) => novel.chapters.includes(ch.id))
  const novelPlotLines = allPlotLines.filter((p) => novel.plotLines.includes(p.id))
  return {
    title: novel.title,
    summary: novel.summary,
    protagonist,
    supporting,
    worldSetting: novelWorlds[0] || {
      id: '', name: '', type: 'fantasy' as const, description: '', overview: '',
      rules: [], locations: [], timeline: [], tags: [], createdAt: now, updatedAt: now,
    },
    plotLine: novelPlotLines[0] || {
      id: '', name: '', description: '', events: [], createdAt: now, updatedAt: now,
    },
    chapters: novelChapters.map((ch) => ({ title: ch.title, summary: ch.summary || '' })),
    firstChapter: novelChapters[0]?.content || '',
  }
}

// ==========================================
// 主组件
// ==========================================

export default function DeducePage() {
  const navigate = useNavigate()

  // Store
  const aiModels = useAppStore((s) => s.aiModels)
  const currentModel = useAppStore((s) => s.currentModel)
  const currentNovel = useAppStore((s) => s.currentNovel)
  const setNovel = useAppStore((s) => s.setNovel)
  const adultMode = useAppStore((s) => s.adultMode)
  const toggleAdultMode = useAppStore((s) => s.toggleAdultMode)
  const importFromDeduce = useAppStore((s) => s.importFromDeduce)
  const addLog = useAppStore((s) => s.addLog)
  const addMemory = useAppStore((s) => s.addMemory)
  const currentNovelId = useAppStore((s) => s.currentNovel?.id ?? null)
  const lastDeduceResult = useAppStore((s) => s.lastDeduceResult)
  const setLastDeduceResult = useAppStore((s) => s.setLastDeduceResult)
  const allCharacters = useAppStore((s) => s.characters)
  const allWorlds = useAppStore((s) => s.worldSettings)
  const allChapters = useAppStore((s) => s.chapters)
  const allPlotLines = useAppStore((s) => s.plotLines)

  // 表单状态
  const [theme, setTheme] = useState('')
  const [selectedModelId, setSelectedModelId] = useState(currentModel?.id ?? '')
  const [length, setLength] = useState<NovelLength>('30000')
  const [maleCount, setMaleCount] = useState(1)
  const [femaleCount, setFemaleCount] = useState(2)
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  // 生成状态
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [streamText, setStreamText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // 结果状态
  const [result, setResult] = useState<OneClickResult | null>(null)
  const [viewMode, setViewMode] = useState<'card' | 'doc'>('card')
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // 模板面板
  const [showTemplates, setShowTemplates] = useState(false)

  const streamRef = useRef('')
  const resultRef = useRef<OneClickResult | null>(null)

  // 同步 result 到 ref
  useEffect(() => {
    resultRef.current = result
  }, [result])

  // 页面加载时：如果上次推导结果存在，自动恢复显示
  // 修复：将 lastDeduceResult 加入依赖数组，确保 zustand persist 异步恢复后能触发
  useEffect(() => {
    if (lastDeduceResult && !result && !loading) {
      setResult(lastDeduceResult)
      setExpandedKeys(new Set(['title', 'summary']))
    }
  }, [lastDeduceResult])

  const selectedModel = aiModels.find((m) => m.id === selectedModelId) || currentModel

  // ==========================================
  // 展开/折叠/复制/编辑 操作
  // ==========================================

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleCopyField = async (key: string) => {
    if (!result) return
    const { text } = getResultFieldContent(result, key)
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch (err) {
      console.error('复制失败', err)
    }
  }

  const handleStartEdit = (key: string) => {
    if (!result) return
    const { text } = getResultFieldContent(result, key)
    setEditingKey(key)
    setEditingText(text)
  }

  const handleSaveEdit = () => {
    if (!result || !editingKey) return
    // 根据字段将编辑内容回写到 result
    const updated = { ...result }
    switch (editingKey) {
      case 'title':
        updated.title = editingText.trim() || updated.title
        break
      case 'summary':
        updated.summary = editingText
        break
      case 'protagonist': {
        // 将编辑后的纯文本重新解析为结构化字段
        const lines = editingText.split('\n')
        const p = { ...updated.protagonist }
        for (const line of lines) {
          const m = line.match(/^([^：:]+)[：:]\s*(.*)$/)
          if (!m) continue
          const [, key, val] = m
          const v = val.trim()
          if (!v) continue
          if (key.includes('姓名') || key.includes('名字')) p.name = v
          else if (key.includes('性别')) p.basicInfo = { ...p.basicInfo, gender: v }
          else if (key.includes('年龄')) p.basicInfo = { ...p.basicInfo, age: v }
          else if (key.includes('外貌')) p.appearance = v
          else if (key.includes('性格')) p.personality = v.split(/[,，、;；]/).map(s => s.trim()).filter(s => s.length >= 2 && s.length <= 20)
          else if (key.includes('背景')) p.background = v
          else if (key.includes('能力')) p.abilities = v
          else if (key.includes('目标')) p.arc = v
        }
        updated.protagonist = p
        break
      }
      case 'supporting': {
        // 配角编辑文本格式："1. 名字\n   性别：...\n   外貌：..."
        // 按空行分割每个角色，再逐行解析
        const entries = editingText.split(/\n\s*\n/).filter(Boolean)
        const newSupporting = entries.map((entry, idx) => {
          const lines = entry.split('\n').map(l => l.trim()).filter(Boolean)
          const existing = updated.supporting?.[idx]
          const c: typeof existing = existing
            ? { ...existing }
            : { id: `sup_${Date.now()}_${idx}`, name: '', roleType: 'supporting', avatar: '', basicInfo: { age: '', gender: '', occupation: '' }, appearance: '', personality: [], background: '', abilities: '', relationships: [], voice: '', innerWorld: '', arc: '', tags: [], createdAt: Date.now(), updatedAt: Date.now() }
          for (const line of lines) {
            const m = line.match(/^(?:\d+[\.、．]\s*)?([^：:]+)[：:]\s*(.*)$/)
            if (!m) continue
            const [, key, val] = m
            const v = val.trim()
            if (!v) continue
            if (key.includes('姓名') || key.includes('名字')) c.name = v
            else if (key.includes('性别')) c.basicInfo = { ...c.basicInfo, gender: v }
            else if (key.includes('年龄')) c.basicInfo = { ...c.basicInfo, age: v }
            else if (key.includes('外貌')) c.appearance = v
            else if (key.includes('性格')) c.personality = v.split(/[,，、;；]/).map(s => s.trim()).filter(s => s.length >= 2 && s.length <= 20)
            else if (key.includes('背景')) c.background = v
            else if (key.includes('能力')) c.abilities = v
            else if (key.includes('目标')) c.arc = v
            else if (key.includes('关系')) {
              c.relationships = [{ targetId: '', targetName: '主角', type: v, description: '' }]
            }
          }
          return c
        })
        updated.supporting = newSupporting
        break
      }
      case 'worldview': {
        const w = { ...updated.worldSetting }
        const lines = editingText.split('\n')
        for (const line of lines) {
          const m = line.match(/^([^：:]+)[：:]\s*(.*)$/)
          if (!m) continue
          const [, key, val] = m
          const v = val.trim()
          if (!v) continue
          if (key.includes('概述')) w.overview = v
          else if (key.includes('规则')) {
            w.rules = v.split('\n').map(r => r.trim()).filter(r => r.length > 3).slice(0, 8).map(r => ({
              name: r.replace(/^[-\d\.\s•]+/, '').split(/[:：]/)[0] || '规则',
              description: r.replace(/^[-\d\.\s•]+/, ''),
              scope: '', limit: '', sideEffect: '',
            }))
          }
        }
        updated.worldSetting = w
        break
      }
      case 'emotionalLine':
        updated.plotLine = updated.plotLine
          ? { ...updated.plotLine, description: editingText }
          : { id: '', type: 'main' as const, name: '', description: editingText, events: [], relatedCharacters: [], createdAt: Date.now(), updatedAt: Date.now() }
        break
      case 'chapterOutline':
        updated.plotLine = updated.plotLine
          ? { ...updated.plotLine, events: editingText.split('\n').filter(l => l.trim()).map((l, i) => ({
              id: `evt_${i}`, title: l.replace(/^[-\d\.\s•]+/, '').split(/[:：]/)[0] || l,
              description: l, order: i, chapterId: null,
            })) }
          : { id: '', type: 'main' as const, name: '', description: '', events: [], relatedCharacters: [], createdAt: Date.now(), updatedAt: Date.now() }
        break
      case 'chapterList': {
        const chs: Array<{ title: string; summary: string }> = []
        const lines = editingText.split('\n').map(l => l.trim()).filter(Boolean)
        for (const line of lines) {
          const m = line.match(/(?:第\s*\d+\s*章|第\s*[一二三四五六七八九十]+\s*章)?\s*[:：]?\s*(.+)/)
          if (m) {
            const parts = m[1].split(/[:：]/)
            chs.push({ title: parts[0].trim(), summary: parts[1]?.trim() || '' })
          }
        }
        updated.chapters = chs.length > 0 ? chs : updated.chapters
        break
      }
      case 'firstChapter':
        updated.firstChapter = editingText
        break
    }
    setResult(updated)
    setLastDeduceResult(updated)
    setEditingKey(null)
    setEditingText('')
  }

  const handleCancelEdit = () => {
    setEditingKey(null)
    setEditingText('')
  }

  const handleExportField = (key: string) => {
    if (!result) return
    const { text } = getResultFieldContent(result, key)
    const field = RESULT_FIELDS.find((f) => f.key === key)
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${result.title || '小说'}_${field?.label || key}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ==========================================
  // 推导 & 保存
  // ==========================================

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
    setResult(null)
    streamRef.current = ''

    const startTime = Date.now()

    // 开始生成日志
    addLog({
      type: 'info',
      message: '开始一键推导',
      detail: `模型: ${selectedModel.name}, 主题: ${theme.trim()}, 长度: ${LENGTH_LABEL_MAP[length]}, 模式: ${adultMode ? '成人' : '标准'}`,
    })

    const abortController = new AbortController()
    abortRef.current = abortController

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
      const vars: Record<string, string> = {
        theme: theme.trim(),
        length: LENGTH_LABEL_MAP[length],
        wordCount: length,
        maleCount: String(maleCount),
        femaleCount: String(femaleCount),
        chapterCount: CHAPTER_COUNT_MAP[length],
        characterCount: String(maleCount + femaleCount),
        modelName: selectedModel.name,
        selectedTags: selectedTags.length > 0 ? selectedTags.join('、') : '无',
        tagsSection: selectedTags.length > 0 ? `\n标签：${selectedTags.join('、')}` : '',
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
        },
        abortController.signal,
      )

      // ---- 解析结果（使用 mapOldResultToCurrent）----
      setProgress(95)
      setProgressLabel('正在解析 AI 返回结果...')
      const deduceInput = mapOldResultToCurrent(fullResult)
      const parsedResult: OneClickResult = {
        title: deduceInput.title,
        summary: deduceInput.summary,
        protagonist: deduceInput.protagonist,
        supporting: deduceInput.supporting,
        worldSetting: deduceInput.worldSetting,
        plotLine: deduceInput.plotLine,
        chapters: deduceInput.chapters,
        firstChapter: deduceInput.firstChapter || '',
      }

      if (!parsedResult.title || parsedResult.title === '未命名小说') {
        throw new Error('未能从 AI 返回中解析出有效标题，请检查模型输出格式')
      }

      setResult(parsedResult)
      setLastDeduceResult(parsedResult)
      // 默认展开标题和简介
      setExpandedKeys(new Set(['title', 'summary']))

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      const totalChars = fullResult.length
      addLog({
        type: 'success',
        message: `推导完成：${parsedResult.title}`,
        detail: `字数: ${totalChars.toLocaleString()}, 耗时: ${elapsed}s, 章节: ${parsedResult.chapters.length}, 角色: ${1 + parsedResult.supporting.length}`,
      })
      addMemory({
        id: `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'llm',
        content: `一键推导完成：《${parsedResult.title}》\n主题：${theme.trim()}\n生成 ${parsedResult.chapters.length} 章，${1 + parsedResult.supporting.length} 个角色`,
        source: '一键推导',
        tags: ['推导', 'AI生成'],
        modelName: selectedModel?.name ?? null,
        projectId: currentNovelId,
        timestamp: Date.now(),
        duration: Number(elapsed) * 1000,
      })
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        addLog({ type: 'info', message: '用户手动停止推导', detail: '' })
      } else {
        const msg = err instanceof Error ? err.message : '未知错误'
        setError(`推导失败：${msg}`)
        addLog({ type: 'error', message: '一键推导失败', detail: msg })
      }
    } finally {
      setLoading(false)
      setProgress(100)
      abortRef.current = null
    }
  }, [theme, selectedModel, adultMode, length, maleCount, femaleCount, selectedTags, addLog, setLastDeduceResult, currentNovelId, addMemory])

  const handleStop = () => {
    abortRef.current?.abort()
  }

  // 5.7 handleSave 修复：使用 requestAnimationFrame 确保状态已更新，合并首章内容
  const handleSave = () => {
    const currentResult = resultRef.current
    if (!currentResult) return

    // 使用 requestAnimationFrame 确保 React 状态已完全更新
    requestAnimationFrame(() => {
      const r = resultRef.current
      if (!r) return

      // 合并首章内容到 result 再导入
      importFromDeduce(r, r.firstChapter || '')

      addLog({
        type: 'success',
        message: `项目已保存：${r.title}`,
        detail: `共 ${r.chapters?.length || 0} 章，${1 + (r.supporting?.length || 0)} 角色`,
      })
      addMemory({
        id: `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'auto',
        content: `保存推导项目：《${r.title}》`,
        source: '一键推导保存',
        tags: ['保存', '项目'],
        modelName: null,
        projectId: currentNovelId,
        timestamp: Date.now(),
        duration: null,
      })

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    })
  }

  const handleReDeduce = () => {
    if (!confirm('重新推导会清空当前所有项目数据（角色、章节、世界观等），确定吗？')) return
    // 只重置项目相关状态，保留 AI 模型、设置、日志等全局配置
    setNovel(null)
    setTheme('')
    setSelectedModelId(currentModel?.id ?? '')
    setLength('30000')
    setMaleCount(1)
    setFemaleCount(2)
    setSelectedTags([])
    setProgress(0)
    setProgressLabel('')
    setStreamText('')
    setError(null)
    setResult(null)
  }

  // 计算结果总字数
  const totalWordCount = result
    ? RESULT_FIELDS.reduce((sum, f) => sum + getResultFieldContent(result, f.key).wordCount, 0)
    : 0

  // ==========================================
  // 渲染
  // ==========================================
  return (
    <PageWrapper
      title="一键推导"
      subtitle={currentNovel ? `当前项目：${currentNovel.title}` : '输入主题或关键词，AI 将为你生成完整的小说结构、角色设定、世界观和章节目录'}
      actions={
        <motion.button
          {...fadeInUp}
          onClick={toggleAdultMode}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            background: adultMode ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.1)',
            border: `1px solid ${adultMode ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.2)'}`,
            borderRadius: '8px',
            color: adultMode ? '#ef4444' : '#6366f1',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {adultMode ? '🔥 成人模式' : '📖 标准模式'}
        </motion.button>
      }
    >
      {      result ? (
        /* ========== 结果展示区域 ========== */
        <motion.div {...fadeInUp} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 保存成功提示 */}
          <AnimatePresence>
            {saveSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{
                  background: 'rgba(34,197,94,0.1)',
                  border: '1px solid rgba(34,197,94,0.3)',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  color: '#4ade80',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>✓</span>
                <span>项目已保存至全局数据，可直接在当前页面继续查看或编辑</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 返回 + 视图切换 + 总字数 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                onClick={() => {
                  setResult(null)
                  setExpandedKeys(new Set())
                  setEditingKey(null)
                }}
                style={{
                  padding: '6px 14px',
                  background: 'transparent',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  color: '#888',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                ← 返回
              </button>
              <button
                onClick={() => setViewMode('card')}
                style={{
                  padding: '6px 14px',
                  background: viewMode === 'card' ? 'rgba(99,102,241,0.15)' : 'transparent',
                  border: `1px solid ${viewMode === 'card' ? 'rgba(99,102,241,0.3)' : '#2a2a2a'}`,
                  borderRadius: '6px',
                  color: viewMode === 'card' ? '#6366f1' : '#888',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                🃏 卡片视图
              </button>
              <button
                onClick={() => setViewMode('doc')}
                style={{
                  padding: '6px 14px',
                  background: viewMode === 'doc' ? 'rgba(99,102,241,0.15)' : 'transparent',
                  border: `1px solid ${viewMode === 'doc' ? 'rgba(99,102,241,0.3)' : '#2a2a2a'}`,
                  borderRadius: '6px',
                  color: viewMode === 'doc' ? '#6366f1' : '#888',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                📄 文档视图
              </button>
            </div>
            <span style={{ fontSize: '13px', color: '#888' }}>
              总字数 <span style={{ color: '#6366f1', fontWeight: 600 }}>{totalWordCount.toLocaleString()}</span>
            </span>
          </div>

          <AnimatePresence mode="wait">
            {viewMode === 'card' ? (
              /* ---- 卡片视图 ---- */
              <motion.div
                key="card"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
              >
                {RESULT_FIELDS.map((field) => {
                  const { text, wordCount } = getResultFieldContent(result, field.key)
                  if (!text) return null
                  const isExpanded = expandedKeys.has(field.key)
                  const isEditing = editingKey === field.key
                  const isCopied = copiedKey === field.key

                  return (
                    <motion.div
                      key={field.key}
                      {...staggerItem}
                      style={{
                        background: '#1a1a1a',
                        border: `1px solid ${isExpanded ? field.color + '40' : '#2a2a2a'}`,
                        borderRadius: '10px',
                        overflow: 'hidden',
                        transition: 'border-color 0.2s',
                      }}
                    >
                      {/* 标题栏 */}
                      <div
                        onClick={() => toggleExpand(field.key)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '12px 16px',
                          cursor: 'pointer',
                          gap: '10px',
                        }}
                      >
                        <span style={{ fontSize: '16px' }}>{field.icon}</span>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: field.color, flex: 1 }}>
                          {field.label}
                        </span>
                        <span style={{ fontSize: '12px', color: '#666' }}>
                          {wordCount.toLocaleString()} 字
                        </span>
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{ display: 'flex', gap: '4px' }}
                        >
                          <button
                            onClick={() => handleCopyField(field.key)}
                            style={{
                              padding: '3px 8px',
                              background: isCopied ? 'rgba(34,197,94,0.15)' : 'transparent',
                              border: '1px solid #333',
                              borderRadius: '4px',
                              color: isCopied ? '#4ade80' : '#666',
                              fontSize: '11px',
                              cursor: 'pointer',
                            }}
                          >
                            {isCopied ? '✓' : '复制'}
                          </button>
                          <button
                            onClick={() => handleStartEdit(field.key)}
                            style={{
                              padding: '3px 8px',
                              background: 'transparent',
                              border: '1px solid #333',
                              borderRadius: '4px',
                              color: '#666',
                              fontSize: '11px',
                              cursor: 'pointer',
                            }}
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => handleExportField(field.key)}
                            style={{
                              padding: '3px 8px',
                              background: 'transparent',
                              border: '1px solid #333',
                              borderRadius: '4px',
                              color: '#666',
                              fontSize: '11px',
                              cursor: 'pointer',
                            }}
                          >
                            导出
                          </button>
                        </div>
                        <motion.span
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          style={{ fontSize: '12px', color: '#666' }}
                        >
                          ▼
                        </motion.span>
                      </div>

                      {/* 内容区 - AnimatePresence 高度动画 */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            style={{ overflow: 'hidden' }}
                          >
                            <div style={{
                              padding: '0 16px 12px 16px',
                              borderTop: '1px solid #2a2a2a',
                            }}>
                              {isEditing ? (
                                <div style={{ marginTop: '10px' }}>
                                  <textarea
                                    value={editingText}
                                    onChange={(e) => setEditingText(e.target.value)}
                                    style={{
                                      width: '100%',
                                      minHeight: '120px',
                                      padding: '10px',
                                      background: '#0f0f0f',
                                      border: '1px solid #3a3a3a',
                                      borderRadius: '6px',
                                      color: '#e0e0e0',
                                      fontSize: '13px',
                                      lineHeight: 1.6,
                                      resize: 'vertical',
                                      outline: 'none',
                                      boxSizing: 'border-box',
                                      fontFamily: 'inherit',
                                    }}
                                  />
                                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
                                    <button
                                      onClick={handleCancelEdit}
                                      style={{
                                        padding: '5px 12px',
                                        background: '#1a1a1a',
                                        border: '1px solid #333',
                                        borderRadius: '4px',
                                        color: '#888',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      取消
                                    </button>
                                    <button
                                      onClick={handleSaveEdit}
                                      style={{
                                        padding: '5px 12px',
                                        background: '#6366f1',
                                        border: 'none',
                                        borderRadius: '4px',
                                        color: '#fff',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                      }}
                                    >
                                      保存
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div style={{
                                  marginTop: '10px',
                                  fontSize: '13px',
                                  color: '#ccc',
                                  lineHeight: 1.8,
                                  maxHeight: field.key === 'firstChapter' ? '400px' : '300px',
                                  overflowY: 'auto',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word',
                                }}>
                                  {text}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )
                })}
              </motion.div>
            ) : (
              /* ---- 文档视图 ---- */
              <motion.div
                key="doc"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                style={{
                  background: '#1a1a1a',
                  border: '1px solid #2a2a2a',
                  borderRadius: '12px',
                  padding: '24px',
                  maxHeight: '700px',
                  overflowY: 'auto',
                }}
              >
                {RESULT_FIELDS.map((field) => {
                  const { text } = getResultFieldContent(result, field.key)
                  if (!text) return null
                  return (
                    <div key={field.key} style={{ marginBottom: '20px' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '8px',
                        paddingBottom: '6px',
                        borderBottom: `1px solid ${field.color}30`,
                      }}>
                        <span>{field.icon}</span>
                        <span style={{ fontSize: '15px', fontWeight: 600, color: field.color }}>
                          {field.label}
                        </span>
                      </div>
                      <div style={{
                        fontSize: '14px',
                        color: '#ccc',
                        lineHeight: 1.8,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}>
                        {text}
                      </div>
                    </div>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 底部操作栏：总字数+进度+重新生成+保存 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 20px',
            background: '#1a1a1a',
            border: '1px solid #2a2a2a',
            borderRadius: '10px',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>
                内容完整度
              </div>
              <div style={{
                width: '100%',
                height: '6px',
                background: '#0f0f0f',
                borderRadius: '9999px',
                overflow: 'hidden',
              }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (totalWordCount / 5000) * 100)}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  style={{
                    height: '100%',
                    background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                    borderRadius: '9999px',
                  }}
                />
              </div>
            </div>
            <span style={{ fontSize: '13px', color: '#888', minWidth: '80px' }}>
              {totalWordCount.toLocaleString()} 字
            </span>
            <button
              onClick={() => {
                setResult(null)
                setExpandedKeys(new Set())
              }}
              style={{
                padding: '8px 16px',
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '6px',
                color: '#e0e0e0',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              🔄 重新生成
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: '8px 20px',
                background: '#6366f1',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '13px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              ✓ 保存项目
            </button>
          </div>
        </motion.div>
      ) : (
        /* ========== 输入面板 ========== */
        <motion.div {...fadeInUp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* 已有项目提示 */}
          {currentNovel && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: 'rgba(99,102,241,0.08)',
                border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ color: '#818cf8', fontSize: '14px' }}>⚠️ 已有项目数据，重新推导将覆盖现有内容</span>
              <button
                onClick={handleReDeduce}
                style={{
                  padding: '6px 16px',
                  background: '#ef4444',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                🔄 重新推导
              </button>
            </motion.div>
          )}

          {/* 输入面板主体 */}
          <div style={{
            background: '#1a1a1a',
            border: '1px solid #2a2a2a',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}>
            {/* ---- 5.2 主题输入 + 模板按钮 ---- */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '14px', color: '#aaa' }}>
                  主题 / 关键词
                  <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>
                </div>
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  style={{
                    padding: '4px 12px',
                    background: showTemplates ? 'rgba(99,102,241,0.15)' : 'transparent',
                    border: `1px solid ${showTemplates ? 'rgba(99,102,241,0.3)' : '#333'}`,
                    borderRadius: '6px',
                    color: showTemplates ? '#6366f1' : '#888',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  🎨 主题模板
                </button>
              </div>
              <input
                type="text"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="例如：都市异能、穿越修仙、办公室恋情、末世求生..."
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: '#0f0f0f',
                  border: '1px solid #2a2a2a',
                  borderRadius: '8px',
                  color: '#e0e0e0',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />

              {/* 已选标签展示 */}
              {selectedTags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                  {selectedTags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        background: 'rgba(99,102,241,0.1)',
                        border: '1px solid rgba(99,102,241,0.2)',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: '#818cf8',
                      }}
                    >
                      {tag}
                      <span
                        onClick={() => setSelectedTags((prev) => prev.filter((t) => t !== tag))}
                        style={{ cursor: 'pointer', color: '#666', fontSize: '11px' }}
                      >
                        ×
                      </span>
                    </span>
                  ))}
                </div>
              )}

              {/* 模板展开面板 */}
              <AnimatePresence>
                {showTemplates && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                      gap: '10px',
                      marginTop: '12px',
                      padding: '12px',
                      background: '#0f0f0f',
                      borderRadius: '8px',
                      border: '1px solid #2a2a2a',
                    }}>
                      {THEME_TEMPLATES.map((tpl) => (
                        <motion.button
                          key={tpl.id}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => {
                            setTheme(tpl.theme)
                            setMaleCount(tpl.defaultMale)
                            setFemaleCount(tpl.defaultFemale)
                            setLength(tpl.defaultLength)
                            setShowTemplates(false)
                          }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            padding: '10px',
                            background: '#1a1a1a',
                            border: `1px solid ${tpl.color}30`,
                            borderRadius: '8px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'border-color 0.2s',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '16px' }}>{tpl.icon}</span>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: tpl.color }}>
                              {tpl.name}
                            </span>
                          </div>
                          <span style={{ fontSize: '11px', color: '#666', lineHeight: 1.4 }}>
                            {tpl.description}
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ---- AI 模型选择 ---- */}
            <div>
              <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '8px' }}>
                AI 模型
                <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>
              </div>
              {aiModels.length === 0 ? (
                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: '8px',
                  color: '#ef4444',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <span>⚠️</span>
                  <span>尚未配置 AI 模型，请先前往设置页面添加模型</span>
                  <button
                    onClick={() => navigate('/settings')}
                    style={{
                      marginLeft: 'auto',
                      padding: '4px 10px',
                      background: '#6366f1',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#fff',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    前往设置
                  </button>
                </div>
              ) : (
                <select
                  value={selectedModelId}
                  onChange={(e) => setSelectedModelId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: '#0f0f0f',
                    border: '1px solid #2a2a2a',
                    borderRadius: '8px',
                    color: '#e0e0e0',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                >
                  {aiModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* ---- 5档长度可视化卡片 ---- */}
            <div>
              <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '8px' }}>目标长度</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                {LENGTH_OPTIONS.map((opt) => (
                  <motion.button
                    key={opt.value}
                    layoutId={`length-${opt.value}`}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setLength(opt.value)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '10px 6px',
                      background: length === opt.value
                        ? `${opt.color}15`
                        : '#0f0f0f',
                      border: `1.5px solid ${length === opt.value ? opt.color : '#2a2a2a'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <span style={{ fontSize: '18px' }}>{opt.icon}</span>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: length === opt.value ? 700 : 400,
                      color: length === opt.value ? opt.color : '#ccc',
                    }}>
                      {opt.label}
                    </span>
                    <span style={{ fontSize: '10px', color: '#666' }}>
                      {opt.chapterCount}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* ---- 角色数量 +/- 按钮组 ---- */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {[
                { label: '男角色', count: maleCount, setCount: setMaleCount, color: '#3b82f6' },
                { label: '女角色', count: femaleCount, setCount: setFemaleCount, color: '#ec4899' },
              ].map(({ label, count, setCount, color }) => (
                <div key={label}>
                  <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '8px' }}>{label}</div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0',
                    background: '#0f0f0f',
                    border: '1px solid #2a2a2a',
                    borderRadius: '8px',
                    overflow: 'hidden',
                  }}>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setCount(Math.max(0, count - 1))}
                      style={{
                        width: '40px',
                        height: '40px',
                        background: '#1a1a1a',
                        border: 'none',
                        borderRight: '1px solid #2a2a2a',
                        color: '#888',
                        fontSize: '18px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      −
                    </motion.button>
                    <div style={{
                      flex: 1,
                      textAlign: 'center',
                      fontSize: '16px',
                      fontWeight: 700,
                      color,
                    }}>
                      {count}
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setCount(Math.min(10, count + 1))}
                      style={{
                        width: '40px',
                        height: '40px',
                        background: '#1a1a1a',
                        border: 'none',
                        borderLeft: '1px solid #2a2a2a',
                        color: '#888',
                        fontSize: '18px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      +
                    </motion.button>
                  </div>
                </div>
              ))}
            </div>

            {/* 成人模式提示 */}
            {adultMode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  fontSize: '14px',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                🔥 当前处于成人模式，AI 将使用成人情色小说专用提示词进行推导
              </motion.div>
            )}

            {/* 错误提示 */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    fontSize: '14px',
                    color: '#ef4444',
                    overflow: 'hidden',
                  }}
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ---- 5.3 生成按钮区域 ---- */}
            {loading ? (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleStop}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  style={{ display: 'inline-block' }}
                >
                  ⏹
                </motion.span>
                停止生成
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDeduce}
                disabled={aiModels.length === 0}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: aiModels.length === 0 ? '#333' : '#6366f1',
                  color: aiModels.length === 0 ? '#666' : '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: aiModels.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                <span>⚡</span>
                {aiModels.length === 0 ? '请先配置 AI 模型' : '一键推导'}
              </motion.button>
            )}
          </div>

          {/* ---- 5.4 流式输出区域 ---- */}
          <AnimatePresence>
            {loading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                style={{
                  background: '#1a1a1a',
                  border: '1px solid #2a2a2a',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                {/* 进度条 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: '#aaa' }}>{progressLabel}</span>
                  <span style={{ color: '#6366f1', fontFamily: 'monospace', fontWeight: 600 }}>
                    {progress}%
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: '6px',
                  background: '#0f0f0f',
                  borderRadius: '9999px',
                  overflow: 'hidden',
                }}>
                  <motion.div
                    initial={{ width: '5%' }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                    style={{
                      height: '100%',
                      background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                      borderRadius: '9999px',
                    }}
                  />
                </div>

                {/* 流式输出预览 */}
                {streamText.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#666' }}>实时输出</span>
                      <span style={{ fontSize: '12px', color: '#6366f1', fontFamily: 'monospace' }}>
                        {streamText.length.toLocaleString()} 字
                      </span>
                    </div>
                    <div style={{
                      background: '#0f0f0f',
                      border: '1px solid #2a2a2a',
                      borderRadius: '8px',
                      padding: '16px',
                      maxHeight: '280px',
                      overflow: 'auto',
                      fontSize: '12px',
                      color: '#aaa',
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'monospace',
                      lineHeight: 1.6,
                      wordBreak: 'break-word',
                    }}>
                      {streamText.slice(-3000)}
                      {/* 打字机光标 */}
                      <motion.span
                        animate={{ opacity: [1, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity }}
                        style={{ color: '#6366f1', fontWeight: 700 }}
                      >
                        ▌
                      </motion.span>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 功能说明卡片 */}
          {!loading && !result && (
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}
            >
              {FEATURE_CARDS.map((card) => (
                <motion.div
                  key={card.title}
                  variants={staggerItem}
                  whileHover={{ y: -2, borderColor: card.color + '40' }}
                  style={{
                    background: '#1a1a1a',
                    border: '1px solid #2a2a2a',
                    borderRadius: '12px',
                    padding: '16px',
                    transition: 'border-color 0.2s',
                  }}
                >
                  <div style={{ fontSize: '18px', marginBottom: '8px' }}>{card.icon}</div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#ccc' }}>{card.title}</div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px', lineHeight: 1.4 }}>
                    {card.description}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* ---- 5.6 已保存项目区域 ---- */}
          {currentNovel && !loading && !result && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              style={{
                background: '#1a1a1a',
                border: '1px solid #2a2a2a',
                borderRadius: '12px',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#ccc' }}>
                  📂 已保存项目
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => {
                      // 优先使用 lastDeduceResult，如果不存在则从 currentNovel 实时重建
                      if (lastDeduceResult) {
                        setResult(lastDeduceResult)
                        setExpandedKeys(new Set(['title', 'summary']))
                      } else if (currentNovel) {
                        // 从 store 中实时重建 OneClickResult
                        const r = rebuildResultFromStore(currentNovel, allCharacters, allWorlds, allChapters, allPlotLines)
                        if (r) {
                          setResult(r)
                          setExpandedKeys(new Set(['title', 'summary']))
                        }
                      }
                    }}
                    style={{
                      padding: '4px 10px',
                      background: 'rgba(99,102,241,0.1)',
                      border: '1px solid rgba(99,102,241,0.2)',
                      borderRadius: '4px',
                      color: '#6366f1',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    查看内容
                  </button>
                  <button
                    onClick={handleReDeduce}
                    style={{
                      padding: '4px 10px',
                      background: 'transparent',
                      border: '1px solid #333',
                      borderRadius: '4px',
                      color: '#888',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    重新推导
                  </button>
                </div>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                background: '#0f0f0f',
                borderRadius: '8px',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#e0e0e0' }}>
                    {currentNovel.title}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                    {currentNovel.chapters?.length || 0} 章 · {currentNovel.characters?.length || 0} 角色
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </PageWrapper>
  )
}
