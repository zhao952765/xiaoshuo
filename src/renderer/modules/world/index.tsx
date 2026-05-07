/**
 * 世界观管理 - 修复版
 * - URL.revokeObjectURL 防止内存泄漏
 * - 使用共享 UI 组件
 */
import { useState, useCallback, useMemo, useRef } from 'react'
import { useAppStore } from '../../store'
import PageWrapper from '../../components/PageWrapper'
import { Card, Btn, Input, Textarea, Badge, Empty, Modal, Divider } from '../../components/ui'
import type { WorldSetting, WorldType } from '@cfg/types'

const genId = (): string => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

const worldTypeLabel: Record<WorldType, string> = {
  campus: '校园', urban: '都市', apocalypse: '末世', fantasy: '奇幻',
  scifi: '科幻', xuanhuan: '玄幻', historical: '历史', wuxia: '武侠', custom: '自定义',
}
const worldTypeColor: Record<WorldType, string> = {
  campus: '#3b82f6', urban: '#64748b', apocalypse: '#ef4444', fantasy: '#8b5cf6',
  scifi: '#06b6d4', xuanhuan: '#a855f7', historical: '#f59e0b', wuxia: '#10b981', custom: '#6b7280',
}

export default function WorldPage() {
  const worldSettings = useAppStore((s) => s.worldSettings)
  const currentNovel = useAppStore((s) => s.currentNovel)
  const addWorldSetting = useAppStore((s) => s.addWorldSetting)
  const updateWorldSetting = useAppStore((s) => s.updateWorldSetting)
  const removeWorldSetting = useAppStore((s) => s.removeWorldSetting)
  const addLog = useAppStore((s) => s.addLog)

  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<WorldType | 'all'>('all')
  const [editing, setEditing] = useState<WorldSetting | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [form, setForm] = useState<Partial<WorldSetting>>({})

  const filtered = useMemo(() => {
    let list = worldSettings
    if (search) list = list.filter((w) => w.name.includes(search) || w.overview.includes(search))
    if (filterType !== 'all') list = list.filter((w) => w.worldType === filterType)
    return list
  }, [worldSettings, search, filterType])

  const openNew = useCallback(() => {
    setIsNew(true)
    setEditing(null)
    setForm({
      id: genId(), name: '', worldType: 'custom', description: '', overview: '', rules: [], locations: [], timeline: [],
      society: '', culture: '', economy: '', createdAt: Date.now(), updatedAt: Date.now(),
    })
  }, [])

  const openEdit = useCallback((ws: WorldSetting) => {
    setIsNew(false)
    setEditing(ws)
    setForm({ ...ws })
  }, [])

  const handleSave = useCallback(() => {
    if (!form.name?.trim()) return
    if (isNew) {
      addWorldSetting(form as WorldSetting)
      addLog({ type: 'success', message: '新增世界观', detail: form.name })
    } else if (editing) {
      updateWorldSetting(editing.id, form)
      addLog({ type: 'success', message: '更新世界观', detail: form.name })
    }
    setEditing(null)
  }, [form, isNew, editing, addWorldSetting, updateWorldSetting, addLog])

  const handleDelete = useCallback((id: string, name: string) => {
    if (!confirm(`确定删除世界观「${name}」吗？`)) return
    removeWorldSetting(id)
    addLog({ type: 'warn', message: '删除世界观', detail: name })
  }, [removeWorldSetting, addLog])

  const handleExport = useCallback(() => {
    const data = JSON.stringify(worldSettings, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `world_settings_${Date.now()}.json`; a.click()
    URL.revokeObjectURL(url) // 修复：防止内存泄漏
    addLog({ type: 'success', message: '导出世界观数据', detail: `${worldSettings.length} 条` })
  }, [worldSettings, addLog])

  const a = '#FF4D94'

  return (
    <PageWrapper
      title="🌍 世界观管理"
      subtitle={`共 ${worldSettings.length} 个世界观设定`}
      actions={<Btn variant="primary" size="sm" onClick={openNew}>➕ 新增</Btn>}
    >
      {/* 搜索 & 筛选 */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input placeholder="搜索世界观…" value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#f0f0f0', fontSize: '13px', outline: 'none' }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['all', ...Object.keys(worldTypeLabel)] as const).map((t) => (
            <button key={t} onClick={() => setFilterType(t as any)}
              style={{ padding: '4px 12px', borderRadius: '9999px', fontSize: '11px', cursor: 'pointer', border: filterType === t ? `1px solid ${a}` : '1px solid #333', background: filterType === t ? `${a}18` : '#1a1a1a', color: filterType === t ? a : '#888', transition: 'all 0.15s' }}>
              {t === 'all' ? '全部' : worldTypeLabel[t as WorldType]}
            </button>
          ))}
        </div>
      </div>

      {/* 列表 */}
      {filtered.length === 0 ? (
        <Empty icon="🌍" message={worldSettings.length === 0 ? '暂无世界观设定' : '没有匹配的结果'} submessage="点击右上角新增" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {filtered.map((ws) => (
            <div key={ws.id} style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px', cursor: 'pointer', transition: 'border-color 0.2s' }}
              onClick={() => openEdit(ws)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f0' }}>{ws.name}</div>
                  <Badge color={worldTypeColor[ws.worldType]} bgColor={`${worldTypeColor[ws.worldType]}20`}>{worldTypeLabel[ws.worldType]}</Badge>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(ws.id, ws.name) }}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px', padding: 2 }}>×</button>
              </div>
              <div style={{ fontSize: '12px', color: '#888', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {ws.overview || ws.description || '暂无简介'}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {ws.rules.length > 0 && <Badge color="#f59e0b">📏 {ws.rules.length} 规则</Badge>}
                {ws.locations.length > 0 && <Badge color="#3b82f6">📍 {ws.locations.length} 地点</Badge>}
                {ws.timeline.length > 0 && <Badge color="#10b981">📅 {ws.timeline.length} 事件</Badge>}
              </div>
            </div>
          ))}
        </div>
      )}

      {worldSettings.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Btn variant="secondary" size="sm" onClick={handleExport}>📤 全部导出 JSON</Btn>
        </div>
      )}

      {/* 编辑模态框 */}
      <Modal open={!!editing || isNew} onClose={() => { setEditing(null); setIsNew(false) }}
        title={isNew ? '新增世界观' : '编辑世界观'} width="600px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: 4 }}>名称</label>
            <input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="世界观名称" style={{ width: '100%', padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#f0f0f0', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: 4 }}>类型</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(Object.entries(worldTypeLabel) as [WorldType, string][]).map(([key, label]) => (
                <button key={key} onClick={() => setForm({ ...form, worldType: key })}
                  style={{ padding: '4px 12px', borderRadius: '9999px', fontSize: '11px', cursor: 'pointer', border: (form.worldType || 'custom') === key ? `1px solid ${worldTypeColor[key]}` : '1px solid #333', background: (form.worldType || 'custom') === key ? `${worldTypeColor[key]}18` : '#1a1a1a', color: (form.worldType || 'custom') === key ? worldTypeColor[key] : '#888' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: 4 }}>简介</label>
            <textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3}
              placeholder="简要描述这个世界的核心设定" style={{ width: '100%', padding: '10px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#f0f0f0', fontSize: '13px', outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: 4 }}>详细世界观概述</label>
            <textarea value={form.overview || ''} onChange={(e) => setForm({ ...form, overview: e.target.value })} rows={6}
              placeholder="世界的背景、历史、社会环境、文化风俗…" style={{ width: '100%', padding: '10px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#f0f0f0', fontSize: '13px', outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Btn variant="primary" size="md" fullWidth onClick={handleSave}>💾 保存</Btn>
            <Btn variant="ghost" size="sm" onClick={() => { setEditing(null); setIsNew(false) }}>取消</Btn>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  )
}
