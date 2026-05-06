import { useState } from 'react'
import { useWriting } from '@/features/writing/useWriting'

export default function WritePage() {
  const [input, setInput] = useState('')
  const { content, loading, generate, continueWriting, clear } = useWriting()

  return (
    <div style={{ padding: 20 }}>
      <h2>AI 写作</h2>

      {/* 输入 */}
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="输入剧情 / 设定..."
        style={{ width: '100%', height: 100 }}
      />

      <div style={{ marginTop: 10 }}>
        <button onClick={() => generate(input)} disabled={loading}>
          {loading ? '生成中...' : '生成'}
        </button>

        <button onClick={continueWriting} disabled={loading}>
          续写
        </button>

        <button onClick={clear}>
          清空
        </button>
      </div>

      {/* 输出 */}
      <div style={{ marginTop: 20 }}>
        <h3>生成内容</h3>

        <div
          style={{
            whiteSpace: 'pre-wrap',
            border: '1px solid #ccc',
            padding: 10,
            minHeight: 200,
          }}
        >
          {content || '暂无内容'}
        </div>
      </div>
    </div>
  )
}
