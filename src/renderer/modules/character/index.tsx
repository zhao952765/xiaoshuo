import { useState, useCallback, useMemo } from 'react'
import { useAppStore } from '../../store'
import PageWrapper from '../../components/PageWrapper'
import type { Character, RoleType } from '../../../config/types'

// ==========================================
// 工具
// ==========================================

const genId = (): string =>
  `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

const roleLabelMap: Record<RoleType, string> = {
  protagonist: '主角',
  supporting: '配角',
  minor: '龙套',
  antagonist: '反派',
}

const roleColorMap: Record<RoleType, string> = {
  protagonist: '#6366f1',
  supporting: '#10b981',
  minor: '#888',
  antagonist: '#ef4444',
}

function createEmptyCharacter(): Character {
  return {
    id: genId(),
    name: '',
    roleType: 'supporting',
    avatar: '',
    basicInfo: { age: '', gender: '', occupation: '' },
    appearance: '',
    personality: [],
    background: '',
    abilities: '',
    relationships: [],
    voice: '',
    innerWorld: '',
    arc: '',
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

// ==========================================
// 主组件
// ==========================================

export default function CharacterManagePage() {
  const characters = useAppStore((s) => s.characters)
  const currentNovel = useAppStore((s) => s.currentNovel)
  const addCharacter = useAppStore((s) => s.addCharacter)
  const updateCharacter = useAppStore((s) => s.updateCharacter)
  const removeCharacter = useAppStore((s) => s.removeCharacter)
  const addLog = useAppStore((s) => s.addLog)

  // 其他角色的 relationships 清理需要在组件层做
  const allChapters = useAppStore((s) => s.chapters)
  const updateChapter = useAppStore((s) => s.updateChapter)

  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<RoleType | 'all'>('all')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState('')

  // 表单状态
  const [form, setForm] = useState<Character>(createEmptyCharacter())
  const [personalityInput, setPersonalityInput] = useState('')
  const [relTargetId, setRelTargetId] = useState('')
  const [relType, setRelType] = useState('')
  const [relDesc, setRelDesc] = useState('')

  const filtered = useMemo(() => {
    let list = [...characters]
    if (search.trim()) {
      const s = search.trim().toLowerCase()
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(s) ||
          c.basicInfo.occupation.toLowerCase().includes(s) ||
          c.appearance.toLowerCase().includes(s)
      )
    }
    if (filterType !== 'all') {
      list = list.filter((c) => c.roleType === filterType)
    }
    return list
  }, [characters, search, filterType])

  const stats = useMemo(() => {
    const total = characters.length
    const protagonist = characters.filter((c) => c.roleType === 'protagonist').length
    const supporting = characters.filter((c) => c.roleType === 'supporting').length
    const antagonist = characters.filter((c) => c.roleType === 'antagonist').length
    return { total, protagonist, supporting, antagonist }
  }, [characters])

  const openCreate = useCallback(() => {
    setForm(createEmptyCharacter())
    setPersonalityInput('')
    setEditingId(null)
    setShowForm(true)
    setRelTargetId('')
    setRelType('')
    setRelDesc('')
  }, [])

  const openEdit = useCallback((char: Character) => {
    setForm({ ...char })
    setPersonalityInput(char.personality.join('、'))
    setEditingId(char.id)
    setShowForm(true)
    setRelTargetId('')
    setRelType('')
    setRelDesc('')
  }, [])

  const closeForm = useCallback(() => {
    setShowForm(false)
    setEditingId(null)
  }, [])

  const handleSave = useCallback(() => {
    if (!form.name.trim()) {
      addLog({ type: 'warn', message: '角色姓名不能为空', detail: '' })
      return
    }
    const toSave: Character = {
      ...form,
      personality: personalityInput
        .split(/[,，、]/)
        .map((s) => s.trim())
        .filter(Boolean),
      updatedAt: Date.now(),
    }
    if (editingId) {
      updateCharacter(editingId, toSave)
      addLog({ type: 'success', message: '角色已更新', detail: toSave.name })
    } else {
      addCharacter(toSave)
      // 如果有 currentNovel，自动关联
      if (currentNovel) {
        const novelChars = [...currentNovel.characters, toSave.id]
        // 使用 store 的 updateNovel（通过 getState）
        useAppStore.getState().updateNovel({ characters: novelChars })
      }
      addLog({ type: 'success', message: '角色已创建', detail: toSave.name })
    }
    setShowForm(false)
    setEditingId(null)
  }, [form, personalityInput, editingId, addCharacter, updateCharacter, currentNovel, addLog])

  const confirmDelete = useCallback((id: string) => {
    setDeleteTargetId(id)
    setShowDeleteConfirm(true)
  }, [])

  const executeDelete = useCallback(() => {
    const id = deleteTargetId
    const target = characters.find((c) => c.id === id)
    if (!target) return

    // 1. 删除角色本身（Store 会自动清理 currentNovel.characters）
    removeCharacter(id)

    // 2. 清理其他角色的 relationships 中引用该角色的条目
    characters.forEach((c) => {
      if (c.id === id) return
      const hasRef = c.relationships.some((r) => r.targetId === id)
      if (hasRef) {
        updateCharacter(c.id, {
          relationships: c.relationships.filter((r) => r.targetId !== id),
        })
      }
    })

    // 3. 清理所有章节 characters 数组中的该角色ID
    allChapters.forEach((ch) => {
      if (ch.characters.includes(id)) {
        updateChapter(ch.id, {
          characters: ch.characters.filter((cid) => cid !== id),
        })
      }
    })

    addLog({
      type: 'success',
      message: '角色已删除',
      detail: target.name,
    })
    setShowDeleteConfirm(false)
    setDeleteTargetId('')
  }, [deleteTargetId, characters, removeCharacter, updateCharacter, allChapters, updateChapter, addLog])

  const handleAddRelationship = useCallback(() => {
    if (!relTargetId || !relType.trim()) return
    const target = characters.find((c) => c.id === relTargetId)
    if (!target) return
    const newRel = {
      targetId: target.id,
      targetName: target.name,
      type: relType.trim(),
      description: relDesc.trim(),
    }
    setForm((prev) => ({
      ...prev,
      relationships: [...prev.relationships, newRel],
    }))
    setRelTargetId('')
    setRelType('')
    setRelDesc('')
  }, [relTargetId, relType, relDesc, characters])

  const handleRemoveRelationship = useCallback((idx: number) => {
    setForm((prev) => ({
      ...prev,
      relationships: prev.relationships.filter((_, i) => i !== idx),
    }))
  }, [])

  return (
    <PageWrapper
      title="角色管理"
      subtitle="管理小说中的所有角色，编辑信息、建立关系、同步全局数据"
      actions={
        <button onClick={openCreate} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer' }}>
          + 新建角色
        </button>
      }
    >
      {/* 统计 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {[
          { label: '总角色', value: stats.total, color: '#e0e0e0' },
          { label: '主角', value: stats.protagonist, color: '#6366f1' },
          { label: '配角', value: stats.supporting, color: '#10b981' },
          { label: '反派', value: stats.antagonist, color: '#ef4444' },
        ].map((s) => (
          <div key={s.label} style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* 工具栏 */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <input
          type="text" value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索角色姓名、职业、外貌..."
          style={{ flex: 1, padding: '10px 14px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none' }}
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as RoleType | 'all')}
          style={{ padding: '10px 14px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none' }}
        >
          <option value="all">全部类型</option>
          <option value="protagonist">主角</option>
          <option value="supporting">配角</option>
          <option value="minor">龙套</option>
          <option value="antagonist">反派</option>
        </select>
      </div>

      {/* 角色列表 */}
      {filtered.length === 0 ? (
        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '14px', color: '#666' }}>
            {characters.length === 0 ? '暂无角色，点击上方按钮创建' : '没有匹配的角色'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {filtered.map((c) => (
            <div
              key={c.id}
              onClick={() => openEdit(c)}
              style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#6366f11a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                    {c.avatar || (c.basicInfo.gender === '女' ? '👩' : '👨')}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: '#e0e0e0' }}>{c.name}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>{c.basicInfo.age} · {c.basicInfo.gender} · {c.basicInfo.occupation}</div>
                  </div>
                </div>
                <span style={{
                  fontSize: '12px', padding: '2px 8px', borderRadius: '8px', border: `1px solid ${roleColorMap[c.roleType]}40`,
                  color: roleColorMap[c.roleType], background: `${roleColorMap[c.roleType]}15`, flexShrink: 0
                }}>
                  {roleLabelMap[c.roleType]}
                </span>
              </div>

              <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {c.appearance || '暂无外貌描述'}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                {c.personality.slice(0, 4).map((p) => (
                  <span key={p} style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '8px', background: '#333', color: '#aaa' }}>{p}</span>
                ))}
                {c.personality.length > 4 && (
                  <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '8px', background: '#333', color: '#666' }}>+{c.personality.length - 4}</span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#666' }}>
                <span>{c.relationships.length > 0 ? `${c.relationships.length} 条关系` : '无关系'}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); confirmDelete(c.id) }}
                  style={{ color: '#f87171', border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px' }}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 编辑/创建弹窗 */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#00000099', padding: '16px' }}>
          <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', width: '100%', maxWidth: '672px', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ position: 'sticky', top: 0, background: '#1a1a1a', borderBottom: '1px solid #2a2a2a', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
              <div style={{ fontSize: '16px', fontWeight: 500, color: '#e0e0e0' }}>{editingId ? '编辑角色' : '新建角色'}</div>
              <button onClick={closeForm} style={{ color: '#666', border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>姓名 *</div>
                  <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} style={{ width: '100%', padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>类型</div>
                  <select value={form.roleType} onChange={(e) => setForm((p) => ({ ...p, roleType: e.target.value as RoleType }))} style={{ width: '100%', padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}>
                    <option value="protagonist">主角</option>
                    <option value="supporting">配角</option>
                    <option value="minor">龙套</option>
                    <option value="antagonist">反派</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>年龄</div>
                  <input value={form.basicInfo.age} onChange={(e) => setForm((p) => ({ ...p, basicInfo: { ...p.basicInfo, age: e.target.value } }))} style={{ width: '100%', padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>性别</div>
                  <select value={form.basicInfo.gender} onChange={(e) => setForm((p) => ({ ...p, basicInfo: { ...p.basicInfo, gender: e.target.value } }))} style={{ width: '100%', padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}>
                    <option value="">请选择</option>
                    <option value="男">男</option>
                    <option value="女">女</option>
                    <option value="其他">其他</option>
                  </select>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>职业/身份</div>
                  <input value={form.basicInfo.occupation} onChange={(e) => setForm((p) => ({ ...p, basicInfo: { ...p.basicInfo, occupation: e.target.value } }))} style={{ width: '100%', padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>外貌</div>
                <textarea value={form.appearance} onChange={(e) => setForm((p) => ({ ...p, appearance: e.target.value }))} rows={3} style={{ width: '100%', padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>

              <div>
                <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>性格标签（用、分隔）</div>
                <input value={personalityInput} onChange={(e) => setPersonalityInput(e.target.value)} placeholder="例如：冷静、理智、温柔、腹黑" style={{ width: '100%', padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>背景经历</div>
                  <textarea value={form.background} onChange={(e) => setForm((p) => ({ ...p, background: e.target.value }))} rows={3} style={{ width: '100%', padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>能力/技能</div>
                  <textarea value={form.abilities} onChange={(e) => setForm((p) => ({ ...p, abilities: e.target.value }))} rows={3} style={{ width: '100%', padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div style={{ border: '1px solid #2a2a2a', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: 500, color: '#ccc' }}>角色关系</div>
                {form.relationships.length === 0 && <div style={{ fontSize: '12px', color: '#666' }}>暂无关系</div>}
                {form.relationships.map((rel, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0f0f0f', borderRadius: '8px', padding: '8px 12px' }}>
                    <span style={{ fontSize: '14px', color: '#e0e0e0' }}>{rel.targetName}</span>
                    <span style={{ fontSize: '12px', padding: '2px 6px', borderRadius: '8px', background: '#6366f115', color: '#6366f1' }}>{rel.type}</span>
                    <span style={{ fontSize: '12px', color: '#888', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rel.description}</span>
                    <button onClick={() => handleRemoveRelationship(idx)} style={{ fontSize: '12px', color: '#f87171', border: 'none', background: 'none', cursor: 'pointer' }}>移除</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '8px', paddingTop: '8px', borderTop: '1px solid #2a2a2a' }}>
                  <select value={relTargetId} onChange={(e) => setRelTargetId(e.target.value)} style={{ flex: 1, padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none' }}>
                    <option value="">选择目标角色</option>
                    {characters.filter((c) => c.id !== form.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input value={relType} onChange={(e) => setRelType(e.target.value)} placeholder="关系类型" style={{ flex: 1, padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none' }} />
                  <input value={relDesc} onChange={(e) => setRelDesc(e.target.value)} placeholder="描述" style={{ flex: 2, padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none' }} />
                  <button onClick={handleAddRelationship} disabled={!relTargetId || !relType.trim()} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer', opacity: (!relTargetId || !relType.trim()) ? 0.4 : 1 }}>添加</button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '8px' }}>
                <button onClick={closeForm} style={{ background: '#1a1a1a', color: '#e0e0e0', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer' }}>取消</button>
                <button onClick={handleSave} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer' }}>{editingId ? '保存修改' : '创建角色'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#00000099', padding: '16px' }}>
          <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', width: '100%', maxWidth: '384px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '16px', fontWeight: 500, color: '#e0e0e0' }}>确认删除角色</div>
            <div style={{ fontSize: '14px', color: '#888' }}>删除后该角色将从所有章节和关联关系中移除，此操作不可撤销。</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ background: '#1a1a1a', color: '#e0e0e0', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer' }}>取消</button>
              <button onClick={executeDelete} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer' }}>确认删除</button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  )
}
