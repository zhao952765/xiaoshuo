import { useState, useCallback, useRef } from 'react'
import { dispatchAI } from '@/services/aiDispatcher'

const CHUNK_SIZE = 1000

export type PolishMode = 'standard' | 'literary' | 'simplify' | 'intensify'

function splitText(text: string, size = CHUNK_SIZE): string[] {
  const arr: string[] = []
  let start = 0
  // 智能分割：在段落边界分割
  while (start < text.length) {
    let end = Math.min(start + size, text.length)
    if (end < text.length) {
      // 向前找最近的段落分隔
      const nextPara = text.indexOf('\n\n', end - 100)
      if (nextPara > start + 50 && nextPara < end + 200) {
        end = nextPara + 2
      } else {
        // 找最近的句子结尾
        const nextSentence = text.search(/[。！？\n]/, end - 50)
        if (nextSentence > start + 50 && nextSentence < end + 100) {
          end = nextSentence + 1
        }
      }
    }
    arr.push(text.slice(start, end).trim())
    start = end
  }
  return arr.filter(Boolean)
}

export function usePolish() {
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)

  const polish = useCallback(async (text: string, mode: PolishMode = 'standard') => {
    if (!text.trim()) return
    setLoading(true)
    setResult('')

    try {
      const chunks = splitText(text)
      let final = ''
      for (const chunk of chunks) {
        const res = await dispatchAI({ type: 'polish', input: chunk, mode })
        if (res.success && res.data) {
          final += res.data + '\n'
        } else {
          final += chunk + '\n'
        }
      }
      setResult(final)
    } catch (e) {
      console.error('润色失败:', e)
      setResult('润色失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [])

  return { result, loading, polish }
}
