/**
 * AI 对话（Chat）增强版
 * SRS v2.3 低优先级：上下文自动注入（梗概/角色/标签/当前章节）
 */

import React, { useState, useRef, useCallback } from 'react'
import { useStore } from '../../store'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export default function ChatPage() {
  const currentNovel = useStore((s) => s.currentNovel)
  const characters = useStore((s) => s.characters)
  const chapters = useStore((s) => s.chapters)
  const tags = useStore((s) => s.tags)
  const emotionArc = useStore((s) => s.emotionArc)
  const currentModel = useStore((s) => s.currentModel)
  const addLog = useStore((s) => s.addLog)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [contextConfig, setContextConfig] = useState({
    includeSynopsis: true,
    includeCharacters: true,
    includeTags: true,
    includeCurrentChapter: true,
    includeEmotionArc: false,
  })
  const abortRef = useRef<AbortController | null>(null)

  // 构建上下文注入
  const buildContextPrompt = useCallback(() => {
    const parts: string[] = []

    if (contextConfig.includeSynopsis && currentNovel) {
      parts.push(`【小说信息】\n标题：${currentNovel.title}\n简介：${currentNovel.summary}`)
    }

    if (contextConfig.includeCharacters && characters.length > 0) {
      parts.push(`【角色信息】\n${characters.map((c) => `- ${c.name}（${c.roleType === 'protagonist' ? '主角' : '配角'}）：${c.personality.join('、')} | ${c.appearance}`).join('\n')}`)
    }

    if (contextConfig.includeTags && tags.length > 0) {
      parts.push(`【标签】${tags.map((t) => t.name).join('、')}`)
    }

    if (contextConfig.includeCurrentChapter && chapters.length > 0) {
      const currentCh = chapters.find((c) => c.status === 'completed') || chapters[0]
      if (currentCh) {
        parts.push(`【当前章节】${currentCh.title}\n${currentCh.content?.slice(0, 500) || '（暂无内容）'}`)
      }
    }

    if (contextConfig.includeEmotionArc && emotionArc) {
      const nextNode = emotionArc.timeline.find((t) => t.order === (chapters.find((c) => c.status === 'completed')?.order || 0) + 1)
      if (nextNode) {
        parts.push(`【下一感情节点】${nextNode.title}（${nextNode.type}）`)
      }
    }

    return parts.join('\n\n')
  }, [currentNovel, characters, tags, chapters, emotionArc, contextConfig])

  const handleSend = useCallback(async () => {
    if (!input.trim() || !currentModel) return

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsLoading(true)
    abortRef.current = new AbortController()

    const context = buildContextPrompt()
    const systemPrompt = `你是一位专业的小说创作助手。请根据以下项目上下文回答问题或提供建议：\n\n${context}\n\n请保持回答简洁、专业，直接针对创作问题给出 actionable 的建议。`

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
            { role: 'system', content: systemPrompt },
            ...messages.slice(-5).map((m) => ({ role: m.role, content: m.content })),
            { role: 'user', content: input },
          ],
          temperature: 0.8,
          max_tokens: 2000,
          stream: true,
        }),
        signal: abortRef.current.signal,
      })

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''
      const assistantId = `msg_${Date.now() + 1}`

      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '', timestamp: Date.now() }])

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
              assistantContent += text
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: assistantContent } : m)),
              )
            } catch {}
          }
        }
      }

      addLog({ type: 'success', message: 'AI 对话完成', detail: `上下文${context.length}字` })
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        addLog({ type: 'error', message: 'AI 对话失败', detail: err.message })
      }
    } finally {
      setIsLoading(false)
    }
  }, [input, currentModel, messages, buildContextPrompt, addLog])

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', background: '#050505' }}>
      {/* 左侧上下文配置 */}
      <div style={{ width: 260, flexShrink: 0, background: '#0a0a0a', borderRight: '1px solid #1a1a1a', padding: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e0e0e0', marginBottom: 12 }}>💡 上下文注入</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { key: 'includeSynopsis', label: '📖 小说梗概' },
            { key: 'includeCharacters', label: '👤 角色信息' },
            { key: 'includeTags', label: '🏷️ 标签' },
            { key: 'includeCurrentChapter', label: '📑 当前章节' },
            { key: 'includeEmotionArc', label: '💕 感情线节点' },
          ].map((item) => (
            <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#9ca3af' }}>
              <input
                type="checkbox"
                checked={contextConfig[item.key as keyof typeof contextConfig]}
                onChange={(e) => setContextConfig((p) => ({ ...p, [item.key]: e.target.checked }))}
                style={{ accentColor: '#8b5cf6' }}
              />
              {item.label}
            </label>
          ))}
        </div>

        {/* 上下文预览 */}
        <div style={{ marginTop: 16, padding: 10, background: '#0f0f0f', borderRadius: 6, border: '1px solid #2a2a2a' }}>
          <h4 style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>上下文预览 ({buildContextPrompt().length}字)</h4>
          <div style={{ fontSize: 11, color: '#4b5563', maxHeight: 200, overflow: 'auto', lineHeight: 1.5 }}>
            {buildContextPrompt().slice(0, 300)}...
          </div>
        </div>
      </div>

      {/* 右侧对话区 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* 消息列表 */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
              <div>开始与 AI 助手对话</div>
              <div style={{ fontSize: 12, marginTop: 8 }}>自动注入项目上下文，获得更精准的建议</div>
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                padding: '10px 14px',
                borderRadius: 10,
                background: msg.role === 'user' ? 'rgba(139,92,246,0.15)' : '#0a0a0a',
                color: msg.role === 'user' ? '#e0e0e0' : '#d1d5db',
                border: msg.role === 'user' ? '1px solid rgba(139,92,246,0.3)' : '1px solid #1a1a1a',
                fontSize: 14,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}
            >
              {msg.content || (msg.role === 'assistant' && isLoading ? '⏳ 思考中...' : '')}
            </div>
          ))}
        </div>

        {/* 输入区 */}
        <div style={{ padding: 12, background: '#0a0a0a', borderTop: '1px solid #1a1a1a', display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="输入问题，AI 将结合项目上下文回答..."
            disabled={isLoading}
            style={{
              flex: 1, padding: '10px 14px', background: '#0f0f0f', border: '1px solid #2a2a2a',
              borderRadius: 8, color: '#e0e0e0', fontSize: 14, outline: 'none',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || !currentModel}
            style={{
              padding: '10px 20px', background: '#8b5cf6', color: '#fff', border: 'none',
              borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              opacity: !input.trim() || isLoading || !currentModel ? 0.5 : 1,
            }}
          >
            {isLoading ? '⏳' : '发送'}
          </button>
        </div>
      </div>
    </div>
  )
}
