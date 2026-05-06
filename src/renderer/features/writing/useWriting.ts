import { useState } from 'react'
import { dispatchAI } from '@/services/aiDispatcher'

const CHUNK_SIZE = 800

export function useWriting() {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)

  // 分段生成（核心）
  const generate = async (input: string) => {
    if (!input.trim()) return

    setLoading(true)

    try {
      const res = await dispatchAI({
        type: 'write',
        input,
        context: content,
      })

      if (res.success && res.data) {
        setContent(prev => prev + '\n\n' + res.data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // 续写（重点功能）
  const continueWriting = async () => {
    if (!content) return

    setLoading(true)

    try {
      const res = await dispatchAI({
        type: 'write',
        input: '请续写，剧情自然发展，不重复前文，控制在2-3段',
        context: content,
      })

      if (res.success && res.data) {
        setContent(prev => prev + '\n\n' + res.data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const clear = () => setContent('')

  return {
    content,
    loading,
    generate,
    continueWriting,
    clear,
  }
}
