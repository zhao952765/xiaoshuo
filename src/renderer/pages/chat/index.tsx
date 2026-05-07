import { useState, useCallback, useEffect, useRef } from 'react'
import { useChat } from '@/hooks/useChat'
import PageWrapper from '../../components/PageWrapper'
import { Card, Btn, Textarea, Empty } from '../../components/ui'

export default function ChatPage() {
  const [input, setInput] = useState('')
  const { messages, send, loading } = useChat()
  const listRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = useCallback(() => {
    if (!input.trim() || loading) return
    abortRef.current = new AbortController()
    send(input).finally(() => { setInput(''); abortRef.current = null })
  }, [input, loading, send])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }, [handleSend])

  return (
    <PageWrapper title="💬 AI 对话" subtitle="与 AI 助手对话，自动提取记忆">
      <Card style={{ display: 'flex', flexDirection: 'column', height: '500px', padding: 0 }}>
        <div ref={listRef} style={{ flex: 1, overflow: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {messages.length === 0 ? (
            <Empty icon="💬" message="开始与 AI 对话" submessage="输入你的问题或想法" />
          ) : (
            messages.map((m: any) => (
              <div key={m.id || Math.random().toString()} style={{
                maxWidth: '80%', padding: '10px 14px',
                borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: m.role === 'user' ? 'rgba(255,77,148,0.15)' : '#1a1a1a',
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                color: '#f0f0f0', fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap',
              }}>
                {m.content}
              </div>
            ))
          )}
          {loading && (
            <div style={{ alignSelf: 'flex-start', padding: '10px 14px', borderRadius: '16px', background: '#1a1a1a', fontSize: '13px', color: '#888' }}>
              <span className="animate-pulse">AI 思考中…</span>
            </div>
          )}
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid #2a2a2a', display: 'flex', gap: 8 }}>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="输入消息，Enter 发送，Shift+Enter 换行…"
            rows={2}
            style={{ flex: 1, padding: '10px 14px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#f0f0f0', fontSize: '13px', outline: 'none', fontFamily: 'inherit', resize: 'none' }}
          />
          <Btn variant="primary" size="md" onClick={handleSend} loading={loading} disabled={loading || !input.trim()} style={{ alignSelf: 'flex-end' }}>
            发送
          </Btn>
        </div>
      </Card>
    </PageWrapper>
  )
}
