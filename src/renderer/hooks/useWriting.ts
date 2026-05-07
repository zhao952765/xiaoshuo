import { useState, useCallback, useRef } from 'react'
import { dispatchAI } from '@/services/aiDispatcher'

const CHUNK_SIZE = 800

export function useWriting() {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const generate = useCallback(async (input: string) => {
    if (!input.trim()) return
    setLoading(true)
    try {
      const res = await dispatchAI({ type: 'write', input, context: content })
      if (res.success && res.data) {
        setContent(prev => prev + '\n\n' + res.data)
      }
    } catch (e) {
      console.error('写作失败:', e)
    } finally {
      setLoading(false)
    }
  }, [content])

  const continueWriting = useCallback(async () => {
    if (!content) return
    setLoading(true)
    try {
      const res = await dispatchAI({
        type: 'write',
        input: '请续写，剧情自然发展，不重复前文',
        context: content,
      })
      if (res.success && res.data) {
        setContent(prev => prev + '\n\n' + res.data)
      }
    } catch (e) {
      console.error('续写失败:', e)
    } finally {
      setLoading(false)
    }
  }, [content])

  const clear = useCallback(() => setContent(''), [])

  return { content, loading, generate, continueWriting, clear }
}
