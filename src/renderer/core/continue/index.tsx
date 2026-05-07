import { useState, useCallback, useMemo } from 'react'
import { useAppStore } from '../../store'
import { loadPrompt } from '../../utils/promptLoader'
import PageWrapper from '../../components/PageWrapper'
import type { AIModel } from '@cfg/types'

// ==========================================
// 工具
// ==========================================

async function callAIStream(
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
  if (!reader) throw new Error('响应流不可用')

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    for (const line of chunk.split('\n')) {
      const t = line.trim()
      if (!t.startsWith('data: ')) continue
      const data = t.slice(6)
      if (data === '[DONE]') continue
      try {
        const p = JSON.parse(data)
        const c = p.choices?.[0]?.delta?.content
        if (typeof c === 'string') {
          fullText += c
          onChunk(fullText)
        }
      } catch {
        // 忽略解析失败
      }
    }
  }
  return fullText
}

function buildContext(
  characters: ReturnType<typeof useAppStore.getState>['characters'],
  worldSettings: ReturnType<typeof useAppStore.getState>['worldSettings']
): { charRef: string; worldRef: string } {
  const charRef = characters
    .map(
      (c) =>
        `【${c.name}】${c.basicInfo.gender}，${c.basicInfo.age}岁，${c.basicInfo.occupation}。性格：${c.personality.join('、')}。外貌：${c.appearance.slice(0, 80)}。`
    )
    .join('\n')
  const worldRef = worldSettings
    .map((w) => `【${w.name}】${w.worldType}。${w.overview.slice(0, 120)}`)
    .join('\n')
  return { charRef, worldRef }
}

// ==========================================
// 主组件
// ==========================================

export default function ContinuePage() {
  // ----- Store 读取 -----
  const chapters = useAppStore((s) => s.chapters)
  const characters = useAppStore((s) => s.characters)
  const worldSettings = useAppStore((s) => s.worldSettings)
  const currentNovel = useAppStore((s) => s.currentNovel)
  const aiModels = useAppStore((s) => s.aiModels)
  const currentModel = useAppStore((s) => s.currentModel)
  const adultMode = useAppStore((s) => s.adultMode)

  // ----- Store 写入 -----
  const updateChapter = useAppStore((s) => s.updateChapter)
  const addLog = useAppStore((s) => s.addLog)
  const addMemory = useAppStore((s) => s.addMemory)

  // ----- 本地状态 -----
  const [selectedChapterId, setSelectedChapterId] = useState('')
  const [selectedModelId, setSelectedModelId] = useState(
    currentModel?.id ?? ''
  )
  const [wordCount, setWordCount] = useState(2000)
  const [direction, setDirection] = useState('')
  const [generated, setGenerated] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const selectedModel =
    aiModels.find((m) => m.id === selectedModelId) || currentModel

  const sortedChapters = useMemo(
    () => [...chapters].sort((a, b) => a.order - b.order),
    [chapters]
  )

  const selectedChapter = sortedChapters.find(
    (c) => c.id === selectedChapterId
  )

  // 切换章节时清空生成内容
  const handleSelectChapter = useCallback((id: string) => {
    setSelectedChapterId(id)
    setGenerated('')
    setSaved(false)
    setError(null)
  }, [])

  // 获取当前章节之前的所有章节内容（构建前文）
  const previousContext = useMemo(() => {
    if (!selectedChapter) return ''
    const idx = sortedChapters.findIndex((c) => c.id === selectedChapter.id)
    if (idx <= 0) return selectedChapter.content || ''
    const prevChapters = sortedChapters.slice(0, idx).filter((c) => c.content && c.content.trim().length > 0)
    return prevChapters
      .map((c) => `【${c.title}】\n${c.content}`)
      .join('\n\n')
  }, [selectedChapter, sortedChapters])

  // 上下文引用
  const { charRef, worldRef } = useMemo(
    () => buildContext(characters, worldSettings),
    [characters, worldSettings]
  )

  const handleGenerate = useCallback(async () => {
    if (!selectedChapter) {
      setError('请先选择章节')
      return
    }
    if (!selectedModel) {
      setError('请选择 AI 模型')
      return
    }

    setError(null)
    setLoading(true)
    setProgress(5)
    setStatusText('正在加载提示词...')
    setGenerated('')
    setSaved(false)

    try {
      const promptText = loadPrompt('prompts')
      if (!promptText) throw new Error('prompts.md 加载失败')

      // 提取系统提示词
      const systemMatch = adultMode
        ? promptText.match(
            /## 系统提示词：成人情色小说专用（强烈推荐固定使用）\s*([\s\S]*?)(?=\n\s*---|\n\s*## |$)/
          )
        : promptText.match(
            /## 系统提示词：通用小说创作大师\s*([\s\S]*?)(?=\n\s*---|\n\s*## |$)/
          )
      const systemPrompt = systemMatch
        ? systemMatch[1].trim()
        : adultMode
          ? '你是一位顶尖的中文成人情色文学作家。'
          : '你是一位顶级小说创作大师。'

      // 提取用户模板（优先单章续写，其次通用续写）
      let userTemplate = ''
      if (adultMode) {
        const adultMatch = promptText.match(
          /## 成人情色小说 - 自动续写提示词模板\s*([\s\S]*?)(?=\n\s*---|\n\s*## |$)/
        )
        userTemplate = adultMatch ? adultMatch[1].trim() : ''
      }
      if (!userTemplate) {
        const singleMatch = promptText.match(
          /## 单章续写提示词\s*([\s\S]*?)(?=\n\s*---|\n\s*## |$)/
        )
        const generalMatch = promptText.match(
          /## 续写提示词模板\s*([\s\S]*?)(?=\n\s*---|\n\s*## |$)/
        )
        userTemplate = singleMatch
          ? singleMatch[1].trim()
          : generalMatch
            ? generalMatch[1].trim()
            : ''
      }

      if (!userTemplate) throw new Error('未能从提示词中提取续写模板')

      // 找出当前章的索引和前后章信息
      const chIdx = sortedChapters.findIndex(
        (c) => c.id === selectedChapter.id
      )
      const prevCh = chIdx > 0 ? sortedChapters[chIdx - 1] : null
      const nextCh =
        chIdx < sortedChapters.length - 1
          ? sortedChapters[chIdx + 1]
          : null

      // 构建变量
      const chSummaries = sortedChapters
        .slice(0, chIdx + 1)
        .map((c) => `${c.title}：${c.summary || '无'}`)
        .join('\n')

      const vars: Record<string, string> = {
        title: currentNovel?.title ?? '未命名小说',
        currentChapter: selectedChapter.title,
        nextChapterTitle: nextCh?.title ?? '下一章',
        nextChapterSummary: nextCh?.summary ?? '',
        chapterSummaries: chSummaries,
        previousEnding: prevCh ? prevCh.content.slice(-500) : '',
        previousContent: previousContext.slice(-3000),
        wordCount: String(wordCount),
        direction: direction.trim() || '自然推进剧情',
        currentChapterNum: String(chIdx + 1),
        nextChapterNum: String(chIdx + 2),
        modelName: selectedModel.name,
        lengthMode: currentNovel?.targetWords ?? '30000',
        tags: currentNovel?.tags?.join('、') ?? '无',
        memorySummary: selectedChapter.summary || '',
        characterStatus: charRef,
        currentPace: direction.trim() || '自然推进',
      }

      let userPrompt = userTemplate
      for (const [k, v] of Object.entries(vars)) {
        userPrompt = userPrompt.split(`{${k}}`).join(v)
      }

      // 补充上下文
      userPrompt += `\n\n【世界观参考】\n${worldRef || '暂无世界观'}\n\n【角色设定参考】\n${charRef || '暂无角色'}`

      setProgress(15)
      setStatusText('正在请求 AI 续写...')

      const result = await callAIStream(
        selectedModel,
        systemPrompt,
        userPrompt,
        (text) => {
          const p = Math.min(15 + Math.floor((text.length / wordCount) * 80), 95)
          setProgress(p)
          setStatusText('AI 正在续写中...')
          setGenerated(text)
        }
      )

      setGenerated(result)
      setProgress(100)
      setStatusText('续写完成')
      setLoading(false)

      addLog({
        type: 'success',
        message: '自动续写完成',
        detail: `${selectedChapter.title}，约 ${result.length} 字`,
      })
      addMemory({
        id: `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'llm',
        content: `自动续写完成：${selectedChapter.title}\n生成约 ${result.length} 字`,
        source: '自动续写',
        tags: ['续写', 'AI生成'],
        modelName: selectedModel?.name ?? null,
        projectId: currentNovel?.id ?? null,
        timestamp: Date.now(),
        duration: null,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误'
      setError(`续写失败：${msg}`)
      setLoading(false)
      addLog({ type: 'error', message: '自动续写失败', detail: msg })
    }
  }, [
    selectedChapter,
    selectedModel,
    adultMode,
    wordCount,
    direction,
    previousContext,
    currentNovel,
    sortedChapters,
    charRef,
    worldRef,
    addLog,
  ])

  const handleSave = useCallback(() => {
    if (!selectedChapter || !generated.trim()) return
    const newContent = selectedChapter.content
      ? selectedChapter.content + '\n\n' + generated.trim()
      : generated.trim()
    updateChapter(selectedChapter.id, { content: newContent })
    setSaved(true)
    addLog({
      type: 'success',
      message: '续写内容已保存',
      detail: selectedChapter.title,
    })
    addMemory({
      id: `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'auto',
      content: `续写内容已保存：${selectedChapter.title}`,
      source: '自动续写保存',
      tags: ['续写', '保存'],
      modelName: null,
      projectId: currentNovel?.id ?? null,
      timestamp: Date.now(),
      duration: null,
    })
  }, [selectedChapter, generated, updateChapter, addLog, addMemory, currentNovel])

  const handleReplace = useCallback(() => {
    if (!selectedChapter || !generated.trim()) return
    updateChapter(selectedChapter.id, { content: generated.trim() })
    setSaved(true)
    addLog({
      type: 'success',
      message: '内容已替换',
      detail: selectedChapter.title,
    })
  }, [selectedChapter, generated, updateChapter, addLog])

  // ==========================================
  // 渲染
  // ==========================================

  return (
    <PageWrapper
      title="自动续写"
      subtitle="选择章节，AI 将基于前文内容、角色设定和世界观自动续写下一段"
    >
      {/* 配置面板 */}
      <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '8px' }}>选择章节 <span style={{ color: '#ef4444' }}>*</span></div>
            <select
              value={selectedChapterId}
              onChange={(e) => handleSelectChapter(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
            >
              <option value="">请选择章节</option>
              {sortedChapters.map((c) => (
                <option key={c.id} value={c.id}>{c.order + 1}. {c.title} {c.content ? '✓' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '8px' }}>AI 模型 <span style={{ color: '#ef4444' }}>*</span></div>
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
            <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '8px' }}>续写字数</div>
            <select
              value={wordCount}
              onChange={(e) => setWordCount(Number(e.target.value))}
              style={{ width: '100%', padding: '10px 14px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
            >
              <option value={1000}>1000 字</option>
              <option value={2000}>2000 字</option>
              <option value={3000}>3000 字</option>
              <option value={5000}>5000 字</option>
              <option value={10000}>10000 字</option>
            </select>
          </div>
        </div>

        {/* 续写方向 */}
        <div>
          <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '8px' }}>续写方向（可选）</div>
          <input
            type="text" value={direction}
            onChange={(e) => setDirection(e.target.value)}
            placeholder="例如：高潮爆发、温情过渡、悬念铺设、反转突变..."
            style={{ width: '100%', padding: '10px 14px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {error && (
          <div style={{ background: '#ef444410', border: '1px solid #ef444440', borderRadius: '8px', padding: '12px 16px', fontSize: '14px', color: '#ef4444' }}>{error}</div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: loading ? '#6366f180' : '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px 16px', fontSize: '14px', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? <><span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid #ffffff40', borderTopColor: '#fff', borderRadius: '50%' }} />{statusText}</> : <><span>✨</span>开始续写</>}
        </button>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ width: '100%', height: '8px', background: '#0f0f0f', borderRadius: '9999px', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#6366f1', borderRadius: '9999px', width: `${progress}%` }} />
            </div>
            <div style={{ fontSize: '12px', color: '#666', textAlign: 'right' }}>{progress}%</div>
          </div>
        )}
      </div>

      {/* 前文预览 + 角色世界观提示 */}
      {selectedChapter && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
          <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#ccc', marginBottom: '12px' }}>前文内容 · {selectedChapter.title}</div>
            <div style={{ background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '16px', maxHeight: '192px', overflow: 'auto', fontSize: '14px', color: '#aaa', whiteSpace: 'pre-wrap', fontFamily: 'monospace', lineHeight: 1.6 }}>
              {selectedChapter.content || '（本章暂无内容）'}
            </div>
          </div>
          <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#6366f1', fontWeight: 500, marginBottom: '8px' }}>关联角色</div>
              <div style={{ fontSize: '12px', color: '#888', whiteSpace: 'pre-wrap', maxHeight: '128px', overflow: 'auto' }}>{charRef || '暂无角色'}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#6366f1', fontWeight: 500, marginBottom: '8px' }}>世界观</div>
              <div style={{ fontSize: '12px', color: '#888', whiteSpace: 'pre-wrap', maxHeight: '128px', overflow: 'auto' }}>{worldRef || '暂无世界观'}</div>
            </div>
          </div>
        </div>
      )}

      {/* 生成结果 */}
      {generated && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '16px', fontWeight: 500, color: '#ccc' }}>续写结果</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {saved && <span style={{ fontSize: '12px', color: '#34d399' }}>已保存</span>}
              <button onClick={handleReplace} style={{ background: '#1a1a1a', color: '#e0e0e0', border: '1px solid #333', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>替换原文</button>
              <button onClick={handleSave} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>追加保存</button>
            </div>
          </div>
          <textarea
            value={generated}
            onChange={(e) => { setGenerated(e.target.value); setSaved(false) }}
            style={{ width: '100%', padding: '16px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', minHeight: '300px', resize: 'vertical', fontFamily: 'monospace', lineHeight: 1.6, boxSizing: 'border-box' }}
          />
          <div style={{ fontSize: '12px', color: '#666', textAlign: 'right' }}>{generated.length} 字</div>
        </div>
      )}
    </PageWrapper>
  )
}
