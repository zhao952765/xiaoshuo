import { useState } from 'react'
import { usePolish, PolishMode } from '@/features/polish/usePolish'

export default function PolishPage() {
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<PolishMode>('standard')

  const { result, loading, polish } = usePolish()

  return (
    <div style={{ padding: 20 }}>
      <h2>文本润色</h2>

      {/* 输入 */}
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="粘贴需要润色的文本..."
        style={{ width: '100%', height: 150 }}
      />

      {/* 模式选择 */}
      <div style={{ marginTop: 10 }}>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as PolishMode)}
        >
          <option value="standard">标准润色</option>
          <option value="literary">文学增强</option>
          <option value="simplify">简化表达</option>
          <option value="intensify">情绪增强</option>
        </select>

        <button
          onClick={() => polish(input, mode)}
          disabled={loading}
          style={{ marginLeft: 10 }}
        >
          {loading ? '润色中...' : '开始润色'}
        </button>
      </div>

      {/* 输出 */}
      <div style={{ marginTop: 20 }}>
        <h3>润色结果</h3>

        <div
          style={{
            whiteSpace: 'pre-wrap',
            border: '1px solid #ccc',
            padding: 10,
            minHeight: 200,
          }}
        >
          {result || '暂无内容'}
        </div>
      </div>
    </div>
  )
}