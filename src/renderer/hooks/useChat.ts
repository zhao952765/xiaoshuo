import { useState, useCallback, useRef } from 'react'
import { dispatchAI } from '@/services/aiDispatcher'
import { useMemory } from '@/hooks/useMemory'
import { extractMemory } from '@/hooks/memoryExtractor'

const MAX_HISTORY = 10

interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  const { buildMemoryPrompt, addMemory } = useMemory()

  const send = useCallback(async (text: string) => {
    if (!text.trim()) return

    const newMsg: ChatMsg = {
      id: `msg_${Date.now().toString(36)}`,
      role: 'user',
      content: text,
    }
    const history = [...messages, newMsg].slice(-MAX_HISTORY)
    setMessages(history)
    setLoading(true)

    try {
      const context = history.map(m => m.content).join('\n')
      const res = await dispatchAI({ type: 'chat', input: text, context, memory: buildMemoryPrompt() })

      if (!mountedRef.current) return

      if (res.success && res.data) {
        const aiMsg: ChatMsg = {
          id: `msg_${Date.now().toString(36)}_ai`,
          role: 'assistant',
          content: res.data,
        }
        setMessages([...history, aiMsg])
        extractMemory(res.data, addMemory)
      }
    } catch (e) {
      console.error('对话失败:', e)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [messages, buildMemoryPrompt, addMemory])

  return { messages, loading, send }
}
