import { useState } from 'react'
import { useChat } from '@/features/chat/useChat'

export default function ChatPage() {
  const [input, setInput] = useState('')
  const { messages, send, loading } = useChat()

  return (
    <div style={{ padding: 20 }}>
      <h2>AI 对话（带记忆）</h2>

      <div style={{ minHeight: 300 }}>
        {messages.map((m, i) => (
          <div key={i}>
            <b>{m.role}：</b> {m.content}
          </div>
        ))}
      </div>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />

      <button onClick={() => send(input)} disabled={loading}>
        发送
      </button>
    </div>
  )
}
