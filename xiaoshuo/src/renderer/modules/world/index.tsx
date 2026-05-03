import { useState, useCallback, useMemo } from 'react'
import { useAppStore } from '../../store'
import PageWrapper from '../../components/PageWrapper'
import type { WorldSetting, WorldType } from '../../../config/types'

// ==========================================
// 工具
// ==========================================

const genId = (): string =>
  `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

const worldTypeLabel: Record<WorldType, string> = {
  campus: '校园',
  urban: '都市',
  apocalypse: '末世',
  fantasy: '奇幻',
  scifi: '科幻',
  xuanhuan: '玄幻',
  historical: '历史',
  wuxia: '武侠',
  custom: '自定义',
}

const worldTypeColor: Record<WorldType, string> = {
  campus: '#3b82f6',
  urban: '#64748b',
  apocalypse: '#ef4444',
  fantasy: '#8b5cf6',
  scifi: '#06b6d4',
  xuanhuan: '#f59e0b',
  historical: '#a16207',
  wuxia: '#10b981',
  custom: '#888',
}

function createEmptyWorld(): WorldSetting {
  return {
    id: genId(),
    name: '',
    worldType: 'custom',
    description: '',
    overview: '',
    rules: [],
    locations: [],
    timeline: [],
    society: '',
    culture: '',
    economy: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

// ==========================================
// 主组件
// ==========================================

export default function WorldManagePage() {
  const worldSettings = useAppStore((s) => s.worldSettings)
  const currentNovel = useAppStore((s) => s.currentNovel)
  const addWorldSetting = useAppStore((s) => s.addWorldSetting)
  const updateWorldSetting = useAppStore((s) => s.updateWorldSetting)
  const removeWorldSetting = useAppStore((s) => s.removeWorldSetting)
  const addLog = useAppStore((s) => s.addLog)

  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<WorldType | 'all'>('all')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState('')

  // 表单状态
  const [form, setForm] = useState<WorldSetting>(createEmptyWorld())

  // 动态子项编辑状态
  const [ruleForm, setRuleForm] = useState({ name: '', description: '' })
  const [locForm, setLocForm] = useState({
    name: '',
    type: '',
    description: '',
  })
  const [timeForm, setTimeForm] = useState({
    era: '',
    title: '',
    description: '',
  })

  const filtered = useMemo(() => {
    let list = [...worldSettings]
    if (search.trim()) {
      const s = search.trim().toLowerCase()
      list = list.filter(
        (w) =>
          w.name.toLowerCase().includes(s) ||
          w.description.toLowerCase().includes(s) ||
          w.overview.toLowerCase().includes(s)
      )
    }
    if (filterType !== 'all') {
      list = list.filter((w) => w.worldType === filterType)
    }
    return list
  }, [worldSettings, search, filterType])

  const stats = useMemo(() => {
    return {
      total: worldSettings.length,
      hasRules: worldSettings.filter((w) => w.rules.length > 0).length,
      hasLocations: worldSettings.filter((w) => w.locations.length > 0).length,
      hasTimeline: worldSettings.filter((w) => w.timeline.length > 0).length,
    }
  }, [worldSettings])

  const openCreate = useCallback(() => {
    setForm(createEmptyWorld())
    setEditingId(null)
    setShowForm(true)
    setRuleForm({ name: '', description: '' })
    setLocForm({ name: '', type: '', description: '' })
    setTimeForm({ era: '', title: '', description: '' })
  }, [])

  const openEdit = useCallback((ws: WorldSetting) => {
    setForm({ ...ws })
    setEditingId(ws.id)
    setShowForm(true)
    setRuleForm({ name: '', description: '' })
    setLocForm({ name: '', type: '', description: '' })
    setTimeForm({ era: '', title: '', description: '' })
  }, [])

  const closeForm = useCallback(() => {
    setShowForm(false)
    setEditingId(null)
  }, [])

  const handleSave = useCallback(() => {
    if (!form.name.trim()) {
      addLog({ type: 'warn', message: '世界观名称不能为空', detail: '' })
      return
    }
    const toSave: WorldSetting = {
      ...form,
      updatedAt: Date.now(),
    }
    if (editingId) {
      updateWorldSetting(editingId, toSave)
      addLog({ type: 'success', message: '世界观已更新', detail: toSave.name })
    } else {
      addWorldSetting(toSave)
      if (currentNovel) {
        const novelWs = [...currentNovel.worldSettings, toSave.id]
        useAppStore.getState().updateNovel({ worldSettings: novelWs })
      }
      addLog({ type: 'success', message: '世界观已创建', detail: toSave.name })
    }
    setShowForm(false)
    setEditingId(null)
  }, [form, editingId, addWorldSetting, updateWorldSetting, currentNovel, addLog])

  const confirmDelete = useCallback((id: string) => {
    setDeleteTargetId(id)
    setShowDeleteConfirm(true)
  }, [])

  const executeDelete = useCallback(() => {
    const id = deleteTargetId
    const target = worldSettings.find((w) => w.id === id)
    if (!target) return
    removeWorldSetting(id)
    addLog({
      type: 'success',
      message: '世界观已删除',
      detail: target.name,
    })
    setShowDeleteConfirm(false)
    setDeleteTargetId('')
  }, [deleteTargetId, worldSettings, removeWorldSetting, addLog])

  // ----- 动态子项增删 -----

  const addRule = useCallback(() => {
    if (!ruleForm.name.trim()) return
    setForm((prev) => ({
      ...prev,
      rules: [
        ...prev.rules,
        {
          name: ruleForm.name.trim(),
          description: ruleForm.description.trim(),
          scope: '',
          limit: '',
          sideEffect: '',
        },
      ],
    }))
    setRuleForm({ name: '', description: '' })
  }, [ruleForm])

  const removeRule = useCallback((idx: number) => {
    setForm((prev) => ({ ...prev, rules: prev.rules.filter((_, i) => i !== idx) }))
  }, [])

  const addLocation = useCallback(() => {
    if (!locForm.name.trim()) return
    setForm((prev) => ({
      ...prev,
      locations: [
        ...prev.locations,
        {
          name: locForm.name.trim(),
          type: locForm.type.trim(),
          description: locForm.description.trim(),
          atmosphere: '',
          scenes: [],
        },
      ],
    }))
    setLocForm({ name: '', type: '', description: '' })
  }, [locForm])

  const removeLocation = useCallback((idx: number) => {
    setForm((prev) => ({
      ...prev,
      locations: prev.locations.filter((_, i) => i !== idx),
    }))
  }, [])

  const addTimeline = useCallback(() => {
    if (!timeForm.title.trim()) return
    setForm((prev) => ({
      ...prev,
      timeline: [
        ...prev.timeline,
        {
          era: timeForm.era.trim(),
          title: timeForm.title.trim(),
          description: timeForm.description.trim(),
          impact: '',
        },
      ],
    }))
    setTimeForm({ era: '', title: '', description: '' })
  }, [timeForm])

  const removeTimeline = useCallback((idx: number) => {
    setForm((prev) => ({
      ...prev,
      timeline: prev.timeline.filter((_, i) => i !== idx),
    }))
  }, [])

  return (
    <PageWrapper
      title="世界观管理"
      subtitle="管理小说世界观设定，规则、地点与时间线实时同步全局"
      actions={
        <button onClick={openCreate} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer' }}>
          + 新建世界观
        </button>
      }
    >
      {/* 统计 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {[
          { label: '总世界观', value: stats.total, color: '#e0e0e0' },
          { label: '有规则', value: stats.hasRules, color: '#6366f1' },
          { label: '有地理', value: stats.hasLocations, color: '#10b981' },
          { label: '有历史', value: stats.hasTimeline, color: '#f59e0b' },
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
          placeholder="搜索世界观名称、描述..."
          style={{ flex: 1, padding: '10px 14px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none' }}
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as WorldType | 'all')}
          style={{ padding: '10px 14px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none' }}
        >
          <option value="all">全部类型</option>
          {(Object.keys(worldTypeLabel) as WorldType[]).map((t) => <option key={t} value={t}>{worldTypeLabel[t]}</option>)}
        </select>
      </div>

      {/* 列表 */}
      {filtered.length === 0 ? (
        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '14px', color: '#666' }}>
            {worldSettings.length === 0 ? '暂无世界观，点击上方按钮创建' : '没有匹配的世界观'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map((ws) => (
            <div
              key={ws.id}
              onClick={() => openEdit(ws)}
              style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontSize: '16px', fontWeight: 500, color: '#e0e0e0' }}>{ws.name}</div>
                  <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '8px', border: `1px solid ${worldTypeColor[ws.worldType]}40`, color: worldTypeColor[ws.worldType], background: `${worldTypeColor[ws.worldType]}15` }}>
                    {worldTypeLabel[ws.worldType]}
                  </span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); confirmDelete(ws.id) }}
                  style={{ color: '#f87171', border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px' }}
                >
                  删除
                </button>
              </div>
              <p style={{ fontSize: '14px', color: '#888', margin: '0 0 12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {ws.description || ws.overview || '暂无描述'}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '12px', color: '#666' }}>
                {ws.rules.length > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1' }} />{ws.rules.length} 条规则</span>}
                {ws.locations.length > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />{ws.locations.length} 个地点</span>}
                {ws.timeline.length > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} />{ws.timeline.length} 个历史事件</span>}
                {ws.society && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#888' }} />社会</span>}
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
              <div style={{ fontSize: '16px', fontWeight: 500, color: '#e0e0e0' }}>{editingId ? '编辑世界观' : '新建世界观'}</div>
              <button onClick={closeForm} style={{ color: '#666', border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>名称 *</div>
                  <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} style={{ width: '100%', padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>类型</div>
                  <select value={form.worldType} onChange={(e) => setForm((p) => ({ ...p, worldType: e.target.value as WorldType }))} style={{ width: '100%', padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}>
                    {(Object.keys(worldTypeLabel) as WorldType[]).map((t) => <option key={t} value={t}>{worldTypeLabel[t]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>简介</div>
                <input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} style={{ width: '100%', padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>概述</div>
                <textarea value={form.overview} onChange={(e) => setForm((p) => ({ ...p, overview: e.target.value }))} rows={3} style={{ width: '100%', padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <div style={{ border: '1px solid #2a2a2a', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: 500, color: '#ccc' }}>规则设定</div>
                {form.rules.length === 0 && <div style={{ fontSize: '12px', color: '#666' }}>暂无规则</div>}
                {form.rules.map((r, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: '#0f0f0f', borderRadius: '8px', padding: '8px 12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: '14px', color: '#e0e0e0' }}>{r.name}</div><div style={{ fontSize: '12px', color: '#888' }}>{r.description}</div></div>
                    <button onClick={() => removeRule(idx)} style={{ fontSize: '12px', color: '#f87171', border: 'none', background: 'none', cursor: 'pointer' }}>移除</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '8px', paddingTop: '8px', borderTop: '1px solid #2a2a2a' }}>
                  <input value={ruleForm.name} onChange={(e) => setRuleForm((p) => ({ ...p, name: e.target.value }))} placeholder="规则名称" style={{ flex: 1, padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none' }} />
                  <input value={ruleForm.description} onChange={(e) => setRuleForm((p) => ({ ...p, description: e.target.value }))} placeholder="描述" style={{ flex: 2, padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none' }} />
                  <button onClick={addRule} disabled={!ruleForm.name.trim()} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer', opacity: ruleForm.name.trim() ? 1 : 0.4 }}>添加</button>
                </div>
              </div>
              <div style={{ border: '1px solid #2a2a2a', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: 500, color: '#ccc' }}>地点设定</div>
                {form.locations.length === 0 && <div style={{ fontSize: '12px', color: '#666' }}>暂无地点</div>}
                {form.locations.map((l, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: '#0f0f0f', borderRadius: '8px', padding: '8px 12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', color: '#e0e0e0' }}>{l.name}{l.type && <span style={{ fontSize: '12px', color: '#6366f1', marginLeft: '8px' }}>{l.type}</span>}</div>
                      <div style={{ fontSize: '12px', color: '#888' }}>{l.description}</div>
                    </div>
                    <button onClick={() => removeLocation(idx)} style={{ fontSize: '12px', color: '#f87171', border: 'none', background: 'none', cursor: 'pointer' }}>移除</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '8px', paddingTop: '8px', borderTop: '1px solid #2a2a2a' }}>
                  <input value={locForm.name} onChange={(e) => setLocForm((p) => ({ ...p, name: e.target.value }))} placeholder="地点名称" style={{ flex: 1, padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none' }} />
                  <input value={locForm.type} onChange={(e) => setLocForm((p) => ({ ...p, type: e.target.value }))} placeholder="类型" style={{ width: '96px', padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none' }} />
                  <input value={locForm.description} onChange={(e) => setLocForm((p) => ({ ...p, description: e.target.value }))} placeholder="描述" style={{ flex: 2, padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none' }} />
                  <button onClick={addLocation} disabled={!locForm.name.trim()} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer', opacity: locForm.name.trim() ? 1 : 0.4 }}>添加</button>
                </div>
              </div>
              <div style={{ border: '1px solid #2a2a2a', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: 500, color: '#ccc' }}>历史时间线</div>
                {form.timeline.length === 0 && <div style={{ fontSize: '12px', color: '#666' }}>暂无历史事件</div>}
                {form.timeline.map((t, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: '#0f0f0f', borderRadius: '8px', padding: '8px 12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', color: '#e0e0e0' }}>{t.era && <span style={{ fontSize: '12px', color: '#f59e0b', marginRight: '8px' }}>{t.era}</span>}{t.title}</div>
                      <div style={{ fontSize: '12px', color: '#888' }}>{t.description}</div>
                    </div>
                    <button onClick={() => removeTimeline(idx)} style={{ fontSize: '12px', color: '#f87171', border: 'none', background: 'none', cursor: 'pointer' }}>移除</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '8px', paddingTop: '8px', borderTop: '1px solid #2a2a2a' }}>
                  <input value={timeForm.era} onChange={(e) => setTimeForm((p) => ({ ...p, era: e.target.value }))} placeholder="时代" style={{ width: '96px', padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none' }} />
                  <input value={timeForm.title} onChange={(e) => setTimeForm((p) => ({ ...p, title: e.target.value }))} placeholder="事件名称" style={{ flex: 1, padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none' }} />
                  <input value={timeForm.description} onChange={(e) => setTimeForm((p) => ({ ...p, description: e.target.value }))} placeholder="描述" style={{ flex: 2, padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none' }} />
                  <button onClick={addTimeline} disabled={!timeForm.title.trim()} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer', opacity: timeForm.title.trim() ? 1 : 0.4 }}>添加</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>社会结构</div>
                  <textarea value={form.society} onChange={(e) => setForm((p) => ({ ...p, society: e.target.value }))} rows={3} style={{ width: '100%', padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>文化风俗</div>
                  <textarea value={form.culture} onChange={(e) => setForm((p) => ({ ...p, culture: e.target.value }))} rows={3} style={{ width: '100%', padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>经济体系</div>
                  <textarea value={form.economy} onChange={(e) => setForm((p) => ({ ...p, economy: e.target.value }))} rows={3} style={{ width: '100%', padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '8px' }}>
                <button onClick={closeForm} style={{ background: '#1a1a1a', color: '#e0e0e0', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer' }}>取消</button>
                <button onClick={handleSave} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer' }}>{editingId ? '保存修改' : '创建世界观'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#00000099', padding: '16px' }}>
          <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', width: '100%', maxWidth: '384px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '16px', fontWeight: 500, color: '#e0e0e0' }}>确认删除世界观</div>
            <div style={{ fontSize: '14px', color: '#888' }}>删除后该世界观将从项目中移除，所有引用它的章节将不再关联此设定，此操作不可撤销。</div>
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
