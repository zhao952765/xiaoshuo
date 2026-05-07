import { useState, useCallback, useRef } from 'react'
import { useWriting } from '@/hooks/useWriting'
import PageWrapper from '../../components/PageWrapper'
import { Card, Btn, Textarea, Empty } from '../../components/ui'

export default function WritePage() {
  const [input, setInput] = useState('')
  const { content, loading, generate, continueWriting, clear } = useWriting()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleGenerate = useCallback(() => {
    if (!input.trim()) return
    generate(input)
  }, [input, generate])

  return (
    <PageWrapper title="✍️ 写作区" subtitle="AI 辅助创作，随时续写和调整">
      <Card>
        <div style={{ fontSize: '13px', fontWeight: 500, color: '#aaa', marginBottom: '10px' }}>输入剧情 / 设定</div>
        <textarea ref={textareaRef} value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入故事设定、角色对话、场景描述…"
          rows={4}
          style={{ width: '100%', padding: '12px 14px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#f0f0f0', fontSize: '14px', lineHeight: 1.6, resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Btn variant="primary" size="md" onClick={handleGenerate} loading={loading} disabled={loading || !input.trim()}>🚀 生成</Btn>
          <Btn variant="secondary" size="md" onClick={continueWriting} loading={loading} disabled={loading || !content}>📝 续写</Btn>
          <Btn variant="ghost" size="sm" onClick={clear} disabled={!content} style={{ marginLeft: 'auto' }}>🗑️ 清空</Btn>
        </div>
      </Card>

      <Card>
        <div style={{ fontSize: '13px', fontWeight: 500, color: '#aaa', marginBottom: '10px' }}>
          生成内容 ({content.length} 字)
        </div>
        {content ? (
          <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px', color: '#ccc', lineHeight: 1.8, minHeight: 200 }}>
            {content}
          </div>
        ) : (
          <Empty icon="📝" message="暂无内容" submessage="输入设定后点击生成" />
        )}
      </Card>
    </PageWrapper>
  )
}
