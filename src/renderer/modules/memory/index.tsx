/**
 * 记忆系统（Memory System）增强版
 * SRS v2.3 低优先级：LLM 调用统计、自动/手动记忆
 */

import React, { useState, useMemo } from 'react'
import { useStore } from '../../store'

export default function MemoryPage() {
  const memories = useStore((s) => s.memories)
  const addMemory = useStore((s) => s.addMemory)
  const removeMemory = useStore((s) => s.removeMemory)
  const clearMemories = useStore((s) => s.clearMemories)
  const logs = useStore((s) => s.logs)
  const addLog = useStore((s) => s.addLog)

  const [filter, setFilter] = useState<'all' | 'auto' | 'manual' | 'llm' | 'error'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // 统计
  const stats = useMemo(() => {
    const llmLogs = logs.filter((l) => l.type === 'success' && l.message.includes('AI'))
    const totalTokens = llmLogs.reduce((sum, l) => sum + (l.detail?.length || 0), 0)
    return {
      total: memories.length,
      auto: memories.filter((m) => m.type === 'auto').length,
      manual: memories.filter((m) => m.type === 'manual').length,
      llm: memories.filter((m) => m.type === 'llm').length,
      error: memories.filter((m) => m.type === 'error').length,
      llmCalls: llmLogs.length,
      estTokens: totalTokens * 2, // 粗略估算
    }
  }, [memories, logs])

  const filtered = memories.filter((m) => {
    const matchType = filter === 'all' || m.type === filter
    const matchSearch = !searchQuery || m.content.includes(searchQuery) || m.source.includes(searchQuery)
    return matchType && matchSearch
  })

  const handleAddManual = () => {
    const content = prompt('输入记忆内容：')
    if (!content) return
    addMemory({
      id: `mem_${Date.now()}`,
      type: 'manual',
      content,
      source: '用户手动添加',
      tags: [],
      modelName: null,
      projectId: null,
      timestamp: Date.now(),
      duration: null,
    })
    addLog({ type: 'success', message: '添加手动记忆', detail: content.slice(0, 50) })
  }

  const handleExport = () => {
    const data = JSON.stringify(memories, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `memories_${Date.now()}.json`
    a.click()
  }

  return (
    <div style={{ padding: '24px', color: '#e0e0e0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>🧠 记忆系统</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleAddManual} style={btnSecondaryStyle}>➕ 手动添加</button>
          <button onClick={handleExport} style={btnSecondaryStyle}>📤 导出</button>
          <button onClick={clearMemories} style={{ ...btnDangerStyle, fontSize: 12 }}>🗑️ 清空</button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
        <StatBox label="总记忆" value={stats.total} color="#8b5cf6" />
        <StatBox label="自动" value={stats.auto} color="#10b981" />
        <StatBox label="手动" value={stats.manual} color="#3b82f6" />
        <StatBox label="LLM" value={stats.llm} color="#f59e0b" />
        <StatBox label="错误" value={stats.error} color="#ef4444" />
        <StatBox label="AI 调用" value={stats.llmCalls} color="#ec4899" />
      </div>

      {/* 筛选 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索记忆..."
          style={{ ...inputStyle, width: 200 }}
        />
        {(['all', 'auto', 'manual', 'llm', 'error'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '4px 10px', borderRadius: 4, fontSize: 12,
              background: filter === f ? 'rgba(139,92,246,0.15)' : '#0f0f0f',
              color: filter === f ? '#a78bfa' : '#9ca3af',
              border: '1px solid #2a2a2a', cursor: 'pointer',
            }}
          >
            {f === 'all' ? '全部' : f === 'auto' ? '自动' : f === 'manual' ? '手动' : f === 'llm' ? 'LLM' : '错误'}
          </button>
        ))}
      </div>

      {/* 记忆列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map((mem) => (
          <div key={mem.id} style={{
            padding: 12, background: '#0a0a0a', borderRadius: 8,
            border: '1px solid #1a1a1a', display: 'flex', gap: 12, alignItems: 'flex-start',
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0,
              background: mem.type === 'auto' ? '#10b981' : mem.type === 'manual' ? '#3b82f6' : mem.type === 'llm' ? '#f59e0b' : '#ef4444',
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ color: '#e0e0e0', fontSize: 13, lineHeight: 1.6 }}>{mem.content}</div>
              <div style={{ color: '#4b5563', fontSize: 11, marginTop: 4, display: 'flex', gap: 8 }}>
                <span>来源: {mem.source}</span>
                <span>时间: {new Date(mem.timestamp).toLocaleString()}</span>
                {mem.modelName && <span>模型: {mem.modelName}</span>}
              </div>
            </div>
            <button
              onClick={() => removeMemory(mem.id)}
              style={{ ...btnDangerStyle, fontSize: 11, padding: '2px 6px' }}
            >
              ×
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>暂无记忆</div>
        )}
      </div>
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ padding: 12, background: '#0a0a0a', borderRadius: 8, textAlign: 'center', border: '1px solid #1a1a1a' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{label}</div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a',
  borderRadius: '6px', color: '#e0e0e0', fontSize: '13px', outline: 'none',
}
const btnSecondaryStyle: React.CSSProperties = {
  padding: '6px 12px', background: '#1f1f1f', color: '#9ca3af',
  border: '1px solid #2a2a2a', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
}
const btnDangerStyle: React.CSSProperties = {
  padding: '6px 12px', background: '#ef4444', color: '#fff', border: 'none',
  borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
}
