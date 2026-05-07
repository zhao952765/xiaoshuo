import { useState, useCallback } from 'react'
import { usePolish } from '@/hooks/usePolish'
import type { PolishMode } from '@/hooks/usePolish'
import PageWrapper from '../../components/PageWrapper'
import { Card, Btn, Textarea, Select, Empty } from '../../components/ui'

const MODE_OPTIONS: { value: PolishMode; label: string }[] = [
  { value: 'standard', label: '标准润色' },
  { value: 'literary', label: '文学增强' },
  { value: 'simplify', label: '简化表达' },
  { value: 'intensify', label: '情绪增强' },
]

export default function PolishPage() {
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<PolishMode>('standard')
  const { result, loading, polish } = usePolish()

  const handlePolish = useCallback(() => {
    if (!input.trim()) return
    polish(input, mode)
  }, [input, mode, polish])

  return (
    <PageWrapper title="✨ 润色区" subtitle="AI 文本润色，提升文笔质量">
      <Card>
        <div style={{ fontSize: '13px', fontWeight: 500, color: '#aaa', marginBottom: '10px' }}>原文</div>
        <textarea value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="粘贴需要润色的文本…"
          rows={6}
          style={{ width: '100%', padding: '12px 14px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#f0f0f0', fontSize: '14px', lineHeight: 1.6, resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
          <select value={mode} onChange={(e) => setMode(e.target.value as PolishMode)}
            style={{ padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#f0f0f0', fontSize: '13px', outline: 'none' }}>
            {MODE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <Btn variant="primary" size="md" onClick={handlePolish} loading={loading} disabled={loading || !input.trim()}>
            ✨ 开始润色
          </Btn>
        </div>
      </Card>

      {result && (
        <Card>
          <div style={{ fontSize: '13px', fontWeight: 500, color: '#aaa', marginBottom: '10px' }}>
            润色结果 ({result.length} 字)
          </div>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px', color: '#ccc', lineHeight: 1.8, minHeight: 150 }}>
            {result}
          </div>
        </Card>
      )}
    </PageWrapper>
  )
}
