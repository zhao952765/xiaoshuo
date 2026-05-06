/**
 * 分块推导（Chunked Deduction）
 * SRS v2.3 中优先级：推导拆分为 5 个阶段，每块可单独重生成
 * 
 * 阶段：架构 → 角色 → 世界观 → 章节 → 首章
 */

import React, { useState, useCallback, useRef } from 'react'
import { useStore } from '../../store'

type DeducePhase = 'idle' | 'architecture' | 'characters' | 'world' | 'chapters' | 'firstChapter'

interface PhaseConfig {
  id: DeducePhase
  label: string
  icon: string
  description: string
  prompt: string
}

const PHASES: PhaseConfig[] = [
  {
    id: 'architecture',
    label: '故事架构',
    icon: '🏗️',
    description: '生成标题、简介、类型、核心冲突',
    prompt: '请为以下主题生成小说的核心架构：标题、一句话简介、类型定位、核心冲突、目标读者。只输出这5项。',
  },
  {
    id: 'characters',
    label: '角色设定',
    icon: '👥',
    description: '生成主角 + 配角详细设定',
    prompt: '基于以下故事架构，生成完整角色设定：主角（姓名/外貌/性格/背景/目标）、配角（每人姓名/关系/作用）。',
  },
  {
    id: 'world',
    label: '世界观',
    icon: '🌍',
    description: '生成世界观规则与地点',
    prompt: '基于故事类型和角色设定，生成世界观：核心规则、3-5个关键地点、社会结构、时代背景。',
  },
  {
    id: 'chapters',
    label: '章节目录',
    icon: '📑',
    description: '生成完整章节目录 + 概要',
    prompt: '生成完整章节目录（15-20章），每章包含：标题、核心事件、出场角色、感情/肉欲节点标注。',
  },
  {
    id: 'firstChapter',
    label: '首章正文',
    icon: '📝',
    description: '生成第一章完整正文',
    prompt: '基于以上所有设定，生成第一章完整正文（3000-5000字）。要求：开篇抓人、角色登场自然、埋下伏笔。',
  },
]

interface PhaseResult {
  phase: DeducePhase
  content: string
  status: 'pending' | 'running' | 'completed' | 'error'
  error?: string
}

export default function ChunkDeducePage() {
  const currentModel = useStore((s) => s.currentModel)
  const addLog = useStore((s) => s.addLog)
  const importFromDeduce = useStore((s) => s.importFromDeduce)

  const [theme, setTheme] = useState('')
  const [adultMode, setAdultMode] = useState(false)
  const [results, setResults] = useState<Record<DeducePhase, PhaseResult>>({
    idle: { phase: 'idle', content: '', status: 'pending' },
    architecture: { phase: 'architecture', content: '', status: 'pending' },
    characters: { phase: 'characters', content: '', status: 'pending' },
    world: { phase: 'world', content: '', status: 'pending' },
    chapters: { phase: 'chapters', content: '', status: 'pending' },
    firstChapter: { phase: 'firstChapter', content: '', status: 'pending' },
  })
  const [currentPhase, setCurrentPhase] = useState<DeducePhase>('idle')
  const abortRef = useRef<AbortController | null>(null)

  const genId = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

  const runPhase = useCallback(async (phase: DeducePhase, previousContext: string) => {
    if (!currentModel || phase === 'idle') return

    const config = PHASES.find((p) => p.id === phase)!
    setResults((prev) => ({ ...prev, [phase]: { ...prev[phase], status: 'running' } }))
    setCurrentPhase(phase)

    abortRef.current = new AbortController()

    try {
      const res = await fetch(`${currentModel.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentModel.apiKey}`,
        },
        body: JSON.stringify({
          model: currentModel.modelId,
          messages: [
            {
              role: 'system',
              content: `你是一位专业小说架构师。${adultMode ? '当前为成人模式，需包含感情线与肉欲线双轨设计。' : ''}请严格按照要求输出，不要添加额外解释。`,
            },
            {
              role: 'user',
              content: `主题：${theme}\n\n${previousContext}\n\n${config.prompt}`,
            },
          ],
          temperature: 0.8,
          max_tokens: 4000,
          stream: true,
        }),
        signal: abortRef.current.signal,
      })

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let content = ''

      while (true) {
        const { done, value } = await reader!.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter((l) => l.trim())
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              const text = parsed.choices?.[0]?.delta?.content || ''
              content += text
              setResults((prev) => ({ ...prev, [phase]: { ...prev[phase], content, status: 'running' } }))
            } catch {}
          }
        }
      }

      setResults((prev) => ({ ...prev, [phase]: { ...prev[phase], content, status: 'completed' } }))
      addLog({ type: 'success', message: `分块推导完成：${config.label}`, detail: `${content.length} 字` })
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setResults((prev) => ({ ...prev, [phase]: { ...prev[phase], status: 'error', error: err.message } }))
        addLog({ type: 'error', message: `分块推导失败：${config.label}`, detail: err.message })
      }
    }
  }, [currentModel, theme, adultMode, addLog])

  const handleRunAll = async () => {
    let context = ''
    for (const phase of PHASES) {
      await runPhase(phase.id, context)
      context += `\n\n【${phase.label}】\n${results[phase.id]?.content || ''}`
    }
  }

  const handleRunSingle = (phase: DeducePhase) => {
    // 收集之前所有已完成阶段的内容作为上下文
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
    abortRef.current?.abort()
    setResults((prev) => ({
      ...prev,
      [currentPhase]: { ...prev[currentPhase], status: 'pending' },
    }))
  }

  const handleRegenerate = (phase: DeducePhase) => {
    setResults((prev) => ({ ...prev, [phase]: { ...prev[phase], content: '', status: 'pending' } }))
    handleRunSingle(phase)
  }

  const allCompleted = PHASES.every((p) => results[p.id].status === 'completed')

  const handleImportAll = () => {
    if (!allCompleted) return
    // 合并所有阶段内容，调用导入
    const fullText = PHASES.map((p) => `## ${p.label}\n${results[p.id].content}`).join('\n\n')
    // 这里需要调用 deduceParser 解析完整文本
    addLog({ type: 'success', message: '合并所有分块结果', detail: `${fullText.length} 字` })
  }

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto', color: '#e0e0e0' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>🧩 分块推导</h2>

      {/* 输入区 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <input
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="输入主题..."
          style={{ ...inputStyle, flex: 1 }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#a855f7', fontSize: 13 }}>
          <input type="checkbox" checked={adultMode} onChange={(e) => setAdultMode(e.target.checked)} />
          🔞 成人模式
        </label>
        <button
          onClick={handleRunAll}
          disabled={!theme.trim() || !currentModel || currentPhase !== 'idle'}
          style={{
            padding: '10px 20px', background: '#8b5cf6', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
            cursor: 'pointer', opacity: !theme.trim() || !currentModel || currentPhase !== 'idle' ? 0.5 : 1,
          }}
        >
          🚀 全部生成
        </button>
        {currentPhase !== 'idle' && (
          <button onClick={handleCancel} style={{ padding: '10px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
            ⏹ 停止
          </button>
        )}
      </div>

      {/* 阶段列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {PHASES.map((phase, index) => {
          const result = results[phase.id]
          const isRunning = result.status === 'running'
          const isCompleted = result.status === 'completed'
          const isError = result.status === 'error'

          return (
            <div
              key={phase.id}
              style={{
                padding: 16, background: '#0a0a0a', borderRadius: 10,
                border: isRunning ? '1px solid #8b5cf6' : isCompleted ? '1px solid #10b981' : isError ? '1px solid #ef4444' : '1px solid #1a1a1a',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <span style={{ fontSize: 20 }}>{phase.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#e0e0e0' }}>
                    阶段 {index + 1}: {phase.label}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{phase.description}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {isCompleted ? (
                    <>
                      <span style={{ padding: '4px 10px', borderRadius: 4, fontSize: 11, background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                        ✅ 完成
                      </span>
                      <button onClick={() => handleRegenerate(phase.id)} style={{ ...btnSecondaryStyle, fontSize: 11 }}>
                        🔄 重生成
                      </button>
                    </>
                  ) : isRunning ? (
                    <span style={{ padding: '4px 10px', borderRadius: 4, fontSize: 11, background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>
                      ⏳ 生成中...
                    </span>
                  ) : isError ? (
                    <span style={{ padding: '4px 10px', borderRadius: 4, fontSize: 11, background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                      ❌ 失败
                    </span>
                  ) : (
                    <button
                      onClick={() => handleRunSingle(phase.id)}
                      disabled={!theme.trim() || !currentModel || currentPhase !== 'idle'}
                      style={{
                        ...btnSecondaryStyle, fontSize: 11,
                        opacity: !theme.trim() || !currentModel || currentPhase !== 'idle' ? 0.5 : 1,
                      }}
                    >
                      ▶️ 生成
                    </button>
                  )}
                </div>
              </div>

              {/* 内容预览 */}
              {result.content && (
                <div style={{
                  padding: 12, background: '#0f0f0f', borderRadius: 6,
                  fontSize: 13, color: '#9ca3af', maxHeight: 200, overflow: 'auto',
                  lineHeight: 1.6, whiteSpace: 'pre-wrap',
                }}>
                  {result.content}
                </div>
              )}

              {result.error && (
                <div style={{ padding: 8, background: 'rgba(239,68,68,0.1)', borderRadius: 4, fontSize: 12, color: '#ef4444', marginTop: 8 }}>
                  {result.error}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 导入按钮 */}
      {allCompleted && (
        <div style={{ marginTop: 20, padding: 16, background: 'rgba(16,185,129,0.05)', borderRadius: 10, border: '1px solid rgba(16,185,129,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>🎉</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: '#10b981' }}>所有阶段已完成！</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>可以合并结果并导入到编辑中心</div>
            </div>
            <button onClick={handleImportAll} style={{ ...btnPrimaryStyle, background: '#10b981' }}>
              📥 合并导入
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '10px 14px', background: '#0f0f0f', border: '1px solid #2a2a2a',
  borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none',
}
const btnPrimaryStyle: React.CSSProperties = {
  padding: '8px 16px', background: '#8b5cf6', color: '#fff', border: 'none',
  borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
}
const btnSecondaryStyle: React.CSSProperties = {
  padding: '4px 10px', background: '#1f1f1f', color: '#9ca3af',
  border: '1px solid #2a2a2a', borderRadius: '4px', fontSize: '11px', cursor: 'pointer',
}
