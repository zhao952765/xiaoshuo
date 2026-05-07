/**
 * 模板库（Template Library）
 * SRS v2.3 新增核心模块
 */

import React, { useState, useMemo } from 'react'
import { useStore } from '../../store'

type TemplateCategory = 'prompt' | 'tag' | 'deduce'

interface TemplateItem {
  id: string
  name: string
  category: TemplateCategory
  content: string
  description: string
  tags: string[]
  isBuiltin: boolean
  createdAt: number
}

const BUILTIN_TEMPLATES: TemplateItem[] = [
  {
    id: 'builtin_prompt_1',
    name: '续写引导',
    category: 'prompt',
    content: '基于小说《{title}》的当前章节上下文，保持角色性格一致性，延续已有情节节奏进行续写。注意呼应感情线节点和肉欲线强度提示。',
    description: '标准续写 Prompt，自动注入项目上下文',
    tags: ['写作', '续写'],
    isBuiltin: true,
    createdAt: 0,
  },
  {
    id: 'builtin_prompt_2',
    name: '润色-文学化',
    category: 'prompt',
    content: '对以下文本进行文学化润色，提升画面感和情感张力，去除口语化表达。增加修辞手法（比喻、拟人、通感），让文字更有质感。',
    description: '提升文笔质感',
    tags: ['润色', '文学'],
    isBuiltin: true,
    createdAt: 0,
  },
  {
    id: 'builtin_prompt_3',
    name: '润色-情欲强化',
    category: 'prompt',
    content: '强化文本中的情欲氛围描写，增加感官细节（触觉、嗅觉、温度、心跳）和心理活动。保持优雅含蓄，重点描写眼神接触、肢体距离、呼吸变化等微妙细节。',
    description: 'NSFW 专用润色',
    tags: ['润色', 'NSFW', '情欲'],
    isBuiltin: true,
    createdAt: 0,
  },
  {
    id: 'builtin_prompt_4',
    name: '润色-病娇风',
    category: 'prompt',
    content: '将文本转换为病娇风格：增加偏执、占有欲、极端情感的描写。语言带有甜蜜与危险并存的反差感，展现从温柔到疯狂的渐变心理。',
    description: '病娇角色专用',
    tags: ['润色', '病娇', '角色'],
    isBuiltin: true,
    createdAt: 0,
  },
  {
    id: 'builtin_prompt_5',
    name: '角色扩展',
    category: 'prompt',
    content: '为角色「{characterName}」生成更详细的背景故事、语言风格样本和人际关系网络。包括成长经历、关键转折点、口头禅、说话习惯等。',
    description: '深化角色设定',
    tags: ['角色', '扩展'],
    isBuiltin: true,
    createdAt: 0,
  },
  {
    id: 'builtin_prompt_6',
    name: '世界观扩展',
    category: 'prompt',
    content: '扩展《{title}》的世界观设定，补充社会结构细节、历史文化、经济体系和地理分布。增加3-5个具体场景描写。',
    description: '丰富世界观',
    tags: ['世界观', '扩展'],
    isBuiltin: true,
    createdAt: 0,
  },
  {
    id: 'builtin_prompt_7',
    name: '感情线节点生成',
    category: 'prompt',
    content: '基于当前章节「{chapterTitle}」，生成一个感情线节点事件。要求：包含角色互动、情感变化、关键对话，标注类型（感情/冲突/高潮/肉欲）。',
    description: '辅助感情线设计',
    tags: ['感情线', '节点'],
    isBuiltin: true,
    createdAt: 0,
  },
  {
    id: 'builtin_prompt_8',
    name: '肉欲线场景生成',
    category: 'prompt',
    content: '为章节「{chapterTitle}」生成肉欲线场景描写。强度等级：{intensity}/100。要求：感官细节丰富，心理活动细腻，保持优雅不粗俗。',
    description: 'NSFW 场景生成',
    tags: ['肉欲线', 'NSFW', '场景'],
    isBuiltin: true,
    createdAt: 0,
  },
  {
    id: 'builtin_tag_1',
    name: '高H御姐套装',
    category: 'tag',
    content: '[{"name":"御姐","category":"character"},{"name":"强气","category":"emotion"},{"name":"调教","category":"fetish"},{"name":"占有","category":"plot"},{"name":"年龄差","category":"character"},{"name":"职场","category":"scene"},{"name":"黑丝","category":"costume"},{"name":"高跟鞋","category":"costume"}]',
    description: '成熟女性主导的成人向标签组合',
    tags: ['成人', '御姐'],
    isBuiltin: true,
    createdAt: 0,
  },
  {
    id: 'builtin_tag_2',
    name: '人妻NTR套装',
    category: 'tag',
    content: '[{"name":"人妻","category":"character"},{"name":"禁忌","category":"plot"},{"name":"背叛","category":"plot"},{"name":"虐心","category":"emotion"},{"name":"欲望","category":"fetish"},{"name":"家庭","category":"scene"}]',
    description: '禁忌关系向标签组合',
    tags: ['成人', 'NTR'],
    isBuiltin: true,
    createdAt: 0,
  },
  {
    id: 'builtin_tag_3',
    name: '仙侠师徒套装',
    category: 'tag',
    content: '[{"name":"仙侠","category":"scene"},{"name":"师徒","category":"relation"},{"name":"养成","category":"plot"},{"name":"禁忌","category":"plot"},{"name":"高冷","category":"character"},{"name":"修仙","category":"scene"},{"name":"丹药","category":"fantasy"},{"name":"剑修","category":"profession"}]',
    description: '仙侠师徒恋经典标签',
    tags: ['仙侠', '师徒'],
    isBuiltin: true,
    createdAt: 0,
  },
  {
    id: 'builtin_tag_4',
    name: '末世生存套装',
    category: 'tag',
    content: '[{"name":"末世","category":"scene"},{"name":"生存","category":"plot"},{"name":"紧张","category":"emotion"},{"name":"强强","category":"relation"},{"name":"冒险","category":"plot"},{"name":"丧尸","category":"fantasy"},{"name":"物资","category":"scene"}]',
    description: '末世求生向标签组合',
    tags: ['末世', '生存'],
    isBuiltin: true,
    createdAt: 0,
  },
  {
    id: 'builtin_deduce_1',
    name: '标准中篇架构',
    category: 'deduce',
    content: '{"targetWords":"30000","chapterCount":15,"scaleLevel":2,"maleCount":1,"femaleCount":2,"customPrompt":"要求有清晰的三幕结构，感情线循序渐进，配角有独立支线。"}',
    description: '3万字中篇小说标准架构',
    tags: ['中篇', '标准'],
    isBuiltin: true,
    createdAt: 0,
  },
  {
    id: 'builtin_deduce_2',
    name: '高H短篇架构',
    category: 'deduce',
    content: '{"targetWords":"3000","chapterCount":3,"scaleLevel":4,"maleCount":1,"femaleCount":1,"customPrompt":"节奏紧凑，肉欲线强度从30快速攀升到90，情感与欲望交织推进。"}',
    description: '短篇高H快速推进',
    tags: ['短篇', '高H'],
    isBuiltin: true,
    createdAt: 0,
  },
  {
    id: 'builtin_deduce_3',
    name: '长篇群像架构',
    category: 'deduce',
    content: '{"targetWords":"100000","chapterCount":50,"scaleLevel":2,"maleCount":3,"femaleCount":4,"customPrompt":"多主角群像，每条感情线独立发展最终交汇，世界观宏大详细。"}',
    description: '10万字群像长篇',
    tags: ['长篇', '群像'],
    isBuiltin: true,
    createdAt: 0,
  },
]

export default function TemplatesPage() {
  const addTag = useStore((s) => s.addTag)
  const tags = useStore((s) => s.tags)
  const addLog = useStore((s) => s.addLog)

  const [activeCategory, setActiveCategory] = useState<TemplateCategory | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [newTemplate, setNewTemplate] = useState<Partial<TemplateItem>>({
    name: '', category: 'prompt', content: '', description: '', tags: [],
  })

  const [userTemplates, setUserTemplates] = useState<TemplateItem[]>(() => {
    try {
      const saved = localStorage.getItem('pns_templates')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })

  const allTemplates = useMemo(() => [...BUILTIN_TEMPLATES, ...userTemplates], [userTemplates])

  const filteredTemplates = useMemo(() => {
    return allTemplates.filter((t) => {
      const matchCategory = activeCategory === 'all' || t.category === activeCategory
      const matchSearch = !searchQuery ||
        t.name.includes(searchQuery) ||
        t.description.includes(searchQuery) ||
        t.tags.some((tag) => tag.includes(searchQuery))
      return matchCategory && matchSearch
    })
  }, [allTemplates, activeCategory, searchQuery])

  const saveUserTemplates = (templates: TemplateItem[]) => {
    setUserTemplates(templates)
    localStorage.setItem('pns_templates', JSON.stringify(templates))
  }

  const handleApply = (template: TemplateItem) => {
    if (template.category === 'tag') {
      try {
        const tagData = JSON.parse(template.content) as Array<{ name: string; category: string }>
        let added = 0
        tagData.forEach((t) => {
          if (!tags.some((existing) => existing.name === t.name)) {
            const colorMap: Record<string, string> = {
              character: '#10b981', profession: '#3b82f6', scene: '#f59e0b',
              plot: '#8b5cf6', emotion: '#ec4899', fetish: '#ef4444',
              relation: '#06b6d4', world: '#6366f1', style: '#14b8a6',
              costume: '#f97316', fantasy: '#d946ef', custom: '#6b7280',
            }
            addTag({
              id: `template_${Date.now()}_${added}`,
              name: t.name,
              category: t.category as any,
              color: colorMap[t.category] || '#6b7280',
              isFavorite: false,
              createdAt: Date.now(),
            })
            added++
          }
        })
        addLog({ type: 'success', message: `应用标签模板「${template.name}」`, detail: `新增 ${added} 个标签` })
      } catch {
        addLog({ type: 'error', message: '模板解析失败', detail: template.name })
      }
    } else if (template.category === 'prompt') {
      navigator.clipboard.writeText(template.content)
      addLog({ type: 'success', message: `Prompt 已复制`, detail: template.name })
    } else if (template.category === 'deduce') {
      localStorage.setItem('pns_deduce_template', template.content)
      addLog({ type: 'success', message: `推导模板已加载`, detail: template.name })
    }
  }

  const handleCreate = () => {
    if (!newTemplate.name || !newTemplate.content) return
    const template: TemplateItem = {
      id: `user_${Date.now()}`,
      name: newTemplate.name,
      category: (newTemplate.category as TemplateCategory) || 'prompt',
      content: newTemplate.content,
      description: newTemplate.description || '',
      tags: newTemplate.tags || [],
      isBuiltin: false,
      createdAt: Date.now(),
    }
    saveUserTemplates([...userTemplates, template])
    setIsCreating(false)
    setNewTemplate({ name: '', category: 'prompt', content: '', description: '', tags: [] })
    addLog({ type: 'success', message: '创建模板', detail: template.name })
  }

  const handleDelete = (id: string) => {
    saveUserTemplates(userTemplates.filter((t) => t.id !== id))
    addLog({ type: 'success', message: '删除模板', detail: '' })
  }

  const categoryLabels: Record<string, string> = {
    all: '全部', prompt: 'Prompt 模板', tag: '标签模板', deduce: '推导模板',
  }
  const categoryColors: Record<string, string> = {
    prompt: '#8b5cf6', tag: '#10b981', deduce: '#f59e0b',
  }

  return (
    <div style={{ padding: '24px', color: '#e0e0e0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>📦 模板库</h2>
        <button onClick={() => setIsCreating(true)} style={btnPrimaryStyle}>➕ 新建模板</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索模板..."
          style={{ ...inputStyle, width: 240 }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'prompt', 'tag', 'deduce'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '6px 14px', borderRadius: 6,
                border: activeCategory === cat ? `1px solid ${categoryColors[cat] || '#8b5cf6'}` : '1px solid #2a2a2a',
                background: activeCategory === cat ? `${categoryColors[cat] || '#8b5cf6'}15` : '#0f0f0f',
                color: activeCategory === cat ? (categoryColors[cat] || '#a78bfa') : '#9ca3af',
                fontSize: 13, cursor: 'pointer',
              }}
            >
              {categoryLabels[cat]}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {filteredTemplates.map((template) => (
          <div key={template.id} style={{
            padding: 16, background: '#0a0a0a', borderRadius: 10,
            border: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 11,
                    background: (categoryColors[template.category] || '#6b7280') + '20',
                    color: categoryColors[template.category] || '#9ca3af',
                  }}>
                    {categoryLabels[template.category]}
                  </span>
                  {template.isBuiltin && (
                    <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>内置</span>
                  )}
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: '#e0e0e0' }}>{template.name}</h3>
              </div>
              {!template.isBuiltin && (
                <button onClick={() => handleDelete(template.id)} style={{ ...btnDangerStyle, fontSize: 11, padding: '4px 8px' }}>🗑️</button>
              )}
            </div>
            <p style={{ color: '#6b7280', fontSize: 12, lineHeight: 1.5 }}>{template.description}</p>
            <div style={{
              padding: 10, background: '#0f0f0f', borderRadius: 6,
              fontSize: 12, color: '#9ca3af', maxHeight: 100, overflow: 'auto', fontFamily: 'monospace',
            }}>
              {template.content.slice(0, 200)}{template.content.length > 200 && '...'}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {template.tags.map((tag) => (
                <span key={tag} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: 'rgba(255,255,255,0.05)', color: '#6b7280' }}>{tag}</span>
              ))}
            </div>
            <button onClick={() => handleApply(template)} style={{ ...btnPrimaryStyle, width: '100%', marginTop: 'auto', fontSize: 13 }}>
              {template.category === 'prompt' ? '📋 复制 Prompt' : template.category === 'tag' ? '🏷️ 应用标签' : '🚀 加载推导配置'}
            </button>
          </div>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}>未找到匹配的模板</div>
      )}

      {isCreating && (
        <div style={modalOverlayStyle} onClick={() => setIsCreating(false)}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>➕ 新建模板</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>模板名称 *</label>
                <input value={newTemplate.name} onChange={(e) => setNewTemplate((p) => ({ ...p, name: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>类型</label>
                <select value={newTemplate.category} onChange={(e) => setNewTemplate((p) => ({ ...p, category: e.target.value as TemplateCategory }))} style={inputStyle}>
                  <option value="prompt">Prompt 模板</option>
                  <option value="tag">标签模板（JSON 数组）</option>
                  <option value="deduce">推导模板（JSON 配置）</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>描述</label>
                <input value={newTemplate.description} onChange={(e) => setNewTemplate((p) => ({ ...p, description: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>内容 *</label>
                <textarea
                  value={newTemplate.content}
                  onChange={(e) => setNewTemplate((p) => ({ ...p, content: e.target.value }))}
                  rows={6}
                  style={{ ...inputStyle, resize: 'vertical' }}
                  placeholder={newTemplate.category === 'tag' ? '[{"name":"标签1","category":"character"}]' : newTemplate.category === 'deduce' ? '{"targetWords":"30000"}' : '输入 Prompt 内容...'}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={handleCreate} style={{ ...btnPrimaryStyle, flex: 1 }}>💾 保存</button>
                <button onClick={() => setIsCreating(false)} style={{ ...btnSecondaryStyle, flex: 1 }}>取消</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a',
  borderRadius: '6px', color: '#e0e0e0', fontSize: '13px', outline: 'none',
  width: '100%', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 500, color: '#9ca3af', marginBottom: 6,
}
const btnPrimaryStyle: React.CSSProperties = {
  padding: '8px 16px', background: '#8b5cf6', color: '#fff', border: 'none',
  borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
}
const btnSecondaryStyle: React.CSSProperties = {
  padding: '6px 12px', background: '#1f1f1f', color: '#9ca3af',
  border: '1px solid #2a2a2a', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
}
const btnDangerStyle: React.CSSProperties = {
  padding: '6px 12px', background: '#ef4444', color: '#fff', border: 'none',
  borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
}
const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
}
const modalContentStyle: React.CSSProperties = {
  background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 12,
  padding: 24, maxWidth: 500, width: '90%', maxHeight: '85vh', overflow: 'auto',
}
