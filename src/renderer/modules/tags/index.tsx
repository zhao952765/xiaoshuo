import { useState, useMemo } from 'react'
import PageWrapper from '../../components/PageWrapper'
import { useStore } from '../../store'
import { TAG_CATEGORY_CONFIG, PRESET_TAG_GROUPS, offlineExpand, autoDetectCategory } from '../../constants/tagPrompts'
import type { TagCategory } from '../../../config/types'

export default function Tags() {
  const tags = useStore((s) => s.tags)
  const addTag = useStore((s) => s.addTag)
  const removeTag = useStore((s) => s.removeTag)
  const toggleTagFavorite = useStore((s) => s.toggleTagFavorite)
  const selectedTagIds = useStore((s) => s.selectedTagIds)
  const toggleTagSelection = useStore((s) => s.toggleTagSelection)
  const clearSelection = useStore((s) => s.clearSelection)
  const addLog = useStore((s) => s.addLog)
  const currentNovel = useStore((s) => s.currentNovel)
  const updateNovel = useStore((s) => s.updateNovel)
  const removeTagsBatch = useStore((s) => s.removeTagsBatch)
  const clearAllTags = useStore((s) => s.clearAllTags)

  const [showModal, setShowModal] = useState(false)
  const [showPresets, setShowPresets] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<TagCategory | 'all'>('all')
  const [keywordInput, setKeywordInput] = useState('')
  const [useOfflineMode, setUseOfflineMode] = useState(false)
  const [expansionResult, setExpansionResult] = useState<Record<TagCategory, string[]> | null>(null)
  const [isExpanding, setIsExpanding] = useState(false)
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null)
  const [hoveredTagId, setHoveredTagId] = useState<string | null>(null)

  const [form, setForm] = useState({ name: '', category: 'character' as TagCategory, color: '#8b5cf6' })

  // ===== 批量操作状态 =====
  const [batchMode, setBatchMode] = useState(false)
  const [batchSelectedIds, setBatchSelectedIds] = useState<string[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false)

  // 退出批量模式时清空选择
  const toggleBatchMode = () => {
    if (batchMode) {
      setBatchSelectedIds([])
      setBatchMode(false)
    } else {
      setBatchMode(true)
    }
  }

  const toggleBatchSelect = (id: string) => {
    setBatchSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const selectAll = () => setBatchSelectedIds(filteredTags.map(t => t.id))
  const deselectAll = () => setBatchSelectedIds([])

  const handleBatchDelete = () => {
    removeTagsBatch(batchSelectedIds)
    addLog({ type: 'info', message: `已批量删除 ${batchSelectedIds.length} 个标签`, detail: null })
    setBatchSelectedIds([])
    setShowDeleteConfirm(false)
  }

  const handleClearAll = () => {
    const count = tags.length
    clearAllTags()
    addLog({ type: 'warn', message: `已清空全部 ${count} 个标签`, detail: null })
    setBatchSelectedIds([])
    setShowClearAllConfirm(false)
    setBatchMode(false)
  }

  const categoryEntries = Object.entries(TAG_CATEGORY_CONFIG) as [TagCategory, typeof TAG_CATEGORY_CONFIG[TagCategory]][]

  // 过滤
  const filteredTags = useMemo(() => {
    return tags.filter((t) => {
      const matchSearch = !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchCategory = filterCategory === 'all' || t.category === filterCategory
      return matchSearch && matchCategory
    })
  }, [tags, searchQuery, filterCategory])

  const selectedTags = tags.filter((t) => selectedTagIds.includes(t.id))
  const favoriteTags = tags.filter((t) => t.isFavorite)

  // 智能识别
  const handleSmartIdentify = () => {
    if (!keywordInput.trim()) return
    setIsExpanding(true)
    const keywords = keywordInput.split(/[,，、\s]+/).filter(Boolean)
    const result = offlineExpand(keywords)
    setExpansionResult(result)
    setIsExpanding(false)
    addLog({ type: 'info', message: '标签智能扩展完成', detail: null })
  }

  // 应用扩展结果
  const applyExpansion = (result: Record<TagCategory, string[]>, autoSelect: boolean = false) => {
    const newIds: string[] = []
    Object.entries(result).forEach(([category, names]) => {
      names.forEach((name) => {
        const exists = tags.find((t) => t.name === name && t.category === category)
        if (!exists) {
          const id = Date.now().toString() + Math.random().toString(36).substr(2, 5)
          addTag({ id, name, category: category as TagCategory, color: TAG_CATEGORY_CONFIG[category as TagCategory].color, isFavorite: false, createdAt: Date.now() })
          if (autoSelect) newIds.push(id)
        } else if (autoSelect) {
          newIds.push(exists.id)
        }
      })
    })
    if (autoSelect) {
      setTimeout(() => newIds.forEach((id) => toggleTagSelection(id)), 100)
    }
    setExpansionResult(null)
  }

  // 添加单个标签
  const addSingleTag = (name: string, category: TagCategory) => {
    const exists = tags.find((t) => t.name === name && t.category === category)
    if (!exists) {
      const id = Date.now().toString() + Math.random().toString(36).substr(2, 5)
      addTag({ id, name, category, color: TAG_CATEGORY_CONFIG[category].color, isFavorite: false, createdAt: Date.now() })
      setTimeout(() => toggleTagSelection(id), 50)
    } else {
      toggleTagSelection(exists.id)
    }
  }

  // 应用预设
  const applyPreset = (group: typeof PRESET_TAG_GROUPS[0]) => {
    group.tags.forEach((tagName) => {
      const category = autoDetectCategory(tagName)
      addSingleTag(tagName, category)
    })
    setShowPresets(false)
  }



  // 复制
  const handleCopy = async (tagNames: string[], label: string) => {
    try {
      await navigator.clipboard.writeText(tagNames.join(', '))
      setCopiedLabel(label)
      setTimeout(() => setCopiedLabel(null), 2000)
    } catch { }
  }

  // ===== 导出 / 导入 =====

  // 导出 JSON（方便文本编辑器编辑）
  const exportTagsJson = () => {
    const data = {
      exportDate: new Date().toISOString(),
      totalTags: tags.length,
      tags: tags.map(t => ({
        name: t.name,
        category: t.category,
        color: t.color,
      }))
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tags_export_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 导出 CSV（按类型分类，方便 Excel 编辑）
  const exportTagsCsv = () => {
    const csvEscape = (val: string) => val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val
    const lines: string[] = ['名称,分类,颜色']

    // 按 categoryEntries 顺序分组输出
    for (const [cat, config] of categoryEntries) {
      const catTags = tags.filter(t => t.category === cat)
      if (catTags.length === 0) continue
      // 分类标题行（注释，Excel 中可见）
      lines.push(`# ${config.icon} ${config.label}（${catTags.length} 个标签）`)
      catTags.forEach(t => {
        lines.push([csvEscape(t.name), t.category, t.color].join(','))
      })
      lines.push('') // 空行分隔
    }

    const csv = lines.join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tags_export_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 导入 JSON / CSV（自动去重）
  const importTags = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        let importedTags: any[] = []

        if (file.name.endsWith('.json')) {
          const data = JSON.parse(text)
          importedTags = data.tags || []
        } else if (file.name.endsWith('.csv')) {
          const lines = text.split('\n')
            .map(l => l.trim())
            .filter(l => l && !l.startsWith('#')) // 跳过空行和注释行（分类标题）
          // 跳过首行(表头)，从第2行开始解析
          importedTags = lines.slice(1).map(line => {
            const cols = line.split(',')
            return {
              name: cols[0]?.trim(),
              category: cols[1]?.trim() as TagCategory,
              color: cols[2]?.trim(),
            }
          })
        }

        // 合并到现有标签（去重）
        const existingNames = new Set(tags.map(t => t.name))
        const newTags = importedTags
          .filter((t: any) => t.name && !existingNames.has(t.name))
          .map((t: any) => ({
            id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
            name: t.name,
            category: t.category && TAG_CATEGORY_CONFIG[t.category as TagCategory]
              ? (t.category as TagCategory)
              : 'character' as TagCategory,
            color: t.color && /^#[0-9a-f]{6}$/i.test(t.color) ? t.color : '#6366f1',
            isFavorite: false,
            createdAt: Date.now(),
          }))

        // 添加到 store
        newTags.forEach((tag: any) => addTag(tag))

        alert(`成功导入 ${newTags.length} 个新标签` + (importedTags.length - newTags.length > 0 ? `，${importedTags.length - newTags.length} 个已存在的标签已跳过` : ''))
      } catch (err) {
        alert('导入失败：文件格式错误，请检查文件内容')
      }
    }
    reader.readAsText(file)
  }

  // 统计
  const stats = [
    { label: '总标签', count: tags.length, color: '#8b5cf6', icon: '🏷️' },
    { label: '已选择', count: selectedTags.length, color: '#3b82f6', icon: '✓' },
    { label: '收藏', count: favoriteTags.length, color: '#f59e0b', icon: '⭐' },
    { label: '分类', count: categoryEntries.length, color: '#10b981', icon: '📂' },
  ]

  const saveCustom = () => {
    if (!form.name.trim()) return
    addTag({ id: Date.now().toString(), name: form.name.trim(), category: form.category, color: form.color, isFavorite: false, createdAt: Date.now() })
    setForm({ name: '', category: 'character', color: '#8b5cf6' })
    setShowModal(false)
  }

  return (
    <PageWrapper
      title="智能标签系统"
      subtitle="成人情色小说专用 · 7大分类 · 智能识别"
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={exportTagsJson} style={{ padding: '8px 16px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', cursor: 'pointer' }}>
            📤 导出JSON
          </button>
          <button onClick={exportTagsCsv} style={{ padding: '8px 16px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', cursor: 'pointer' }}>
            📊 导出CSV
          </button>
          <label style={{ padding: '8px 16px', background: '#6366f1', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px', cursor: 'pointer', display: 'inline-block' }}>
            📥 导入
            <input type="file" accept=".json,.csv" onChange={(e) => e.target.files?.[0] && importTags(e.target.files[0])} style={{ display: 'none' }} />
          </label>
          <button onClick={() => setShowPresets(!showPresets)} style={{ padding: '8px 16px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '8px', color: '#8b5cf6', fontSize: '14px', cursor: 'pointer' }}>
            💡 预设模板
          </button>
          <button onClick={() => setShowModal(true)} style={{ padding: '8px 16px', background: '#6366f1', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>
            + 新建标签
          </button>
        </div>
      }
    >
      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {stats.map((stat) => (
          <div key={stat.label} style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: `${stat.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
              {stat.icon}
            </div>
            <div>
              <div style={{ fontSize: '26px', fontWeight: 'bold', color: stat.color }}>{stat.count}</div>
              <div style={{ fontSize: '14px', color: '#a0a0a0', marginTop: '4px' }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 预设模板面板 */}
      {showPresets && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#888', fontSize: '14px', fontWeight: 500 }}>💡 预设标签组</span>
            <button onClick={() => setShowPresets(false)} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '18px', cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            {PRESET_TAG_GROUPS.map((group, idx) => (
              <button key={idx} onClick={() => applyPreset(group)} style={{ padding: '12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '10px', textAlign: 'left', cursor: 'pointer' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>{group.name}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {group.tags.slice(0, 4).map((t, i) => (
                    <span key={i} style={{ fontSize: '11px', padding: '2px 8px', background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', borderRadius: '4px' }}>{t}</span>
                  ))}
                  {group.tags.length > 4 && <span style={{ fontSize: '11px', color: '#666' }}>+{group.tags.length - 4}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 关键词输入 + 智能识别 */}
      <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSmartIdentify()}
            placeholder="输入关键词，如：御姐、办公室、黑丝..."
            style={{ flex: 1, padding: '12px 16px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '15px', outline: 'none' }}
          />
          <button onClick={() => setUseOfflineMode(!useOfflineMode)} style={{ padding: '10px 16px', background: useOfflineMode ? 'rgba(16,185,129,0.1)' : '#1a1a1a', border: '1px solid ' + (useOfflineMode ? 'rgba(16,185,129,0.2)' : '#333'), borderRadius: '8px', color: useOfflineMode ? '#10b981' : '#a0a0a0', fontSize: '14px', cursor: 'pointer' }}>
            {useOfflineMode ? '⚡ 离线' : '✨ 在线'}
          </button>
          <button onClick={handleSmartIdentify} disabled={isExpanding || !keywordInput.trim()} style={{ padding: '12px 24px', background: '#6366f1', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '15px', cursor: isExpanding || !keywordInput.trim() ? 'not-allowed' : 'pointer', opacity: isExpanding || !keywordInput.trim() ? 0.5 : 1 }}>
            {isExpanding ? '⏳ 识别中...' : '✨ 智能识别'}
          </button>
        </div>

        {/* 搜索 + 分类筛选 */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 搜索标签..."
            style={{ flex: 1, padding: '12px 16px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '15px', outline: 'none' }}
          />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as TagCategory | 'all')}
            style={{ padding: '12px 16px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '15px', outline: 'none', cursor: 'pointer' }}
          >
            <option value="all">全部分类</option>
            {categoryEntries.map(([cat, config]) => (
              <option key={cat} value={cat}>{config.icon} {config.label}</option>
            ))}
          </select>
        </div>

        {/* 分类胶囊 */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilterCategory('all')}
            style={{ padding: '8px 18px', borderRadius: '20px', fontSize: '14px', border: '1px solid ' + (filterCategory === 'all' ? 'rgba(139,92,246,0.4)' : '#333'), background: filterCategory === 'all' ? 'rgba(139,92,246,0.15)' : '#1a1a1a', color: filterCategory === 'all' ? '#a78bfa' : '#a0a0a0', cursor: 'pointer' }}
          >
            全部
          </button>
          {categoryEntries.map(([cat, config]) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              style={{ padding: '8px 18px', borderRadius: '20px', fontSize: '14px', border: '1px solid ' + (filterCategory === cat ? `${config.color}50` : '#333'), background: filterCategory === cat ? `${config.color}20` : '#1a1a1a', color: filterCategory === cat ? config.color : '#a0a0a0', cursor: 'pointer' }}
            >
              {config.icon} {config.label}
            </button>
          ))}
        </div>
      </div>

      {/* ===== 批量操作工具栏 ===== */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
        <button
          onClick={toggleBatchMode}
          style={{
            padding: '8px 18px',
            borderRadius: '8px',
            fontSize: '14px',
            cursor: 'pointer',
            border: `1px solid ${batchMode ? 'rgba(239,68,68,0.3)' : '#333'}`,
            background: batchMode ? 'rgba(239,68,68,0.1)' : '#1a1a1a',
            color: batchMode ? '#ef4444' : '#e0e0e0',
          }}
        >
          {batchMode ? '❌ 退出批量选择' : '☑️ 批量选择'}
        </button>

        {batchMode && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ color: '#888', fontSize: '13px' }}>已选择 {batchSelectedIds.length} 个</span>
            {batchSelectedIds.length === filteredTags.length ? (
              <button onClick={deselectAll} style={{ fontSize: '12px', color: '#818cf8', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                取消全选
              </button>
            ) : (
              <button onClick={selectAll} style={{ fontSize: '12px', color: '#818cf8', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                全选
              </button>
            )}
            <button
              onClick={() => batchSelectedIds.length > 0 && setShowDeleteConfirm(true)}
              disabled={batchSelectedIds.length === 0}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '13px',
                cursor: batchSelectedIds.length === 0 ? 'not-allowed' : 'pointer',
                border: '1px solid rgba(239,68,68,0.3)',
                background: batchSelectedIds.length === 0 ? '#1a1a1a' : 'rgba(239,68,68,0.15)',
                color: batchSelectedIds.length === 0 ? '#555' : '#ef4444',
              }}
            >
              🗑 批量删除
            </button>
            <button
              onClick={() => setShowClearAllConfirm(true)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '13px',
                cursor: 'pointer',
                border: '1px solid rgba(239,68,68,0.3)',
                background: 'rgba(239,68,68,0.15)',
                color: '#ef4444',
              }}
            >
              🗑 清空全部
            </button>
          </div>
        )}
      </div>

      {/* 扩展结果预览 */}
      {expansionResult && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>🤖 AI 扩展结果</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => applyExpansion(expansionResult, true)} style={{ padding: '6px 14px', background: '#6366f1', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>✓ 全部应用并选中</button>
              <button onClick={() => applyExpansion(expansionResult, false)} style={{ padding: '6px 14px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#888', fontSize: '12px', cursor: 'pointer' }}>仅添加</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {(Object.entries(expansionResult) as [TagCategory, string[]][]).map(([cat, tagNames]) => {
              if (tagNames.length === 0) return null
              const config = TAG_CATEGORY_CONFIG[cat]
              return (
                <div key={cat} style={{ padding: '12px', background: '#0f0f0f', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <span>{config.icon}</span>
                    <span style={{ fontSize: '12px', color: config.color, fontWeight: 600 }}>{config.label}</span>
                    <span style={{ fontSize: '11px', color: '#666' }}>({tagNames.length})</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {tagNames.map((name, idx) => (
                      <button key={idx} onClick={() => addSingleTag(name, cat)} style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', border: `1px solid ${config.color}30`, color: config.color, background: `${config.color}08`, cursor: 'pointer' }}>
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 已选标签 */}
      {selectedTags.length > 0 && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#ec4899', fontSize: '14px', fontWeight: 600 }}>✓ 已选择</span>
              <span style={{ fontSize: '11px', color: '#666', padding: '2px 8px', background: 'rgba(236,72,153,0.1)', borderRadius: '10px' }}>{selectedTags.length}/30</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => handleCopy(selectedTags.map((t) => t.name), 'selected')} style={{ fontSize: '12px', color: '#888', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                {copiedLabel === 'selected' ? '✓ 已复制' : '📋 复制'}
              </button>
              <button onClick={clearSelection} style={{ fontSize: '12px', color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}>🗑 清空</button>
              <button
                onClick={() => {
                  if (!currentNovel) return
                  const selectedTags = tags.filter((t) => selectedTagIds.includes(t.id))
                  updateNovel({ tags: selectedTags.map((t) => t.name) })
                }}
                style={{ fontSize: '12px', color: '#6366f1', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 500 }}
              >
                💾 保存选中标签到项目
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {selectedTags.map((tag) => {
              const config = TAG_CATEGORY_CONFIG[tag.category]
              return (
                <span key={tag.id} onClick={() => toggleTagSelection(tag.id)} style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '13px', border: `1px solid ${config.color}50`, color: config.color, background: `${config.color}12`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '10px' }}>{config.icon}</span>
                  {tag.name}
                  <span style={{ fontSize: '11px', opacity: 0.5 }}>×</span>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* 收藏标签 */}
      {favoriteTags.length > 0 && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#f59e0b', fontSize: '14px', fontWeight: 600 }}>⭐ 收藏标签</span>
              <span style={{ fontSize: '11px', color: '#666' }}>({favoriteTags.length})</span>
            </div>
            <button onClick={() => handleCopy(favoriteTags.map((t) => t.name), 'favorite')} style={{ fontSize: '12px', color: '#888', background: 'transparent', border: 'none', cursor: 'pointer' }}>
              {copiedLabel === 'favorite' ? '✓ 已复制' : '📋 复制'}
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {favoriteTags.map((tag) => (
              <span key={tag.id} onClick={() => toggleTagSelection(tag.id)} style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '13px', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', cursor: 'pointer' }}>
                {tag.name}
                <span onClick={(e) => { e.stopPropagation(); toggleTagFavorite(tag.id) }} style={{ marginLeft: '4px', cursor: 'pointer' }}>⭐</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 分类标签区 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {categoryEntries.map(([cat, config]) => {
          const catTags = filteredTags.filter((t) => t.category === cat)
          if (filterCategory !== 'all' && filterCategory !== cat) return null
          if (catTags.length === 0 && filterCategory === 'all') return null

          return (
            <div key={cat} style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px',
                background: config.isHighlight ? 'rgba(236,72,153,0.06)' : 'transparent',
                borderLeft: config.isHighlight ? '3px solid #ec4899' : '3px solid transparent'
              }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: config.isHighlight ? 'rgba(236,72,153,0.15)' : `${config.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
                  {config.icon}
                </div>
                <span style={{ fontSize: '16px', fontWeight: 700, color: config.isHighlight ? '#ec4899' : config.color }}>
                  {config.isHighlight && <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#ec4899', marginRight: '8px' }} />}
                  {config.label}
                </span>
                <span style={{ fontSize: '13px', color: '#888' }}>{config.description}</span>
                <span style={{ fontSize: '12px', color: '#666', marginLeft: 'auto', padding: '4px 10px', background: 'rgba(15,15,25,0.6)', borderRadius: '10px' }}>{catTags.length}</span>
              </div>
              <div style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {catTags.length === 0 ? (
                  <span style={{ color: '#555', fontSize: '13px' }}>该分类下暂无标签</span>
                ) : (
                  catTags.map((tag) => {
                    const isSelected = selectedTagIds.includes(tag.id)
                    const isFetish = cat === 'fetish'
                    return (
                      <span
                        key={tag.id}
                        onMouseEnter={() => setHoveredTagId(tag.id)}
                        onMouseLeave={() => setHoveredTagId(null)}
                        onClick={() => batchMode ? toggleBatchSelect(tag.id) : toggleTagSelection(tag.id)}
                        style={{
                          padding: '8px 14px', borderRadius: '10px', fontSize: '14px', cursor: 'pointer',
                          border: `1px solid ${isSelected || batchSelectedIds.includes(tag.id) ? (isFetish ? 'rgba(236,72,153,0.5)' : `${config.color}50`) : (isFetish ? 'rgba(236,72,153,0.2)' : 'rgba(255,255,255,0.08)')}`,
                          color: isSelected || batchSelectedIds.includes(tag.id) ? (isFetish ? '#f472b6' : config.color) : '#a0a0a0',
                          background: isSelected || batchSelectedIds.includes(tag.id) ? (isFetish ? 'rgba(236,72,153,0.12)' : `${config.color}10`) : '#0f0f0f',
                          boxShadow: isSelected || batchSelectedIds.includes(tag.id) ? '0 0 12px rgba(236,72,153,0.3)' : 'none',
                          display: 'flex', alignItems: 'center', gap: '6px',
                          transition: 'all 0.2s',
                          position: 'relative',
                        }}
                      >
                        {/* 批量模式：复选框 */}
                        {batchMode && (
                          <span style={{
                            width: '16px', height: '16px', borderRadius: '4px',
                            border: `2px solid ${batchSelectedIds.includes(tag.id) ? config.color : '#555'}`,
                            background: batchSelectedIds.includes(tag.id) ? config.color : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '10px', color: '#fff', flexShrink: 0,
                          }}>
                            {batchSelectedIds.includes(tag.id) && '✓'}
                          </span>
                        )}
                        {!batchMode && isSelected && '✓'}
                        {tag.name}
                        <span onClick={(e) => { e.stopPropagation(); toggleTagFavorite(tag.id) }} style={{ cursor: 'pointer', fontSize: '13px' }}>
                          {tag.isFavorite ? '⭐' : '☆'}
                        </span>
                        {/* 非批量模式：悬停显示删除按钮 */}
                        {!batchMode && hoveredTagId === tag.id && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation()
                              removeTag(tag.id)
                              addLog({ type: 'info', message: `已删除标签：${tag.name}`, detail: null })
                            }}
                            style={{
                              cursor: 'pointer', fontSize: '12px', color: '#ef4444',
                              background: 'rgba(239,68,68,0.15)', borderRadius: '4px',
                              padding: '0 5px', lineHeight: '18px',
                            }}
                          >
                            ×
                          </span>
                        )}
                      </span>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ===== 批量删除确认对话框 ===== */}
      {showDeleteConfirm && (
        <>
          <div onClick={() => setShowDeleteConfirm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '380px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '14px', padding: '24px', zIndex: 101 }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🗑️</div>
              <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: '#fff' }}>确认删除</h3>
              <p style={{ color: '#888', fontSize: '14px', lineHeight: 1.5 }}>
                确定要删除选中的 <span style={{ color: '#ef4444', fontWeight: 600 }}>{batchSelectedIds.length}</span> 个标签吗？
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{ flex: 1, padding: '12px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', cursor: 'pointer' }}
              >
                取消
              </button>
              <button
                onClick={handleBatchDelete}
                style={{ flex: 1, padding: '12px', background: '#ef4444', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px', cursor: 'pointer', fontWeight: 500 }}
              >
                确认删除
              </button>
            </div>
          </div>
        </>
      )}

      {/* ===== 清空全部确认对话框 ===== */}
      {showClearAllConfirm && (
        <>
          <div onClick={() => setShowClearAllConfirm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '380px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '14px', padding: '24px', zIndex: 101 }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
              <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: '#fff' }}>清空全部标签</h3>
              <p style={{ color: '#f87171', fontSize: '14px', lineHeight: 1.5 }}>
                确定要删除全部 <span style={{ color: '#ef4444', fontWeight: 600 }}>{tags.length}</span> 个标签？<br />
                <span style={{ color: '#facc15' }}>此操作不可撤销！</span>
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowClearAllConfirm(false)}
                style={{ flex: 1, padding: '12px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', cursor: 'pointer' }}
              >
                取消
              </button>
              <button
                onClick={handleClearAll}
                style={{ flex: 1, padding: '12px', background: '#dc2626', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px', cursor: 'pointer', fontWeight: 500 }}
              >
                确认清空
              </button>
            </div>
          </div>
        </>
      )}

      {/* 新建标签弹窗 */}
      {showModal && (
        <>
          <div onClick={() => setShowModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '400px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '14px', padding: '24px', zIndex: 101 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#fff' }}>新建标签</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '6px', fontWeight: 500 }}>名称</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="标签名称" style={{ width: '100%', padding: '10px 14px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '6px', fontWeight: 500 }}>分类</label>
                <select value={form.category} onChange={(e) => { const cat = e.target.value as TagCategory; setForm({ ...form, category: cat, color: TAG_CATEGORY_CONFIG[cat].color }) }} style={{ width: '100%', padding: '10px 14px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box', cursor: 'pointer' }}>
                  {categoryEntries.map(([cat, config]) => (
                    <option key={cat} value={cat}>{config.icon} {config.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '6px', fontWeight: 500 }}>颜色</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} style={{ width: '40px', height: '40px', border: 'none', borderRadius: '8px', cursor: 'pointer' }} />
                  <span style={{ color: '#888', fontSize: '13px' }}>{form.color}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #2a2a2a' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '10px 20px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', cursor: 'pointer' }}>取消</button>
              <button onClick={saveCustom} style={{ padding: '10px 20px', background: '#6366f1', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px', cursor: 'pointer', fontWeight: 500 }}>保存</button>
            </div>
          </div>
        </>
      )}
    </PageWrapper>
  )
}