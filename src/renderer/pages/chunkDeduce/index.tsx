/**
 * 分块推导 - 修复流式中断状态管理
 * 修复：取消后 currentPhase 不重置、流式错误后 UI 卡死
 */
import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useStore } from '../../store'

type DeducePhase = 'idle' | 'architecture' | 'characters' | 'world' | 'chapters' | 'firstChapter'

interface PhaseConfig { id: DeducePhase; label: string; icon: string; description: string; prompt: string }

const PHASES: PhaseConfig[] = [
  { id: 'architecture', label: '故事架构', icon: '🏗️', description: '生成标题、简介、类型、核心冲突', prompt: '请为以下主题生成小说的核心架构：标题、一句话简介、类型定位、核心冲突、目标读者。只输出这5项。' },
  { id: 'characters', label: '角色设定', icon: '👥', description: '生成主角 + 配角详细设定', prompt: '基于以下故事架构，生成完整角色设定：主角（姓名/外貌/性格/背景/目标）、配角（每人姓名/关系/作用）。' },
  { id: 'world', label: '世界观', icon: '🌍', description: '生成世界观规则与地点', prompt: '基于故事类型和角色设定，生成世界观：核心规则、3-5个关键地点、社会结构、时代背景。' },
  { id: 'chapters', label: '章节目录', icon: '📑', description: '生成完整章节目录 + 概要', prompt: '生成完整章节目录（15-20章），每章包含：标题、核心事件、出场角色、感情/肉欲节点标注。' },
  { id: 'firstChapter', label: '首章正文', icon: '📝', description: '生成第一章完整正文', prompt: '基于以上所有设定，生成第一章完整正文（3000-5000字）。要求：开篇抓人、角色登场自然、埋下伏笔。' },
]

interface PhaseResult { phase: DeducePhase; content: string; status: 'pending' | 'running' | 'completed' | 'error'; error?: string }

const emptyResults = (): Record<DeducePhase, PhaseResult> => ({
  idle: { phase: 'idle', content: '', status: 'pending' },
  architecture: { phase: 'architecture', content: '', status: 'pending' },
  characters: { phase: 'characters', content: '', status: 'pending' },
  world: { phase: 'world', content: '', status: 'pending' },
  chapters: { phase: 'chapters', content: '', status: 'pending' },
  firstChapter: { phase: 'firstChapter', content: '', status: 'pending' },
})

export default function ChunkDeducePage() {
  const currentModel = useStore((s) => s.currentModel)
  const addLog = useStore((s) => s.addLog)
  const importFromDeduce = useStore((s) => s.importFromDeduce)

  const [theme, setTheme] = useState('')
  const [adultMode, setAdultMode] = useState(false)
  const [results, setResults] = useState<Record<DeducePhase, PhaseResult>>(emptyResults())
  const [currentPhase, setCurrentPhase] = useState<DeducePhase>('idle')
  const abortRef = useRef<AbortController | null>(null)
  const isRunningRef = useRef(false)

  const runPhase = useCallback(async (phase: DeducePhase, previousContext: string) => {
    if (!currentModel || phase === 'idle') return
    if (isRunningRef.current) return

    const config = PHASES.find((p) => p.id === phase)!
    isRunningRef.current = true
    setCurrentPhase(phase)
    setResults((prev) => ({ ...prev, [phase]: { ...prev[phase], status: 'running', content: '', error: undefined } }))

    abortRef.current = new AbortController()

    try {
      const res = await fetch(`${currentModel.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentModel.apiKey}` },
        body: JSON.stringify({
          model: currentModel.modelId,
          messages: [
            { role: 'system', content: `你是一位专业小说架构师。${adultMode ? '当前为成人模式，需包含感情线与肉欲线双轨设计。' : ''}请严格按照要求输出，不要添加额外解释。` },
            { role: 'user', content: `主题：${theme}\n\n${previousContext}\n\n${config.prompt}` },
          ],
          temperature: 0.8, max_tokens: 4000, stream: true,
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('响应流不可用')
      const decoder = new TextDecoder()
      let content = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n').filter((l) => l.trim())) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              const text = parsed.choices?.[0]?.delta?.content || ''
              if (text) {
                content += text
                setResults((prev) => ({ ...prev, [phase]: { ...prev[phase], content, status: 'running' } }))
              }
            } catch { /* 忽略单条解析失败 */ }
          }
        }
      }

      setResults((prev) => ({ ...prev, [phase]: { ...prev[phase], content, status: 'completed' } }))
      addLog({ type: 'success', message: `分块推导完成：${config.label}`, detail: `${content.length} 字` })
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // 用户取消，保持原有内容（如果有）
        setCurrentPhase('idle')
        return
      }
      setResults((prev) => ({ ...prev, [phase]: { ...prev[phase], status: 'error', error: err.message || '未知错误' } }))
      addLog({ type: 'error', message: `分块推导失败：${config.label}`, detail: err.message })
    } finally {
      isRunningRef.current = false
      if (currentPhase === phase) {
        setCurrentPhase('idle')
      }
    }
  }, [currentModel, theme, adultMode, addLog])

  const handleRunAll = async () => {
    let context = ''
    setResults(emptyResults())
    for (const phase of PHASES) {
      if (abortRef.current?.signal.aborted) break
      await runPhase(phase.id, context)
      context += `\n\n【${phase.label}】\n${results[phase.id]?.content || ''}`
    }
  }

  const handleRunSingle = (phase: DeducePhase) => {
    let context = ''
    for (const p of PHASES) {
      if (p.id === phase) break
      if (results[p.id].status === 'completed') {
        context += `\n\n【${p.label}】\n${results[p.id].content}`
      }
    }
    runPhase(phase, context)
  }

  const handleCancel = () => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setResults((prev) => ({
      ...prev,
      [currentPhase]: { ...prev[currentPhase], status: prev[currentPhase]?.content ? 'completed' : 'pending' },
    }))
    setCurrentPhase('idle')
    isRunningRef.current = false
  }

  const handleRegenerate = (phase: DeducePhase) => {
    // 清除该阶段结果后重新生成
    setResults((prev) => ({ ...prev, [phase]: { ...prev[phase], content: '', status: 'pending', error: undefined } }))
    handleRunSingle(phase)
  }

  const allCompleted = PHASES.every((p) => results[p.id].status === 'completed')

  const inputStyle: React.CSSProperties = {
    padding: '10px 14px', background: '#0f0f0f', border: '1px solid #2a2a2a',
    borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none',
  }

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto', color: '#e0e0e0' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>🧩 分块推导</h2>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="输入主题..." style={{ ...inputStyle, flex: 1 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#a855f7', fontSize: 13 }}>
          <input type="checkbox" checked={adultMode} onChange={(e) => setAdultMode(e.target.checked)} /> 🔞 成人
        </label>
        <button onClick={handleRunAll} disabled={!theme.trim() || !currentModel || isRunningRef.current}
          style={{ padding: '10px 20px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: (!theme.trim() || !currentModel || isRunningRef.current) ? 0.5 : 1 }}>
          🚀 全部生成
        </button>
        {isRunningRef.current && (
          <button onClick={handleCancel} style={{ padding: '10px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
            ⏹ 停止
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {PHASES.map((phase, index) => {
          const result = results[phase.id]
          const isRunning = result.status === 'running'
          const isCompleted = result.status === 'completed'
          const isError = result.status === 'error'

          return (
            <div key={phase.id} style={{
              padding: 16, background: '#0a0a0a', borderRadius: 10,
              border: isRunning ? '1px solid #8b5cf6' : isCompleted ? '1px solid #10b981' : isError ? '1px solid #ef4444' : '1px solid #1a1a1a',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <span style={{ fontSize: 20 }}>{phase.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#e0e0e0' }}>阶段 {index + 1}: {phase.label}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{phase.description}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {isCompleted ? (
                    <>
                      <span style={{ padding: '4px 10px', borderRadius: 4, fontSize: 11, background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>✅ 完成</span>
                      <button onClick={() => handleRegenerate(phase.id)} style={{ ...btnSecondaryStyle, fontSize: 11 }}>🔄 重生成</button>
                    </>
                  ) : isRunning ? (
                    <span style={{ padding: '4px 10px', borderRadius: 4, fontSize: 11, background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>⏳ 生成中...</span>
                  ) : isError ? (
                    <>
                      <span style={{ padding: '4px 10px', borderRadius: 4, fontSize: 11, background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>❌ {result.error?.slice(0, 20)}</span>
                      <button onClick={() => handleRegenerate(phase.id)} style={{ ...btnSecondaryStyle, fontSize: 11, background: '#ef444430', color: '#ef4444' }}>🔄 重试</button>
                    </>
                  ) : (
                    <button onClick={() => handleRunSingle(phase.id)}
                      disabled={!theme.trim() || !currentModel || isRunningRef.current}
                      style={{ ...btnSecondaryStyle, fontSize: 11, opacity: (!theme.trim() || !currentModel || isRunningRef.current) ? 0.5 : 1 }}>
                      ▶️ 生成
                    </button>
                  )}
                </div>
              </div>

              {result.content && (
                <div style={{ padding: 12, background: '#0f0f0f', borderRadius: 6, fontSize: 13, color: '#9ca3af', maxHeight: 200, overflow: 'auto', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {result.content}
                </div>
              )}
              {result.error && (
                <div style={{ padding: 8, background: 'rgba(239,68,68,0.1)', borderRadius: 4, fontSize: 12, color: '#ef4444', marginTop: 8 }}>{result.error}</div>
              )}
            </div>
          )
        })}
      </div>

      {allCompleted && (
        <div style={{ marginTop: 20, padding: 16, background: 'rgba(16,185,129,0.05)', borderRadius: 10, border: '1px solid rgba(16,185,129,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>🎉</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: '#10b981' }}>所有阶段已完成！</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>可以合并结果并导入到编辑中心</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const btnSecondaryStyle: React.CSSProperties = {
  padding: '4px 10px', background: '#1f1f1f', color: '#9ca3af',
  border: '1px solid #2a2a2a', borderRadius: '4px', fontSize: '11px', cursor: 'pointer',
}
