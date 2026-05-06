import { useState } from 'react'
import { dispatchAI } from '@/services/aiDispatcher'
import { useMemory } from '@/features/memory/useMemory'
import { extractMemory } from '@/features/memory/memoryExtractor'

const MAX_HISTORY = 10

export function useChat() {
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const { buildMemoryPrompt, addMemory } = useMemory()

  const send = async (text: string) => {
    if (!text.trim()) return

    const newMsg = {
      role: 'user',
      content: text,
    }

    const history = [...messages, newMsg].slice(-MAX_HISTORY)

    setMessages(history)
    setLoading(true)

    try {
      const context = history.map(m => m.content).join('\n')

      const res = await dispatchAI({
        type: 'chat',
        input: text,
        context,
        memory: buildMemoryPrompt(),
      })

      if (res.success && res.data) {
        const aiMsg = {
          role: 'assistant',
          content: res.data,
        }

        setMessages([...history, aiMsg])

        // ⭐ 自动提取记忆（关键）
        extractMemory(res.data, addMemory)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return {
    messages,
    loading,
    send,
  }
}
