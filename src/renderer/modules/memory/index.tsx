import { useState, useMemo } from 'react'
import { useAppStore } from '../../store'
import PageWrapper from '../../components/PageWrapper'
import type { Memory, MemoryType } from '../../../config/types'

/* ===================== 常量 ===================== */
const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  auto: '自动',
  manual: '手动',
  llm: 'AI生成',
  error: '错误',
}

const MEMORY_TYPE_COLORS: Record<MemoryType, string> = {
  auto: '#f59e0b',
  manual: '#6366f1',
  llm: '#10b981',
  error: '#ef4444',
}

const genId = (): string =>
  `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

/* ===================== 通用 UI ===================== */
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#00000099', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', width: '90%', maxWidth: '576px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #2a2a2a' }}>
          <div style={{ fontSize: '14px', fontWeight: 500, color: '#e0e0e0' }}>{title}</div>
          <button onClick={onClose} style={{ color: '#666', border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>{children}</div>
      </div>
    </div>
  )
}

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} style={{ width: '100%', padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box', ...(props.style || {}) }} />
)

const TextArea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...props} style={{ width: '100%', padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box', ...(props.style || {}) }} />
)

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...props} style={{ width: '100%', padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box', ...(props.style || {}) }} />
)

const BtnPrimary = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button {...props} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '14px', background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer', opacity: props.disabled ? 0.5 : 1, ...(props.style || {}) }} />
)

const BtnSecondary = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button {...props} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '14px', background: '#ffffff10', color: '#e0e0e0', border: 'none', cursor: 'pointer', ...(props.style || {}) }} />
)

const BtnDanger = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button {...props} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '14px', background: '#ef444415', color: '#ef4444', border: 'none', cursor: 'pointer', ...(props.style || {}) }} />
)

/* ===================== 主页面 ===================== */
export default function MemoryPage() {
  const memories = useAppStore((s) => s.memories)
  const tags = useAppStore((s) => s.tags)
  const currentNovel = useAppStore((s) => s.currentNovel)

  const addMemory = useAppStore((s) => s.addMemory)
  const updateMemory = useAppStore((s) => s.updateMemory)
  const removeMemory = useAppStore((s) => s.removeMemory)
  const clearMemories = useAppStore((s) => s.clearMemories)

  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<MemoryType | 'all'>('all')
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Memory | null>(null)
  const [showClearAll, setShowClearAll] = useState(false)

  const sorted = useMemo(() => {
    let list = [...memories].sort((a, b) => b.timestamp - a.timestamp)
    if (search.trim()) {
      const s = search.trim().toLowerCase()
      list = list.filter((m) => m.content.toLowerCase().includes(s) || m.source.toLowerCase().includes(s))
    }
    if (tagFilter) {
      list = list.filter((m) => m.tags.includes(tagFilter))
    }
    if (typeFilter !== 'all') {
      list = list.filter((m) => m.type === typeFilter)
    }
    return list
  }, [memories, search, tagFilter, typeFilter])

  const stats = useMemo(() => {
    return {
      total: memories.length,
      manual: memories.filter((m) => m.type === 'manual').length,
      llm: memories.filter((m) => m.type === 'llm').length,
      auto: memories.filter((m) => m.type === 'auto').length,
    }
  }, [memories])

  /* ---- 表单 ---- */
  const MemoryForm = ({ memory, onSave }: { memory?: Memory; onSave: (m: Memory) => void }) => {
    const [draft, setDraft] = useState<Memory>(
      memory ?? {
        id: genId(),
        type: 'manual',
        content: '',
        source: '用户手动创建',
        tags: [],
        modelName: null,
        projectId: currentNovel?.id ?? null,
        timestamp: Date.now(),
        duration: null,
      }
    )
    const [tagInput, setTagInput] = useState('')

    const addTag = (name: string) => {
      const trimmed = name.trim()
      if (!trimmed || draft.tags.includes(trimmed)) return
      setDraft((d) => ({ ...d, tags: [...d.tags, trimmed] }))
      setTagInput('')
    }

    const removeTag = (name: string) => {
      setDraft((d) => ({ ...d, tags: d.tags.filter((t) => t !== name) }))
    }

    return (
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-[#888] mb-1">内容</label>
          <TextArea
            rows={6}
            value={draft.content}
            onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
            placeholder="输入记忆内容..."
          />
        </div>
        <div>
          <label className="block text-xs text-[#888] mb-1">来源</label>
          <Input value={draft.source} onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))} placeholder="来源描述" />
        </div>
        <div>
          <label className="block text-xs text-[#888] mb-1">类型</label>
          <Select value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as MemoryType }))}>
            {(Object.keys(MEMORY_TYPE_LABELS) as MemoryType[]).map((t) => (
              <option key={t} value={t}>{MEMORY_TYPE_LABELS[t]}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="block text-xs text-[#888] mb-1">关联标签</label>
          <div className="flex flex-wrap gap-1 mb-2">
            {draft.tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-[#6366f1]/15 text-[#6366f1]">
                {t}
                <button onClick={() => removeTag(t)} className="hover:text-white">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="输入标签名称回车添加"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput) } }}
              className="flex-1"
            />
            <Select
              value=""
              onChange={(e) => { if (e.target.value) addTag(e.target.value) }}
              className="w-[140px]"
            >
              <option value="">从已有标签选择</option>
              {tags.map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <BtnPrimary disabled={!draft.content.trim()} onClick={() => onSave(draft)}>
            保存
          </BtnPrimary>
          <BtnSecondary onClick={() => setEditingMemory(null)}>取消</BtnSecondary>
        </div>
      </div>
    )
  }

  /* ---- 渲染 ---- */
  return (
    <PageWrapper
      title="记忆系统"
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setEditingMemory({ id: genId(), type: 'manual', content: '', source: '用户手动创建', tags: [], modelName: null, projectId: currentNovel?.id ?? null, timestamp: Date.now(), duration: null })} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer' }}>+ 新建记忆</button>
          {memories.length > 0 && <button onClick={() => setShowClearAll(true)} style={{ background: '#ef444415', color: '#ef4444', border: '1px solid #ef444430', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer' }}>清空全部</button>}
        </div>
      }
    >
      {/* 统计 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: '总记忆', value: stats.total, color: '#6366f1' },
          { label: '手动', value: stats.manual, color: '#6366f1' },
          { label: 'AI生成', value: stats.llm, color: '#10b981' },
          { label: '自动', value: stats.auto, color: '#f59e0b' },
        ].map((s) => (
          <div key={s.label} style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: '#666' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* 工具栏 */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <Input placeholder="搜索记忆内容..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '200px' }} />
        <Select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} style={{ width: '140px' }}>
          <option value="">全部标签</option>
          {tags.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
        </Select>
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as MemoryType | 'all')} style={{ width: '120px' }}>
          <option value="all">全部类型</option>
          {(Object.keys(MEMORY_TYPE_LABELS) as MemoryType[]).map((t) => <option key={t} value={t}>{MEMORY_TYPE_LABELS[t]}</option>)}
        </Select>
        <div style={{ flex: 1 }} />
      </div>

      {/* 列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {sorted.length === 0 ? (
          <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px' }}>
            <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>暂无记忆</p>
          </div>
        ) : (
          sorted.map((m) => (
            <div key={m.id} style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '8px', border: `1px solid ${MEMORY_TYPE_COLORS[m.type]}30`, color: MEMORY_TYPE_COLORS[m.type], background: `${MEMORY_TYPE_COLORS[m.type]}10` }}>
                      {MEMORY_TYPE_LABELS[m.type]}
                    </span>
                    <span style={{ fontSize: '11px', color: '#666' }}>{new Date(m.timestamp).toLocaleString()}</span>
                    {m.modelName && <span style={{ fontSize: '11px', color: '#555' }}>模型: {m.modelName}</span>}
                  </div>
                  <div style={{ fontSize: '14px', color: '#e0e0e0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.content}</div>
                  <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                    {m.tags.map((t) => <span key={t} style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '8px', background: '#ffffff10', color: '#888' }}>{t}</span>)}
                    <span style={{ fontSize: '10px', color: '#555' }}>来源: {m.source}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  <BtnSecondary style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => setEditingMemory(m)}>编辑</BtnSecondary>
                  <BtnDanger style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => setConfirmDelete(m)}>删除</BtnDanger>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 弹窗 */}
      {editingMemory && (
        <Modal title={memories.find((m) => m.id === editingMemory.id) ? '编辑记忆' : '新建记忆'} onClose={() => setEditingMemory(null)}>
          <MemoryForm memory={memories.find((m) => m.id === editingMemory.id) ?? undefined} onSave={(m) => { const e = memories.find((x) => x.id === m.id); if (e) updateMemory(m.id, m); else addMemory(m); setEditingMemory(null) }} />
        </Modal>
      )}
      {confirmDelete && (
        <Modal title="确认删除" onClose={() => setConfirmDelete(null)}>
          <p style={{ fontSize: '14px', color: '#e0e0e0', margin: 0 }}>确定删除这条记忆吗？此操作不可撤销。</p>
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <BtnDanger onClick={() => { removeMemory(confirmDelete.id); setConfirmDelete(null) }}>确认删除</BtnDanger>
            <BtnSecondary onClick={() => setConfirmDelete(null)}>取消</BtnSecondary>
          </div>
        </Modal>
      )}
      {showClearAll && (
        <Modal title="确认清空" onClose={() => setShowClearAll(false)}>
          <p style={{ fontSize: '14px', color: '#e0e0e0', margin: 0 }}>确定清空全部 {memories.length} 条记忆吗？此操作不可撤销。</p>
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <BtnDanger onClick={() => { clearMemories(); setShowClearAll(false) }}>确认清空</BtnDanger>
            <BtnSecondary onClick={() => setShowClearAll(false)}>取消</BtnSecondary>
          </div>
        </Modal>
      )}
    </PageWrapper>
  )
}
