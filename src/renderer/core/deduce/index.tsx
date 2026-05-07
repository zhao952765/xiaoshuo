/**
 * 一键推导页面 - 设计系统版
 * 深色现代风格，主色 #FF4D94
 */
import { useState } from 'react'
import { dispatchAI } from '@/services/aiDispatcher'
import { deduceTransformer } from '@/utils/deduceTransformer'
import type { DeduceResult } from '@/utils/deduceTransformer'
import PageWrapper from '../../components/PageWrapper'
import { theme } from '../../components/ui'

export default function DeducePage() {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<DeduceResult | null>(null)
  const [loading, setLoading] = useState(false)

  const handleRun = async () => {
    if (!input.trim()) return
    setLoading(true)
    try {
      const { parse } = deduceTransformer(input)
      const res = await dispatchAI({ type: 'deduce', input })
      setResult(parse(res))
    } catch {
      setResult({ outline: '', details: '系统异常' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageWrapper
      title="一键推导"
      subtitle="输入剧情设定，AI 自动推导大纲与详细展开"
    >
      {/* 输入区 */}
      <div style={{
        background: theme.bg.surface,
        border: `1px solid ${theme.border.subtle}`,
        borderRadius: '12px',
        padding: '20px',
      }}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: theme.text.secondary, marginBottom: '10px' }}>
          剧情设定
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入故事的核心设定、主题、角色关系、世界观…"
          rows={5}
          style={{
            width: '100%',
            padding: '12px 14px',
            background: '#0f0f0f',
            border: '1px solid #2a2a2a',
            borderRadius: '8px',
            color: '#f0f0f0',
            fontSize: '14px',
            lineHeight: 1.6,
            resize: 'vertical',
            fontFamily: 'inherit',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
          <span style={{ fontSize: '11px', color: theme.text.tertiary }}>{input.length} 字</span>
          <button
            onClick={handleRun}
            disabled={loading || !input.trim()}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '10px 24px',
              background: loading ? 'rgba(255,77,148,0.5)' : '#FF4D94',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: (loading || !input.trim()) ? 'not-allowed' : 'pointer',
              opacity: !input.trim() ? 0.4 : 1,
              transition: 'all 0.15s',
            }}
          >
            {loading && (
              <span style={{
                width: 14, height: 14,
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                display: 'inline-block',
              }} />
            )}
            {loading ? '推导中...' : '🎯 开始推导'}
          </button>
        </div>
      </div>

      {/* 结果区 */}
      {result && (
        <div className="animate-fade-in" style={{
          background: theme.bg.surface,
          border: '1px solid rgba(255,77,148,0.15)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}>
          {/* 结果头部 */}
          <div style={{
            padding: '14px 16px',
            background: 'rgba(255,77,148,0.06)',
            borderBottom: '1px solid rgba(255,77,148,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <span style={{ fontSize: '18px' }}>📋</span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#FF4D94' }}>推导结果</span>
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: theme.text.tertiary }}>
              {result.outline.length + result.details.length} 字
            </span>
          </div>

          {/* 大纲 */}
          <div style={{ padding: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#FF4D94', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              故事大纲
            </div>
            <div style={{
              background: '#0f0f0f',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              padding: '14px',
              fontSize: '13px',
              color: '#ccc',
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
              fontFamily: 'inherit',
              maxHeight: '200px',
              overflow: 'auto',
            }}>
              {result.outline || '（无大纲）'}
            </div>
          </div>

          {/* 详细 */}
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#FF4D94', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              详细展开
            </div>
            <div style={{
              background: '#0f0f0f',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              padding: '14px',
              fontSize: '13px',
              color: '#ccc',
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
              fontFamily: 'inherit',
              maxHeight: '400px',
              overflow: 'auto',
            }}>
              {result.details || '（无详细内容）'}
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  )
}
