import { useState } from 'react'
import { dispatchAI } from '@/services/aiDispatcher'

const CHUNK_SIZE = 1000

export type PolishMode =
  | 'standard'
  | 'literary'
  | 'simplify'
  | 'intensify'

function splitText(text: string, size = CHUNK_SIZE) {
  const arr: string[] = []
  for (let i = 0; i < text.length; i += size) {
    arr.push(text.slice(i, i + size))
  }
  return arr
}

export function usePolish() {
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)

  const polish = async (text: string, mode: PolishMode = 'standard') => {
    if (!text.trim()) return

    setLoading(true)
    setResult('')

    try {
      const chunks = splitText(text)

      let final = ''

      for (const chunk of chunks) {
        const res = await dispatchAI({
          type: 'polish',
          input: chunk,
          mode,
        })

        if (res.success && res.data) {
          final += res.data + '\n'
        } else {
          final += chunk + '\n' // fallback
        }
      }

      setResult(final)
    } catch (e) {
      console.error(e)
      setResult('润色失败')
    } finally {
      setLoading(false)
    }
  }

  return {
    result,
    loading,
    polish,
  }
}
