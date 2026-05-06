import { useState } from 'react'
import { dispatchAI } from '@/services/aiDispatcher'
import { deduceTransformer, DeduceResult } from '@/utils/deduceTransformer'

export default function DeducePage() {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<DeduceResult | null>(null)
  const [loading, setLoading] = useState(false)

  const handleRun = async () => {
    if (!input.trim()) return

    setLoading(true)

    try {
      const { parse } = deduceTransformer(input)

      const res = await dispatchAI({
        type: 'deduce',
        input,
      })

      const parsed = parse(res)

      setResult(parsed)
    } catch (e) {
      console.error(e)

      setResult({
        outline: '',
        details: '系统异常',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>剧情推导</h2>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="输入剧情设定..."
        style={{ width: '100%', height: 120 }}
      />

      <button onClick={handleRun} disabled={loading}>
        {loading ? '推导中...' : '开始推导'}
      </button>

      {result && (
        <div style={{ marginTop: 20 }}>
          <h3>大纲</h3>
          <pre>{result.outline}</pre>

          <h3>详细</h3>
          <pre>{result.details}</pre>
        </div>
      )}
    </div>
  )
}