import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../../store'
import type { AIModel, Conversation, ChatMessage, Character, Chapter, WorldSetting } from '../../../config/types'

/* ===================== 常量 ===================== */
const genId = (): string =>
  `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

/* ===================== AI 调用 ===================== */
async function callChatModel(
  model: AIModel,
  messages: { role: string; content: string }[],
  onChunk?: (text: string) => void
): Promise<string> {
  const url = `${model.baseUrl.replace(/\/$/, '')}/chat/completions`

  if (model.stream && onChunk) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${model.apiKey}`,
      },
      body: JSON.stringify({
        model: model.modelId,
        messages,
        temperature: model.temperature,
        max_tokens: model.maxTokens,
        stream: true,
      }),
    })
    if (!res.ok) {
      const err = await res.text().catch(() => 'Unknown error')
      throw new Error(`HTTP ${res.status}: ${err.slice(0, 200)}`)
    }
    const reader = res.body?.getReader()
    if (!reader) throw new Error('无法读取响应流')
    const decoder = new TextDecoder('utf-8')
    let full = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      for (const line of chunk.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]') continue
        if (trimmed.startsWith('data: ')) {
          try {
            const json = JSON.parse(trimmed.slice(6))
            const delta = json.choices?.[0]?.delta?.content
            if (typeof delta === 'string') {
              full += delta
              onChunk(full)
            }
          } catch {
            // 忽略解析失败的行
          }
        }
      }
    }
    return full
  } else {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${model.apiKey}`,
      },
      body: JSON.stringify({
        model: model.modelId,
        messages,
        temperature: model.temperature,
        max_tokens: model.maxTokens,
        stream: false,
      }),
    })
    if (!res.ok) {
      const err = await res.text().catch(() => 'Unknown error')
      throw new Error(`HTTP ${res.status}: ${err.slice(0, 200)}`)
    }
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content
    if (typeof content !== 'string') throw new Error('返回数据异常')
    return content
  }
}

/* ===================== System Prompt 构建 ===================== */
function buildSystemContext(
  novel: { title: string; summary: string } | null,
  characters: Character[],
  worldSettings: WorldSetting[],
  chapters: Chapter[],
  ctx: { characters: boolean; worldSettings: boolean; chapters: boolean }
): string {
  let sys = '你是一个专业的小说创作助手，擅长剧情分析、角色设计和文笔指导。'
  if (!novel) return sys

  sys += `\n\n当前小说：《${novel.title}》\n简介：${novel.summary}`

  if (ctx.characters && characters.length) {
    sys += '\n\n【角色设定】\n' + characters.map((c) =>
      `- ${c.name}（${c.roleType}）：${c.appearance || '外貌未知'}；性格：${c.personality.join('、') || '未知'}；背景：${c.background || '未知'}`
    ).join('\n')
  }
  if (ctx.worldSettings && worldSettings.length) {
    sys += '\n\n【世界观设定】\n' + worldSettings.map((w) =>
      `- ${w.name}（${w.worldType}）：${w.description || w.overview || '暂无描述'}`
    ).join('\n')
  }
  if (ctx.chapters && chapters.length) {
    const sorted = [...chapters].sort((a, b) => a.order - b.order).slice(0, 15)
    sys += '\n\n【章节概要】\n' + sorted.map((c) =>
      `- 第${c.order + 1}章 ${c.title}：${c.summary || '无概要'}`
    ).join('\n')
  }
  return sys
}

/* ===================== 通用 UI ===================== */
function Modal({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#00000099', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', width: '90%', maxWidth: '384px', padding: '20px' }}>
        <div style={{ fontSize: '14px', fontWeight: 500, color: '#e0e0e0', marginBottom: '12px' }}>{title}</div>
        {children}
      </div>
    </div>
  )
}

/* ===================== 主页面 ===================== */
export default function ChatPage() {
  const conversations = useAppStore((s) => s.conversations)
  const currentModel = useAppStore((s) => s.currentModel)
  const currentNovel = useAppStore((s) => s.currentNovel)
  const characters = useAppStore((s) => s.characters)
  const worldSettings = useAppStore((s) => s.worldSettings)
  const chapters = useAppStore((s) => s.chapters)

  const addConversation = useAppStore((s) => s.addConversation)
  const updateConversation = useAppStore((s) => s.updateConversation)
  const removeConversation = useAppStore((s) => s.removeConversation)
  const clearConversations = useAppStore((s) => s.clearConversations)

  const [activeId, setActiveId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showContextPanel, setShowContextPanel] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null

  /* 自动滚动到底部 */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [activeConversation?.messages, loading])

  /* 新建对话 */
  const createConversation = () => {
    const c: Conversation = {
      id: genId(),
      title: '新对话',
      messages: [],
      context: { characters: true, worldSettings: true, chapters: false },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    addConversation(c)
    setActiveId(c.id)
  }

  /* 发送消息 */
  const sendMessage = async () => {
    if (!input.trim() || !currentModel || !activeConversation) return

    const userMsg: ChatMessage = {
      id: genId(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    }

    const nextMessages = [...activeConversation.messages, userMsg]
    updateConversation(activeConversation.id, { messages: nextMessages })
    setInput('')
    setLoading(true)

    try {
      const sysContent = buildSystemContext(
        currentNovel,
        characters,
        worldSettings,
        chapters,
        activeConversation.context
      )

      const apiMessages = [
        { role: 'system', content: sysContent },
        ...nextMessages.map((m) => ({ role: m.role, content: m.content })),
      ]

      let assistantContent = ''
      if (currentModel.stream) {
        await callChatModel(currentModel, apiMessages, (partial) => {
          assistantContent = partial
          const assistantMsg: ChatMessage = {
            id: 'streaming',
            role: 'assistant',
            content: assistantContent,
            timestamp: Date.now(),
          }
          updateConversation(activeConversation.id, {
            messages: [...nextMessages, assistantMsg],
          })
        })
      } else {
        assistantContent = await callChatModel(currentModel, apiMessages)
      }

      const finalMsg: ChatMessage = {
        id: genId(),
        role: 'assistant',
        content: assistantContent,
        timestamp: Date.now(),
      }

      const finalMessages = [...nextMessages, finalMsg]
      updateConversation(activeConversation.id, {
        messages: finalMessages,
        title:
          activeConversation.title === '新对话' && nextMessages.length <= 1
            ? input.trim().slice(0, 20) || '新对话'
            : activeConversation.title,
      })
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e)
      const finalMessages = [
        ...nextMessages,
        {
          id: genId(),
          role: 'assistant' as const,
          content: `❌ 调用失败：${errMsg}`,
          timestamp: Date.now(),
        },
      ]
      updateConversation(activeConversation.id, { messages: finalMessages })
    } finally {
      setLoading(false)
    }
  }

  /* 切换上下文开关 */
  const toggleContext = (key: keyof Conversation['context']) => {
    if (!activeConversation) return
    updateConversation(activeConversation.id, {
      context: { ...activeConversation.context, [key]: !activeConversation.context[key] },
    })
  }

  return (
    <div style={{ height: '100%', display: 'flex' }}>
      {/* 左侧会话列表 */}
      <div style={{ width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid #2a2a2a', background: '#1a1a1a' }}>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', borderBottom: '1px solid #2a2a2a' }}>
          <span style={{ fontSize: '12px', fontWeight: 500, color: '#888' }}>历史会话</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={createConversation} style={{ padding: '4px 8px', borderRadius: '8px', fontSize: '12px', background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer' }}>+ 新建</button>
            {conversations.length > 0 && <button onClick={() => setConfirmClear(true)} style={{ padding: '4px 8px', borderRadius: '8px', fontSize: '12px', background: '#ef444415', color: '#ef4444', border: '1px solid #ef444430', cursor: 'pointer' }}>清空</button>}
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {conversations.map((c) => (
            <div key={c.id} onClick={() => setActiveId(c.id)} style={{
              padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px',
              background: activeId === c.id ? '#6366f126' : 'transparent', color: activeId === c.id ? '#6366f1' : '#888'
            }}>
              <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
              <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>{c.messages.length} 条消息 · {new Date(c.updatedAt).toLocaleDateString()}</div>
            </div>
          ))}
          {conversations.length === 0 && <div style={{ fontSize: '12px', color: '#555', padding: '40px 0', textAlign: 'center' }}>暂无会话</div>}
        </div>
      </div>

      {/* 右侧对话区 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!activeConversation ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>💬</div>
              <p style={{ fontSize: '14px', color: '#666', margin: '0 0 16px' }}>选择一个会话或新建对话开始聊天</p>
              <button onClick={createConversation} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '14px', background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer' }}>新建对话</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid #2a2a2a', background: '#1a1a1a' }}>
              <div style={{ fontSize: '14px', fontWeight: 500, color: '#e0e0e0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeConversation.title}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={() => setShowContextPanel((v) => !v)} style={{ padding: '4px 8px', borderRadius: '8px', fontSize: '12px', background: '#ffffff10', color: '#e0e0e0', border: 'none', cursor: 'pointer' }}>
                  上下文{showContextPanel ? '▲' : '▼'}
                </button>
                <button onClick={() => removeConversation(activeConversation.id)} style={{ padding: '4px 8px', borderRadius: '8px', fontSize: '12px', background: '#ef444415', color: '#ef4444', border: '1px solid #ef444430', cursor: 'pointer' }}>删除会话</button>
              </div>
            </div>

            {showContextPanel && (
              <div style={{ flexShrink: 0, padding: '8px 16px', borderBottom: '1px solid #2a2a2a', background: '#0f0f0f', display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px' }}>
                <span style={{ color: '#888' }}>引用小说上下文：</span>
                {(['characters', 'worldSettings', 'chapters'] as const).map((k) => (
                  <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ccc', cursor: 'pointer' }}>
                    <input type="checkbox" checked={activeConversation.context[k]} onChange={() => toggleContext(k)} style={{ accentColor: '#6366f1' }} />
                    {k === 'characters' ? '角色' : k === 'worldSettings' ? '世界观' : '章节'}
                  </label>
                ))}
                <span style={{ fontSize: '10px', color: '#555', marginLeft: 'auto' }}>模型: {currentModel?.name || '未选择'}</span>
              </div>
            )}

            <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activeConversation.messages.length === 0 && <div style={{ fontSize: '12px', color: '#555', padding: '40px 0', textAlign: 'center' }}>发送第一条消息开始对话</div>}
              {activeConversation.messages.map((msg, idx) => {
                const isUser = msg.role === 'user'
                return (
                  <div key={msg.id + idx} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '80%', borderRadius: '8px', padding: '10px 16px', fontSize: '14px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: isUser ? '#6366f1' : '#1a1a1a', color: isUser ? '#fff' : '#e0e0e0', border: isUser ? 'none' : '1px solid #2a2a2a' }}>
                      {msg.content}
                    </div>
                  </div>
                )
              })}
              {loading && activeConversation.messages[activeConversation.messages.length - 1]?.role !== 'assistant' && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '10px 16px', fontSize: '14px', color: '#888' }}>思考中...</div>
                </div>
              )}
            </div>

            <div style={{ flexShrink: 0, padding: '12px 16px', borderTop: '1px solid #2a2a2a', background: '#1a1a1a' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <textarea
                  rows={2}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  placeholder={currentModel ? '输入消息，Enter 发送，Shift+Enter 换行' : '请先配置并选择 AI 模型'}
                  disabled={!currentModel || loading}
                  style={{ flex: 1, padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', resize: 'none', opacity: (!currentModel || loading) ? 0.5 : 1, boxSizing: 'border-box' }}
                />
                <button disabled={!input.trim() || !currentModel || loading} onClick={sendMessage} style={{ flexShrink: 0, alignSelf: 'flex-end', padding: '8px 16px', borderRadius: '8px', fontSize: '14px', background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer', opacity: (!input.trim() || !currentModel || loading) ? 0.5 : 1 }}>发送</button>
              </div>
            </div>
          </>
        )}
      </div>

      {confirmClear && (
        <Modal title="确认清空全部会话">
          <p style={{ fontSize: '14px', color: '#e0e0e0', margin: '0 0 16px' }}>确定清空全部 {conversations.length} 个会话吗？此操作不可撤销。</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => { clearConversations(); setConfirmClear(false); setActiveId(null) }} style={{ background: '#ef444415', color: '#ef4444', border: '1px solid #ef444430', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer' }}>确认清空</button>
            <button onClick={() => setConfirmClear(false)} style={{ background: '#1a1a1a', color: '#e0e0e0', border: '1px solid #333', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer' }}>取消</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
