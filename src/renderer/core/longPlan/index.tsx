import { useState, useCallback, useMemo } from 'react'
import { useAppStore } from '../../store'
import { loadPrompt } from '../../utils/promptLoader'
import PageWrapper from '../../components/PageWrapper'
import type {
  AIModel,
  Chapter,
  Volume,
  Character,
  WorldSetting,
} from '@cfg/types'

// ==========================================
// 工具函数
// ==========================================

const genId = (): string =>
  `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

/** 非流式 AI 调用（规划类任务不需要实时流） */
async function callAIModel(
  model: AIModel,
  systemPrompt: string,
  userPrompt: string
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
      stream: false,
    }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`AI 请求失败 (${res.status}): ${errText || res.statusText}`)
  }
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string') throw new Error('AI 返回格式异常')
  return content
}

// ==========================================
// 解析工具
// ==========================================

interface VolumePlan {
  name: string
  summary: string
  chapterCount: number
}

interface ChapterPlan {
  title: string
  summary: string
}

function extractBlock(text: string, titles: string[]): string {
  for (const t of titles) {
    const m = text.match(new RegExp(`【${t}】([\\s\\S]*?)(?=【|$)`))
    if (m) return m[1].trim()
  }
  for (const t of titles) {
    const m = text.match(new RegExp(`#{1,3}\\s*${t}[\\s\\S]*?(?=#{1,3}|$)`))
    if (m) return m[0].replace(/^#{1,3}\s*/, '').trim()
  }
  return ''
}

/** 从总纲文本解析各卷计划 */
function parseVolumePlans(text: string): VolumePlan[] {
  const result: VolumePlan[] = []
  const regex = /(?:【第\s*([一二三四五六七八九十\d]+)\s*卷[：:]?\s*([^】]+)】|#{1,3}\s*第\s*([一二三四五六七八九十\d]+)\s*卷[：:]?\s*(.+))/g
  let m: RegExpExecArray | null
  const matches: Array<{ index: number; name: string; endPos: number }> = []
  while ((m = regex.exec(text)) !== null) {
    const name = (m[2] || m[4] || '未知卷').trim()
    matches.push({ index: m.index, name, endPos: m.index + m[0].length })
  }
  if (matches.length === 0) {
    const name = text.split('\n')[0].trim().slice(0, 30) || '第一卷'
    return [{ name, summary: text.trim().slice(0, 300), chapterCount: 10 }]
  }
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].endPos
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length
    const block = text.slice(start, end).trim()
    const summary =
      extractBlock(block, ['卷概述', '概述', '简介', '概要']) ||
      block.slice(0, 300)
    const countMatch = block.match(
      /(?:章节[数规划]*|共)[：:]?\s*(\d+)[\s章]*章?/
    )
    const chapterCount = countMatch
      ? parseInt(countMatch[1], 10)
      : 10
    result.push({
      name: matches[i].name,
      summary,
      chapterCount,
    })
  }
  return result
}

/** 从单卷文本解析章节列表 */
function parseChaptersFromBlock(text: string): ChapterPlan[] {
  const result: ChapterPlan[] = []
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  for (const line of lines) {
    const m = line.match(
      /(?:第\s*(\d+)\s*章[：:]?\s*|(\d+)[\.\、\)])\s*(.+?)(?:[-—－~～](.+)|$)/
    )
    if (m) {
      const title = (m[3] || '').trim().split(/[-—－~～]/)[0].trim()
      const summary = (m[4] || '').trim() || title
      if (title) result.push({ title, summary })
    }
  }
  if (result.length === 0) {
    const blocks = text.split(/\n\s*\n/).filter((b) => b.trim().length > 3)
    return blocks.map((b) => {
      const first = b.split('\n')[0].trim()
      return {
        title: first.slice(0, 30),
        summary: b.slice(first.length).trim() || first,
      }
    })
  }
  return result
}

/** 组装角色和世界观的参考文本 */
function buildContextRef(
  characters: Character[],
  worldSettings: WorldSetting[]
): { charRef: string; worldRef: string } {
  const charRef = characters
    .map(
      (c) =>
        `【${c.name}】${c.basicInfo.gender}，${c.basicInfo.age}岁，${c.basicInfo.occupation}。性格：${c.personality.join('、')}。外貌：${c.appearance.slice(0, 80)}。`
    )
    .join('\n')
  const worldRef = worldSettings
    .map(
      (w) =>
        `【${w.name}】${w.worldType}。${w.overview.slice(0, 120)}`
    )
    .join('\n')
  return { charRef, worldRef }
}

// ==========================================
// 主组件
// ==========================================

export default function LongPlanPage() {
  // ----- Store 读取 -----
  const currentNovel = useAppStore((s) => s.currentNovel)
  const characters = useAppStore((s) => s.characters)
  const worldSettings = useAppStore((s) => s.worldSettings)
  const plotLines = useAppStore((s) => s.plotLines)
  const aiModels = useAppStore((s) => s.aiModels)
  const currentModel = useAppStore((s) => s.currentModel)
  const storeVolumes = useAppStore((s) => s.volumes)
  const storeChapters = useAppStore((s) => s.chapters)

  // ----- Store 写入 -----
  const addVolume = useAppStore((s) => s.addVolume)
  const addChapter = useAppStore((s) => s.addChapter)
  const updatePlotLine = useAppStore((s) => s.updatePlotLine)
  const addLog = useAppStore((s) => s.addLog)

  // ----- 本地状态 -----
  const [mode, setMode] = useState<'quick' | 'pipeline'>('quick')
  const [totalChapters, setTotalChapters] = useState(50)
  const [volumeCount, setVolumeCount] = useState(5)
  const [selectedModelId, setSelectedModelId] = useState(
    currentModel?.id ?? ''
  )
  const [targetWords, setTargetWords] = useState('100000')
  const [phase, setPhase] = useState<'idle' | 'outline' | 'volumes' | 'done'>('idle')
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [generatedVolumes, setGeneratedVolumes] = useState<
    Array<{ plan: VolumePlan; chapters: ChapterPlan[] }>
  >([])
  const [regenTarget, setRegenTarget] = useState<{
    volIdx: number
    chIdx: number
  } | null>(null)
  const [expandedVolumes, setExpandedVolumes] = useState<Set<number>>(
    new Set()
  )

  const selectedModel =
    aiModels.find((m) => m.id === selectedModelId) || currentModel

  const novelTitle = currentNovel?.title ?? '未命名小说'
  const novelSummary = currentNovel?.summary ?? ''

  // 上下文引用文本（缓存）
  const { charRef, worldRef } = useMemo(
    () => buildContextRef(characters, worldSettings),
    [characters, worldSettings]
  )

  // ----- 生成控制 -----

  const handleQuickGenerate = useCallback(async () => {
    if (!selectedModel) {
      setError('请先选择 AI 模型')
      return
    }
    if (!currentNovel) {
      setError('请先进行一键推导生成基础项目')
      return
    }

    setError(null)
    setPhase('outline')
    setProgress(5)
    setStatusText('正在加载提示词并构建请求...')
    setGeneratedVolumes([])

    try {
      const promptText = loadPrompt('longNovelPrompts')
      if (!promptText) throw new Error('longNovelPrompts.md 加载失败')

      // 提取系统提示词（复用通用创作大师）
      const sysMatch = promptText.match(
        /## 长篇小说大纲生成提示词\s*([\s\S]*?)(?=\n\s*---|\n\s*## |$)/
      )
      const systemPrompt = sysMatch
        ? `你是一位顶级长篇小说架构师。${sysMatch[1].trim().slice(0, 500)}`
        : '你是一位顶级长篇小说架构师，擅长设计分卷结构和章节规划。'

      // 提取用户模板
      const userMatch = promptText.match(
        /## 长篇小说大纲生成提示词\s*[\s\S]*?(?=\n\s*---)/
      )
      const userTemplate = userMatch ? userMatch[0] : ''

      const vars: Record<string, string> = {
        title: novelTitle,
        theme: novelSummary.slice(0, 200) || novelTitle,
        targetWords,
        volumeCount: String(volumeCount),
        chaptersPerVolume: String(Math.ceil(totalChapters / volumeCount)),
      }

      let userPrompt = userTemplate
      for (const [k, v] of Object.entries(vars)) {
        userPrompt = userPrompt.split(`{${k}}`).join(v)
      }

      // 补充上下文
      userPrompt += `\n\n【角色设定参考】\n${charRef || '暂无角色'}
\n【世界观参考】\n${worldRef || '暂无世界观'}
\n注意：请严格按照格式输出，每卷必须包含完整的章节列表。`

      setProgress(15)
      setStatusText('正在请求 AI 生成完整长篇规划...')

      const raw = await callAIModel(selectedModel, systemPrompt, userPrompt)

      setProgress(60)
      setStatusText('正在解析分卷结构...')

      const volPlans = parseVolumePlans(raw)
      const allChapters = parseChaptersFromBlock(raw)

      // 将章节按卷分配
      const chPerVol = Math.max(1, Math.ceil(allChapters.length / volPlans.length))
      const combined = volPlans.map((plan, idx) => ({
        plan,
        chapters: allChapters.slice(idx * chPerVol, (idx + 1) * chPerVol),
      }))

      setGeneratedVolumes(combined)
      setPhase('done')
      setProgress(100)
      setStatusText(`生成完成：共 ${volPlans.length} 卷，${allChapters.length} 章`)

      addLog({
        type: 'success',
        message: '长篇规划生成完成',
        detail: `快速模式：${volPlans.length} 卷 ${allChapters.length} 章`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误'
      setError(`生成失败：${msg}`)
      setPhase('idle')
      addLog({ type: 'error', message: '长篇规划生成失败', detail: msg })
    }
  }, [
    selectedModel,
    currentNovel,
    novelTitle,
    novelSummary,
    targetWords,
    volumeCount,
    totalChapters,
    charRef,
    worldRef,
    addLog,
  ])

  const handlePipelineGenerate = useCallback(async () => {
    if (!selectedModel) {
      setError('请先选择 AI 模型')
      return
    }
    if (!currentNovel) {
      setError('请先进行一键推导生成基础项目')
      return
    }

    setError(null)
    setPhase('outline')
    setProgress(5)
    setStatusText('第一步：生成卷级大纲...')
    setGeneratedVolumes([])

    try {
      const promptText = loadPrompt('longNovelPrompts')
      if (!promptText) throw new Error('longNovelPrompts.md 加载失败')

      const sysMatch = promptText.match(
        /## 长篇小说大纲生成提示词\s*([\s\S]*?)(?=\n\s*---|\n\s*## |$)/
      )
      const systemPrompt = sysMatch
        ? `你是一位顶级长篇小说架构师。${sysMatch[1].trim().slice(0, 500)}`
        : '你是一位顶级长篇小说架构师，擅长设计分卷结构和章节规划。'

      const userMatch = promptText.match(
        /## 长篇小说大纲生成提示词\s*[\s\S]*?(?=\n\s*---)/
      )
      const userTemplate = userMatch ? userMatch[0] : ''

      const vars: Record<string, string> = {
        title: novelTitle,
        theme: novelSummary.slice(0, 200) || novelTitle,
        targetWords,
        volumeCount: String(volumeCount),
        chaptersPerVolume: String(Math.ceil(totalChapters / volumeCount)),
      }

      let userPrompt = userTemplate
      for (const [k, v] of Object.entries(vars)) {
        userPrompt = userPrompt.split(`{${k}}`).join(v)
      }

      userPrompt += `\n\n【角色设定参考】\n${charRef || '暂无角色'}
\n【世界观参考】\n${worldRef || '暂无世界观'}
\n注意：本次只需要输出各卷的名称、概述和计划章节数，不需要输出每章的详细标题和概要。`

      const rawOutline = await callAIModel(
        selectedModel,
        systemPrompt,
        userPrompt
      )
      const volPlans = parseVolumePlans(rawOutline)

      setProgress(30)
      setPhase('volumes')

      // 提取单卷详细大纲模板
      const detailMatch = promptText.match(
        /## 单卷详细大纲提示词\s*[\s\S]*?(?=\n\s*---|$)/
      )
      const detailTemplate = detailMatch ? detailMatch[0] : ''
      const detailSystem =
        '你是一位顶级长篇小说架构师，擅长为单卷设计详细的章节规划。'

      const combined: Array<{ plan: VolumePlan; chapters: ChapterPlan[] }> =
        []

      for (let i = 0; i < volPlans.length; i++) {
        const plan = volPlans[i]
        setStatusText(`正在生成第 ${i + 1}/${volPlans.length} 卷：${plan.name}`)
        setProgress(30 + Math.floor((i / volPlans.length) * 65))

        const prevSummary =
          i > 0 ? volPlans[i - 1].summary.slice(0, 200) : '无'

        let detailPrompt = detailTemplate
        const dVars: Record<string, string> = {
          title: novelTitle,
          theme: novelSummary.slice(0, 200) || novelTitle,
          volumeIndex: String(i + 1),
          volumeName: plan.name,
          volumeSummary: plan.summary,
          previousSummary: prevSummary,
        }
        for (const [k, v] of Object.entries(dVars)) {
          detailPrompt = detailPrompt.split(`{${k}}`).join(v)
        }

        detailPrompt += `\n\n【角色设定参考】\n${charRef || '暂无角色'}
\n【世界观参考】\n${worldRef || '暂无世界观'}
\n注意：本卷共计划 ${plan.chapterCount} 章，请生成每一章的标题和概要。`

        const rawDetail = await callAIModel(
          selectedModel,
          detailSystem,
          detailPrompt
        )
        const chapters = parseChaptersFromBlock(rawDetail)
        combined.push({ plan, chapters })
        setGeneratedVolumes([...combined])
      }

      setPhase('done')
      setProgress(100)
      const totalCh = combined.reduce((s, v) => s + v.chapters.length, 0)
      setStatusText(`流水线生成完成：共 ${combined.length} 卷，${totalCh} 章`)

      addLog({
        type: 'success',
        message: '长篇规划流水线生成完成',
        detail: `${combined.length} 卷 ${totalCh} 章`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误'
      setError(`生成失败：${msg}`)
      setPhase('idle')
      addLog({ type: 'error', message: '长篇规划流水线生成失败', detail: msg })
    }
  }, [
    selectedModel,
    currentNovel,
    novelTitle,
    novelSummary,
    targetWords,
    volumeCount,
    totalChapters,
    charRef,
    worldRef,
    addLog,
  ])

  const handleGenerate = useCallback(() => {
    if (mode === 'quick') {
      handleQuickGenerate()
    } else {
      handlePipelineGenerate()
    }
  }, [mode, handleQuickGenerate, handlePipelineGenerate])

  // ----- 单章重新生成 -----

  const handleRegenChapter = useCallback(
    async (volIdx: number, chIdx: number) => {
      if (!selectedModel || !currentNovel) return
      setRegenTarget({ volIdx, chIdx })

      try {
        const vol = generatedVolumes[volIdx]
        const prevCh = vol.chapters[chIdx - 1]
        const nextCh = vol.chapters[chIdx + 1]
        const currentCh = vol.chapters[chIdx]

        const systemPrompt =
          '你是一位顶级小说编辑，擅长为已有章节重新设计标题和概要。'
        const userPrompt = `请为以下小说的某一章重新生成标题和概要：

【小说标题】${novelTitle}
【卷名称】${vol.plan.name}
【当前章节序号】第${chIdx + 1}章
【前文章节】${prevCh ? `${prevCh.title}：${prevCh.summary.slice(0, 60)}` : '无'}
【后文章节】${nextCh ? `${nextCh.title}：${nextCh.summary.slice(0, 60)}` : '无'}
【当前内容（供参考）】${currentCh.title}：${currentCh.summary.slice(0, 80)}

要求：
1. 标题引人入胜，20字以内
2. 概要50-100字，概括核心冲突和情感走向
3. 必须与前后文剧情连贯

请严格按以下格式输出：
【章节标题】xxx
【章节概要】xxx`

        const raw = await callAIModel(selectedModel, systemPrompt, userPrompt)
        const title =
          (raw.match(/【章节标题】(.+)/)?.[1] || currentCh.title).trim()
        const summary =
          (raw.match(/【章节概要】([\s\S]+?)(?=【|$)/)?.[1] ||
            currentCh.summary).trim()

        const updated = [...generatedVolumes]
        updated[volIdx] = {
          ...updated[volIdx],
          chapters: updated[volIdx].chapters.map((ch, idx) =>
            idx === chIdx ? { title, summary } : ch
          ),
        }
        setGeneratedVolumes(updated)
        addLog({
          type: 'success',
          message: '单章重生成完成',
          detail: `${vol.plan.name} - 第${chIdx + 1}章`,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : '未知错误'
        setError(`单章重生成失败：${msg}`)
        addLog({ type: 'error', message: '单章重生成失败', detail: msg })
      } finally {
        setRegenTarget(null)
      }
    },
    [selectedModel, currentNovel, novelTitle, generatedVolumes, addLog]
  )

  // ----- 应用到项目 -----

  const handleApplyToProject = useCallback(() => {
    if (generatedVolumes.length === 0) return

    let globalOrder = storeChapters.length
    const mainPlotLine = plotLines.find((p) => p.type === 'main')

    for (const gv of generatedVolumes) {
      const volume: Volume = {
        id: genId(),
        novelId: currentNovel?.id ?? '',
        name: gv.plan.name,
        summary: gv.plan.summary,
        order: storeVolumes.length,
        chapters: [],
        statusColor: '#6366f1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      // 先添加卷（此时 chapters 为空，后面更新）
      addVolume(volume)

      const chapterIds: string[] = []
      for (const chPlan of gv.chapters) {
        const chapter: Chapter = {
          id: genId(),
          title: chPlan.title,
          summary: chPlan.summary,
          content: '',
          order: globalOrder,
          status: 'draft',
          volumeId: volume.id,
          wordCount: 0,
          mood: '',
          characters: currentNovel?.characters ?? [],
          hooks: '',
          tags: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        chapterIds.push(chapter.id)
        addChapter(chapter)
        globalOrder++
      }

      // 更新卷的 chapters 字段（通过 updateVolume）
      // 注意：store 没有直接暴露 updateVolume 的返回值，这里直接调用
      const updateVol = useAppStore.getState().updateVolume
      updateVol(volume.id, { chapters: chapterIds })

      // 同步剧情线事件
      if (mainPlotLine) {
        const existingEvents = mainPlotLine.events
        const newEvents = gv.chapters.map((ch, idx) => ({
          id: genId(),
          title: ch.title,
          description: ch.summary,
          order: existingEvents.length + idx,
          chapterId: chapterIds[idx] ?? null,
        }))
        updatePlotLine(mainPlotLine.id, {
          events: [...existingEvents, ...newEvents],
        })
      }
    }

    addLog({
      type: 'success',
      message: '长篇规划已应用到项目',
      detail: `新增 ${generatedVolumes.length} 卷，${generatedVolumes.reduce(
        (s, v) => s + v.chapters.length,
        0
      )} 章`,
    })

    // 重置本地状态
    setGeneratedVolumes([])
    setPhase('idle')
    setProgress(0)
    setStatusText('')
  }, [
    generatedVolumes,
    currentNovel,
    plotLines,
    storeVolumes.length,
    storeChapters.length,
    addVolume,
    addChapter,
    updatePlotLine,
    addLog,
  ])

  // ----- 折叠控制 -----
  const toggleVolume = useCallback((idx: number) => {
    setExpandedVolumes((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }, [])

  // ----- 空状态 -----
  if (!currentNovel) {
    return (
      <PageWrapper title="长篇规划">
        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '14px', color: '#666' }}>
            暂无小说项目，请先前往「一键推导」生成基础项目，再使用长篇规划功能
          </div>
        </div>
      </PageWrapper>
    )
  }

  // ==========================================
  // 渲染
  // ==========================================

  return (
    <PageWrapper
      title="长篇规划"
      subtitle="基于已有项目，AI 自动生成包含分卷结构、章节标题和概要的完整长篇规划"
    >
      {/* 当前项目信息卡 */}
      <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>小说标题</div>
          <div style={{ fontSize: '14px', color: '#ccc', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {novelTitle}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>现有角色</div>
          <div style={{ fontSize: '14px', color: '#ccc', fontWeight: 500 }}>{characters.length} 人</div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>现有章节</div>
          <div style={{ fontSize: '14px', color: '#ccc', fontWeight: 500 }}>{storeChapters.length} 章 / {storeVolumes.length} 卷</div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>剧情线</div>
          <div style={{ fontSize: '14px', color: '#ccc', fontWeight: 500 }}>{plotLines.length} 条</div>
        </div>
      </div>

      {/* 配置面板 */}
      <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* 模式选择 */}
        <div>
          <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '8px' }}>生成模式</div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setMode('quick')}
              style={{
                padding: '8px 16px', borderRadius: '8px', fontSize: '14px', border: mode === 'quick' ? '1px solid #6366f166' : '1px solid #333',
                background: mode === 'quick' ? '#6366f126' : '#0f0f0f', color: mode === 'quick' ? '#6366f1' : '#888', cursor: 'pointer'
              }}
            >
              ⚡ 快速生成（单次调用，适合 200 章以内）
            </button>
            <button
              onClick={() => setMode('pipeline')}
              style={{
                padding: '8px 16px', borderRadius: '8px', fontSize: '14px', border: mode === 'pipeline' ? '1px solid #6366f166' : '1px solid #333',
                background: mode === 'pipeline' ? '#6366f126' : '#0f0f0f', color: mode === 'pipeline' ? '#6366f1' : '#888', cursor: 'pointer'
              }}
            >
              🔄 流水线生成（分卷调用，支持大规模章节）
            </button>
          </div>
        </div>

        {/* 参数网格 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '8px' }}>
              AI 模型 <span style={{ color: '#ef4444' }}>*</span>
            </div>
            <select
              value={selectedModelId}
              onChange={(e) => setSelectedModelId(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
            >
              {aiModels.length === 0 && <option value="">未配置模型</option>}
              {aiModels.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          <div>
            <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '8px' }}>总章节数</div>
            <input
              type="number" min={1} max={1000}
              value={totalChapters}
              onChange={(e) => setTotalChapters(Math.max(1, Math.min(1000, Number(e.target.value))))}
              style={{ width: '100%', padding: '10px 14px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '8px' }}>分卷数</div>
            <input
              type="number" min={1} max={50}
              value={volumeCount}
              onChange={(e) => setVolumeCount(Math.max(1, Math.min(50, Number(e.target.value))))}
              style={{ width: '100%', padding: '10px 14px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '8px' }}>目标字数</div>
            <select
              value={targetWords}
              onChange={(e) => setTargetWords(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
            >
              <option value="3000">3千字（短篇）</option>
              <option value="30000">3万字（中篇）</option>
              <option value="100000">10万字（长篇）</option>
              <option value="500000">50万字（超长篇）</option>
              <option value="1000000">100万字（史诗）</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ fontSize: '12px', color: '#666', lineHeight: 1.6 }}>
              平均每卷<span style={{ color: '#6366f1', fontFamily: 'monospace', margin: '0 4px' }}>{Math.ceil(totalChapters / volumeCount)}</span>章
            </div>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div style={{ background: '#ef444410', border: '1px solid #ef444440', borderRadius: '8px', padding: '12px 16px', fontSize: '14px', color: '#ef4444' }}>
            {error}
          </div>
        )}

        {/* 生成按钮 */}
        <button
          onClick={handleGenerate}
          disabled={phase !== 'idle' && phase !== 'done'}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            background: (phase !== 'idle' && phase !== 'done') ? '#6366f180' : '#6366f1', color: '#fff',
            border: 'none', borderRadius: '8px', padding: '12px 16px', fontSize: '14px', fontWeight: 500,
            cursor: (phase !== 'idle' && phase !== 'done') ? 'not-allowed' : 'pointer'
          }}
        >
          {phase !== 'idle' && phase !== 'done' ? (
            <><span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid #ffffff40', borderTopColor: '#fff', borderRadius: '50%' }} />生成中...</>
          ) : (
            <><span>🚀</span>开始生成长篇规划</>
          )}
        </button>
      </div>

      {/* 进度面板 */}
      {(phase === 'outline' || phase === 'volumes') && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '14px' }}>
            <span style={{ color: '#aaa' }}>{statusText}</span>
            <span style={{ color: '#6366f1', fontFamily: 'monospace' }}>{progress}%</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: '#0f0f0f', borderRadius: '9999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#6366f1', borderRadius: '9999px', width: `${progress}%` }} />
          </div>
          {mode === 'pipeline' && generatedVolumes.length > 0 && (
            <div style={{ fontSize: '12px', color: '#666' }}>
              已完成 {generatedVolumes.length} / {volumeCount} 卷的详细规划
            </div>
          )}
        </div>
      )}

      {/* 生成结果预览 */}
      {generatedVolumes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '16px', fontWeight: 500, color: '#ccc' }}>生成结果预览</div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => { setGeneratedVolumes([]); setPhase('idle'); setProgress(0) }}
                style={{ background: '#1a1a1a', color: '#e0e0e0', border: '1px solid #333', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer' }}
              >
                重置
              </button>
              <button
                onClick={handleApplyToProject}
                style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer' }}
              >
                应用到项目
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {generatedVolumes.map((gv, volIdx) => {
              const isExpanded = expandedVolumes.has(volIdx)
              return (
                <div key={volIdx} style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', overflow: 'hidden' }}>
                  {/* 卷头 */}
                  <button
                    onClick={() => toggleVolume(volIdx)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', border: 'none', background: 'transparent', color: '#e0e0e0', cursor: 'pointer', textAlign: 'left', borderBottom: isExpanded ? '1px solid #2a2a2a' : 'none', boxSizing: 'border-box' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ color: '#6366f1', fontFamily: 'monospace', fontSize: '14px' }}>第{volIdx + 1}卷</span>
                      <span style={{ fontWeight: 500 }}>{gv.plan.name}</span>
                      <span style={{ fontSize: '12px', color: '#666' }}>{gv.chapters.length} 章</span>
                    </div>
                    <span style={{ color: '#666' }}>{isExpanded ? '▼' : '▶'}</span>
                  </button>

                  {/* 卷内容 */}
                  {isExpanded && (
                    <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <p style={{ fontSize: '14px', color: '#888', margin: '12px 0 0' }}>{gv.plan.summary}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {gv.chapters.map((ch, chIdx) => (
                          <div key={chIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '12px 16px' }}>
                            <span style={{ fontSize: '12px', color: '#6366f1', fontFamily: 'monospace', flexShrink: 0, marginTop: '2px' }}>{chIdx + 1}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '14px', color: '#ccc', fontWeight: 500 }}>{ch.title}</div>
                              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{ch.summary}</div>
                            </div>
                            <button
                              onClick={() => handleRegenChapter(volIdx, chIdx)}
                              disabled={regenTarget?.volIdx === volIdx && regenTarget?.chIdx === chIdx}
                              style={{ fontSize: '12px', color: '#6366f1', border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0, opacity: (regenTarget?.volIdx === volIdx && regenTarget?.chIdx === chIdx) ? 0.5 : 1 }}
                            >
                              {regenTarget?.volIdx === volIdx && regenTarget?.chIdx === chIdx ? '生成中...' : '重新生成'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </PageWrapper>
  )
}
