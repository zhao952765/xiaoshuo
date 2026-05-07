/**
 * 智能标签系统（Smart Tags）增强版
 * SRS v2.3 要求：7大分类 + 自动生成 + 筛选搜索 + 批量应用 + 导入导出
 * 
 * 分类：情节 / 情绪 / 肉戏 / 关系 / 世界观 / 风格 / 自定义
 */

import React, { useState, useMemo, useCallback } from 'react'
import { useStore } from '../../store'
import type { Tag, TagCategory } from '../../types/types'

const CATEGORY_CONFIG: Record<TagCategory | 'plot' | 'emotion' | 'erotic' | 'relation' | 'world' | 'style' | 'custom', {
  label: string
  color: string
  icon: string
  description: string
}> = {
  character: { label: '人物', color: '#10b981', icon: '👤', description: '角色类型与特质' },
  profession: { label: '职业', color: '#3b82f6', icon: '💼', description: '职业与社会身份' },
  scene: { label: '场景', color: '#f59e0b', icon: '📍', description: '地点与环境' },
  plot: { label: '情节', color: '#8b5cf6', icon: '📖', description: '故事类型与桥段' },
  emotion: { label: '情绪', color: '#ec4899', icon: '💭', description: '情感氛围与基调' },
  erotic: { label: '肉戏', color: '#ef4444', icon: '🔞', description: '成人内容与尺度' },
  relation: { label: '关系', color: '#06b6d4', icon: '🔗', description: '人物关系动态' },
  world: { label: '世界观', color: '#6366f1', icon: '🌍', description: '世界规则与设定' },
  style: { label: '风格', color: '#14b8a6', icon: '✒️', description: '文笔与叙事风格' },
  custom: { label: '自定义', color: '#6b7280', icon: '🏷️', description: '用户自定义标签' },
  fetish: { label: '癖好', color: '#a855f7', icon: '💜', description: '特殊偏好标签' },
  costume: { label: '服饰', color: '#f97316', icon: '👗', description: '服装与装扮' },
  fantasy: { label: '幻想', color: '#d946ef', icon: '✨', description: '超自然与幻想元素' },
}

// 预设标签库（用于自动生成）
const PRESET_TAGS: Record<string, string[]> = {
  plot: ['复仇', '穿越', '重生', '系统', '修仙', '末世', '悬疑', '恋爱', '职场', '权谋', '谍战', '冒险', '养成', '逆袭', '甜宠', '虐恋', '破镜重圆', '先婚后爱', '青梅竹马', '一见钟情', '强取豪夺', '追妻火葬场'],
  emotion: ['治愈', '压抑', '热血', '温馨', '虐心', '搞笑', '惊悚', '浪漫', '悲壮', '轻松', '沉重', '悬疑', '紧张', '舒缓'],
  erotic: ['暧昧', '挑逗', '激情', '温柔', '粗暴', '禁忌', '纯爱', '欲望', '占有', '臣服', '调教', '野外', '浴室', '办公室', '车内'],
  relation: ['君臣', '师徒', '兄妹', '宿敌', '挚友', '主仆', '契约', '联姻', '暗恋', '明恋', '三角恋', '多角关系', '年龄差', '身份差'],
  world: ['仙侠', '武侠', '玄幻', '科幻', '蒸汽朋克', '赛博朋克', '末日废土', '架空历史', '现代都市', '异世界', '克苏鲁', '规则怪谈'],
  style: ['爽文', '虐文', '甜文', '暗黑', '文艺', '写实', '意识流', '单元剧', '群像', '第一人称', '多视角', 'POV'],
  character: ['高冷', '温柔', '腹黑', '傲娇', '病娇', '忠犬', '疯批', '白切黑', '绿茶', '御姐', '萝莉', '正太', '大叔', '少年'],
}

interface TagPreset {
  name: string
  tags: Array<{ name: string; category: TagCategory | string }>
}

const PRESET_GROUPS: TagPreset[] = [
  {
    name: '高H御姐',
    tags: [
      { name: '御姐', category: 'character' },
      { name: '强气', category: 'emotion' },
      { name: '调教', category: 'erotic' },
      { name: '占有', category: 'erotic' },
      { name: '年龄差', category: 'relation' },
      { name: '职场', category: 'plot' },
    ],
  },
  {
    name: '人妻NTR',
    tags: [
      { name: '人妻', category: 'character' },
      { name: '禁忌', category: 'erotic' },
      { name: '背叛', category: 'plot' },
      { name: '虐心', category: 'emotion' },
      { name: '欲望', category: 'erotic' },
    ],
  },
  {
    name: '办公室黑丝',
    tags: [
      { name: '职场', category: 'plot' },
      { name: '秘书', category: 'profession' },
      { name: '暧昧', category: 'erotic' },
      { name: '制服', category: 'costume' },
      { name: '权力游戏', category: 'plot' },
    ],
  },
  {
    name: '仙侠师徒',
    tags: [
      { name: '仙侠', category: 'scene' },
      { name: '师徒', category: 'relation' },
      { name: '养成', category: 'plot' },
      { name: '禁忌', category: 'erotic' },
      { name: '高冷', category: 'character' },
    ],
  },
  {
    name: '末世生存',
    tags: [
      { name: '末世', category: 'scene' },
      { name: '生存', category: 'plot' },
      { name: '紧张', category: 'emotion' },
      { name: '强强', category: 'relation' },
      { name: '冒险', category: 'plot' },
    ],
  },
]

export default function TagsPage() {
  const tags = useStore((s) => s.tags)
  const addTag = useStore((s) => s.addTag)
  const removeTag = useStore((s) => s.removeTag)
  const removeTagsBatch = useStore((s) => s.removeTagsBatch)
  const updateTag = useStore((s) => s.updateTag)
  const toggleTagSelection = useStore((s) => s.toggleTagSelection)
  const selectedTagIds = useStore((s) => s.selectedTagIds)
  const clearSelection = useStore((s) => s.clearSelection)
  const currentNovel = useStore((s) => s.currentNovel)
  const characters = useStore((s) => s.characters)
  const chapters = useStore((s) => s.chapters)
  const addLog = useStore((s) => s.addLog)

  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [isAutoGenerating, setIsAutoGenerating] = useState(false)
  const [showPresetModal, setShowPresetModal] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagCategory, setNewTagCategory] = useState<TagCategory>('custom')

  // 过滤标签
  const filteredTags = useMemo(() => {
    return tags.filter((tag) => {
      const matchSearch = !searchQuery || tag.name.includes(searchQuery)
      const matchCategory = activeCategory === 'all' || tag.category === activeCategory
      return matchSearch && matchCategory
    })
  }, [tags, searchQuery, activeCategory])

  // 按分类分组
  const groupedTags = useMemo(() => {
    const groups: Record<string, Tag[]> = {}
    filteredTags.forEach((tag) => {
      if (!groups[tag.category]) groups[tag.category] = []
      groups[tag.category].push(tag)
    })
    return groups
  }, [filteredTags])

  // 自动生成标签
  const handleAutoGenerate = useCallback(() => {
    setIsAutoGenerating(true)
    const novel = currentNovel
    if (!novel) {
      addLog({ type: 'warn', message: '请先创建项目', detail: '' })
      setIsAutoGenerating(false)
      return
    }

    const newTags: Tag[] = []
    const now = Date.now()

    // 从标题和简介提取
    const textToAnalyze = `${novel.title} ${novel.summary}`

    // 情节标签匹配
    PRESET_TAGS.plot.forEach((name, idx) => {
      if (textToAnalyze.includes(name) && !tags.some((t) => t.name === name)) {
        newTags.push({
          id: `auto_${now}_${idx}`,
          name,
          category: 'plot' as TagCategory,
          color: CATEGORY_CONFIG.plot.color,
          isFavorite: false,
          createdAt: now,
        })
      }
    })

    // 情绪标签匹配
    PRESET_TAGS.emotion.forEach((name, idx) => {
      if (textToAnalyze.includes(name) && !tags.some((t) => t.name === name)) {
        newTags.push({
          id: `auto_${now + 100}_${idx}`,
          name,
          category: 'emotion' as TagCategory,
          color: CATEGORY_CONFIG.emotion.color,
          isFavorite: false,
          createdAt: now,
        })
      }
    })

    // 从角色提取性格标签
    characters.forEach((char, cidx) => {
      char.personality.forEach((p, pidx) => {
        if (!tags.some((t) => t.name === p)) {
          newTags.push({
            id: `auto_char_${cidx}_${pidx}_${now}`,
            name: p,
            category: 'character',
            color: CATEGORY_CONFIG.character.color,
            isFavorite: false,
            createdAt: now,
          })
        }
      })
    })

    // 从章节提取场景标签
    chapters.forEach((ch, idx) => {
      PRESET_TAGS.world.forEach((name) => {
        if (ch.title.includes(name) && !tags.some((t) => t.name === name)) {
          newTags.push({
            id: `auto_ch_${idx}_${now}`,
            name,
            category: 'scene',
            color: CATEGORY_CONFIG.world.color,
            isFavorite: false,
            createdAt: now,
          })
        }
      })
    })

    // 成人模式额外标签
    if (novel.adultMode) {
      PRESET_TAGS.erotic.slice(0, 3).forEach((name, idx) => {
        if (!tags.some((t) => t.name === name)) {
          newTags.push({
            id: `auto_ns_${idx}_${now}`,
            name,
            category: 'fetish',
            color: CATEGORY_CONFIG.erotic.color,
            isFavorite: false,
            createdAt: now,
          })
        }
      })
    }

    newTags.forEach((tag) => addTag(tag))
    addLog({
      type: 'success',
      message: `自动生成 ${newTags.length} 个标签`,
      detail: `情节${newTags.filter((t) => t.category === 'plot').length} | 情绪${newTags.filter((t) => t.category === 'emotion').length} | 角色${newTags.filter((t) => t.category === 'character').length}`,
    })
    setIsAutoGenerating(false)
  }, [currentNovel, characters, chapters, tags, addTag, addLog])

  // 应用预设组
  const handleApplyPreset = (preset: TagPreset) => {
    const now = Date.now()
    let added = 0
    preset.tags.forEach((t, idx) => {
      if (!tags.some((existing) => existing.name === t.name)) {
        const cat = t.category as TagCategory
        const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.custom
        addTag({
          id: `preset_${now}_${idx}`,
          name: t.name,
          category: cat,
          color: config.color,
          isFavorite: false,
          createdAt: now,
        })
        added++
      }
    })
    addLog({ type: 'success', message: `应用预设「${preset.name}」`, detail: `新增 ${added} 个标签` })
    setShowPresetModal(false)
  }

  // 添加自定义标签
  const handleAddCustom = () => {
    if (!newTagName.trim()) return
    if (tags.some((t) => t.name === newTagName.trim())) {
      addLog({ type: 'warn', message: '标签已存在', detail: newTagName })
      return
    }
    const config = CATEGORY_CONFIG[newTagCategory] || CATEGORY_CONFIG.custom
    addTag({
      id: `custom_${Date.now()}`,
      name: newTagName.trim(),
      category: newTagCategory,
      color: config.color,
      isFavorite: false,
      createdAt: Date.now(),
    })
    setNewTagName('')
    addLog({ type: 'success', message: '添加标签', detail: newTagName })
  }

  // 批量删除
  const handleBatchDelete = () => {
    if (selectedTagIds.length === 0) return
    removeTagsBatch(selectedTagIds)
    addLog({ type: 'success', message: '批量删除标签', detail: `${selectedTagIds.length} 个` })
  }

  // 导出 JSON
  const handleExport = () => {
    const data = JSON.stringify(tags, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tags_${Date.now()}.json`
    a.click()
    addLog({ type: 'success', message: '导出标签', detail: `${tags.length} 个` })
  }

  // 导入 JSON
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target?.result as string) as Tag[]
        let added = 0
        imported.forEach((tag) => {
          if (!tags.some((t) => t.name === tag.name)) {
            addTag({ ...tag, id: `import_${Date.now()}_${added}` })
            added++
          }
        })
        addLog({ type: 'success', message: '导入标签', detail: `新增 ${added} 个` })
      } catch {
        addLog({ type: 'error', message: '导入失败', detail: '文件格式错误' })
      }
    }
    reader.readAsText(file)
  }

  return (
    <div style={{ padding: '24px', color: '#e0e0e0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>🏷️ 智能标签系统</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowPresetModal(true)} style={btnSecondaryStyle}>
            📦 预设模板
          </button>
          <button onClick={handleAutoGenerate} disabled={isAutoGenerating} style={btnSecondaryStyle}>
            {isAutoGenerating ? '⏳' : '🤖'} 自动生成
          </button>
          <button onClick={handleExport} style={btnSecondaryStyle}>
            📤 导出
          </button>
          <label style={{ ...btnSecondaryStyle, cursor: 'pointer' }}>
            📥 导入
            <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* 搜索与分类筛选 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索标签..."
          style={{ ...inputStyle, width: 240 }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveCategory('all')}
            style={{
              ...categoryBtnStyle,
              background: activeCategory === 'all' ? 'rgba(139,92,246,0.2)' : '#0f0f0f',
              color: activeCategory === 'all' ? '#a78bfa' : '#9ca3af',
            }}
          >
            全部
          </button>
          {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              style={{
                ...categoryBtnStyle,
                background: activeCategory === key ? `${config.color}20` : '#0f0f0f',
                color: activeCategory === key ? config.color : '#9ca3af',
                borderColor: activeCategory === key ? `${config.color}60` : '#2a2a2a',
              }}
            >
              {config.icon} {config.label}
            </button>
          ))}
        </div>
      </div>

      {/* 批量操作栏 */}
      {selectedTagIds.length > 0 && (
        <div style={{
          padding: '10px 16px', background: 'rgba(139,92,246,0.1)', borderRadius: 8,
          marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ color: '#a78bfa', fontSize: 13 }}>已选 {selectedTagIds.length} 个标签</span>
          <button onClick={handleBatchDelete} style={{ ...btnDangerStyle, fontSize: 12, padding: '4px 12px' }}>
            🗑️ 删除
          </button>
          <button onClick={clearSelection} style={{ ...btnSecondaryStyle, fontSize: 12, padding: '4px 12px' }}>
            取消选择
          </button>
        </div>
      )}

      {/* 标签展示 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {Object.entries(groupedTags).map(([category, categoryTags]) => {
          const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.custom
          return (
            <div key={category}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: config.color, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                {config.icon} {config.label}
                <span style={{ color: '#6b7280', fontSize: 12, fontWeight: 400 }}>({categoryTags.length})</span>
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {categoryTags.map((tag) => (
                  <span
                    key={tag.id}
                    onClick={() => toggleTagSelection(tag.id)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 16,
                      fontSize: 13,
                      background: selectedTagIds.includes(tag.id) ? `${config.color}40` : `${config.color}15`,
                      color: selectedTagIds.includes(tag.id) ? '#fff' : config.color,
                      border: `1px solid ${selectedTagIds.includes(tag.id) ? config.color : `${config.color}30`}`,
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'all 0.2s',
                    }}
                  >
                    {tag.isFavorite && '⭐ '}
                    {tag.name}
                    <span
                      onClick={(e) => { e.stopPropagation(); removeTag(tag.id); }}
                      style={{ marginLeft: 6, opacity: 0.5, cursor: 'pointer' }}
                    >
                      ×
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )
        })}

        {filteredTags.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}>
            暂无标签，点击「自动生成」或「预设模板」添加
          </div>
        )}
      </div>

      {/* 添加自定义标签 */}
      <div style={{ marginTop: 24, padding: 16, background: '#0a0a0a', borderRadius: 8, border: '1px solid #1a1a1a' }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 10 }}>➕ 添加自定义标签</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="标签名称"
            style={{ ...inputStyle, width: 200 }}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
          />
          <select
            value={newTagCategory}
            onChange={(e) => setNewTagCategory(e.target.value as TagCategory)}
            style={{ ...inputStyle, width: 140 }}
          >
            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.icon} {config.label}</option>
            ))}
          </select>
          <button onClick={handleAddCustom} style={btnPrimaryStyle}>添加</button>
        </div>
      </div>

      {/* 预设模板弹窗 */}
      {showPresetModal && (
        <div style={modalOverlayStyle} onClick={() => setShowPresetModal(false)}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#e0e0e0', marginBottom: 16 }}>📦 预设标签模板</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {PRESET_GROUPS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => handleApplyPreset(preset)}
                  style={{
                    padding: 12,
                    background: '#0f0f0f',
                    border: '1px solid #2a2a2a',
                    borderRadius: 8,
                    color: '#e0e0e0',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>{preset.name}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {preset.tags.map((t) => (
                      <span key={t.name} style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 11,
                        background: (CATEGORY_CONFIG[t.category as keyof typeof CATEGORY_CONFIG]?.color || '#6b7280') + '20',
                        color: CATEGORY_CONFIG[t.category as keyof typeof CATEGORY_CONFIG]?.color || '#9ca3af',
                      }}>
                        {t.name}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  background: '#0f0f0f',
  border: '1px solid #2a2a2a',
  borderRadius: '6px',
  color: '#e0e0e0',
  fontSize: '13px',
  outline: 'none',
}

const btnPrimaryStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: '#8b5cf6',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
}

const btnSecondaryStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: '#1f1f1f',
  color: '#9ca3af',
  border: '1px solid #2a2a2a',
  borderRadius: '6px',
  fontSize: '12px',
  cursor: 'pointer',
}

const btnDangerStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: '#ef4444',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  fontSize: '12px',
  cursor: 'pointer',
}

const categoryBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 4,
  border: '1px solid #2a2a2a',
  fontSize: 12,
  cursor: 'pointer',
  background: '#0f0f0f',
}

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
}

const modalContentStyle: React.CSSProperties = {
  background: '#0a0a0a',
  border: '1px solid #2a2a2a',
  borderRadius: 12,
  padding: 24,
  maxWidth: 500,
  width: '90%',
  maxHeight: '80vh',
  overflow: 'auto',
}
