/**
 * 角色管理页面 - 增强版
 * 吸收自 F:\1\old 新组件的以下优点：
 * - P0: AI 结果自动解析回填（applyAIResult → parseAICharacterResult + applyParsedToForm）
 * - P1: 一键成人模式（handleOneClickAdultMode → generateAdultModeContent）
 * - P2: Framer Motion 动画增强（弹窗/卡片/面板进场退场动画）
 * - P3: Emoji 头像补充（AVATAR_OPTIONS + AVATAR_EMOJI_EXTRA 双分类）
 * - P4: 表单输入优化（年龄过滤、名称限长、卡片式紧凑网格）
 * - P5: AI 生成区域交互升级（3模式切换、流式输出、停止/应用按钮、无模型友好提示）
 *
 * 保留的现有核心资产：
 * - Character 接口字段完整保留（roleType 4分类、relationships 结构化数组、personality string[]）
 * - 关系图谱支持（relationships[] 与 plotView ReactFlow 完全兼容）
 * - 导出功能（MD/JSON）
 * - 删除时清理关联数据（其他角色 relationships + 章节 characters）
 */

import { useState, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store'
import PageWrapper from '../../components/PageWrapper'
import type { Character, RoleType } from '../../types/types'
import {
  CHARACTER_ROLE_CONFIG,
  ROLE_KEYS,
  PERSONALITY_TAGS,
  PERSONALITY_CATEGORY_CONFIG,
  AVATAR_OPTIONS,
  AVATAR_EMOJI_EXTRA,
  PRESET_CHARACTER_TEMPLATES,
  getRoleLabel,
  getPersonalityCategory,
} from '../../utils/character'
import {
  parseAICharacterResult,
  applyParsedToForm,
  generateAdultModeContent,
} from '../../utils/characterAI'
import { loadPrompt } from '../../utils/promptLoader'

// ==========================================
// 工具函数
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

// AI 流式调用（复用项目已有的 fetch 模式）
async function callAIStream(
  model: { baseUrl: string; apiKey: string; modelId: string; temperature: number; maxTokens: number },
  systemPrompt: string,
  userPrompt: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const url = model.baseUrl.replace(/\/+$/, '') + '/chat/completions'
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${model.apiKey}`,
    },
    body: JSON.stringify({
      model: model.modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: model.temperature,
      max_tokens: model.maxTokens,
      stream: true,
    }),
    signal,
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`AI 请求失败 (${res.status}): ${errText || res.statusText}`)
  }
  const reader = res.body?.getReader()
  if (!reader) throw new Error('响应流不可用')
  const decoder = new TextDecoder()
  let fullText = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') continue
      try {
        const parsed = JSON.parse(data)
        const content = parsed.choices?.[0]?.delta?.content
        if (typeof content === 'string') {
          fullText += content
          onChunk(fullText)
        }
      } catch { /* SSE 解析安全忽略 */ }
    }
  }
  return fullText
}

// ==========================================
// 动画配置
// ==========================================
const fadeInUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.2 },
}

const cardStagger = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
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
  const allChapters = useAppStore((s) => s.chapters)
  const updateChapter = useAppStore((s) => s.updateChapter)
  const aiModels = useAppStore((s) => s.aiModels)
  const currentModel = useAppStore((s) => s.currentModel)
  const adultMode = useAppStore((s) => s.adultMode)

  // ---- 基础状态 ----
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<RoleType | 'all'>('all')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState('')

  // ---- 表单状态 ----
  const [form, setForm] = useState<Character>(createEmptyCharacter())
  const [personalityInput, setPersonalityInput] = useState('')
  const [relTargetId, setRelTargetId] = useState('')
  const [relType, setRelType] = useState('')
  const [relDesc, setRelDesc] = useState('')

  // ---- AI 生成状态（P5 吸收自新组件） ----
  const [showAIGenerate, setShowAIGenerate] = useState(false)
  const [aiMode, setAiMode] = useState<'create' | 'expand' | 'voice'>('create')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiStream, setAiStream] = useState('')
  const [aiRequirements, setAiRequirements] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  // ---- 头像选择器状态（P3） ----
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [avatarTab, setAvatarTab] = useState<'preset' | 'emoji'>('preset')

  // ---- 预设模板面板 ----
  const [showTemplatePanel, setShowTemplatePanel] = useState(false)

  // ---- 性格标签选择（P5 吸收自新组件的标签选择） ----
  const [selectedPersonalityTags, setSelectedPersonalityTags] = useState<string[]>([])

  // ---- Toast 提示 ----
  const [toast, setToast] = useState('')

  const hasModel = !!(currentModel && aiModels.length > 0)

  // ---- 计算属性 ----
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

  const stats = useMemo(() => ({
    total: characters.length,
    protagonist: characters.filter((c) => c.roleType === 'protagonist').length,
    supporting: characters.filter((c) => c.roleType === 'supporting').length,
    antagonist: characters.filter((c) => c.roleType === 'antagonist').length,
  }), [characters])

  // ---- 操作方法 ----
  const openCreate = useCallback(() => {
    setForm(createEmptyCharacter())
    setPersonalityInput('')
    setEditingId(null)
    setShowForm(true)
    setRelTargetId('')
    setRelType('')
    setRelDesc('')
    setSelectedPersonalityTags([])
    setShowAIGenerate(false)
    setAiStream('')
    setAiRequirements('')
  }, [])

  const openEdit = useCallback((char: Character) => {
    setForm({ ...char })
    setPersonalityInput(char.personality.join('、'))
    setEditingId(char.id)
    setShowForm(true)
    setRelTargetId('')
    setRelType('')
    setRelDesc('')
    setSelectedPersonalityTags([...char.personality])
    setShowAIGenerate(false)
    setAiStream('')
    setAiRequirements('')
  }, [])

  const closeForm = useCallback(() => {
    setShowForm(false)
    setEditingId(null)
    setShowAIGenerate(false)
    setAiStream('')
  }, [])

  const handleSave = useCallback(() => {
    if (!form.name.trim()) {
      addLog({ type: 'warn', message: '角色姓名不能为空', detail: '' })
      return
    }
    const toSave: Character = {
      ...form,
      personality: [
        ...selectedPersonalityTags,
        ...personalityInput
          .split(/[,，、]/)
          .map((s) => s.trim())
          .filter(Boolean),
      ].filter((v, i, a) => a.indexOf(v) === i), // 去重
      updatedAt: Date.now(),
    }
    if (editingId) {
      updateCharacter(editingId, toSave)
      addLog({ type: 'success', message: '角色已更新', detail: toSave.name })
    } else {
      addCharacter(toSave)
      if (currentNovel) {
        useAppStore.getState().updateNovel({ characters: [...currentNovel.characters, toSave.id] })
      }
      addLog({ type: 'success', message: '角色已创建', detail: toSave.name })
    }
    setShowForm(false)
    setEditingId(null)
  }, [form, personalityInput, selectedPersonalityTags, editingId, addCharacter, updateCharacter, currentNovel, addLog])

  const confirmDelete = useCallback((id: string) => {
    setDeleteTargetId(id)
    setShowDeleteConfirm(true)
  }, [])

  const executeDelete = useCallback(() => {
    const id = deleteTargetId
    const target = characters.find((c) => c.id === id)
    if (!target) return
    removeCharacter(id)
    characters.forEach((c) => {
      if (c.id === id) return
      const hasRef = c.relationships.some((r) => r.targetId === id)
      if (hasRef) {
        updateCharacter(c.id, { relationships: c.relationships.filter((r) => r.targetId !== id) })
      }
    })
    allChapters.forEach((ch) => {
      if (ch.characters.includes(id)) {
        updateChapter(ch.id, { characters: ch.characters.filter((cid) => cid !== id) })
      }
    })
    addLog({ type: 'success', message: '角色已删除', detail: target.name })
    setShowDeleteConfirm(false)
    setDeleteTargetId('')
  }, [deleteTargetId, characters, removeCharacter, updateCharacter, allChapters, updateChapter, addLog])

  const handleAddRelationship = useCallback(() => {
    if (!relTargetId || !relType.trim()) return
    const target = characters.find((c) => c.id === relTargetId)
    if (!target) return
    setForm((prev) => ({
      ...prev,
      relationships: [...prev.relationships, {
        targetId: target.id,
        targetName: target.name,
        type: relType.trim(),
        description: relDesc.trim(),
      }],
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

  // ---- 性格标签切换 ----
  const togglePersonalityTag = useCallback((tag: string) => {
    setSelectedPersonalityTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }, [])

  // ---- AI 生成角色（P5 吸收自新组件） ----
  const handleAIGenerate = useCallback(async () => {
    if (!currentModel) return

    setAiGenerating(true)
    setAiStream('')
    const ac = new AbortController()
    abortRef.current = ac

    try {
      let prompt = ''
      // 成人模式用成人提示词，普通模式用通用提示词
      const sysPromptKey = adultMode ? 'characterPrompts' : 'characterPrompts'
      const sysText = loadPrompt(sysPromptKey)

      // 尝试从 .md 加载系统提示词
      let systemPrompt = ''
      if (sysText) {
        if (adultMode) {
          const match = sysText.match(/## 系统提示词：成人情色角色[\s\S]*?---[\s\S]*?([\s\S]*?)(?=\n## |$)/)
          systemPrompt = match ? match[1].trim() : '你是一位专业的角色设计师。'
        } else {
          const match = sysText.match(/## 系统提示词：通用角色[\s\S]*?---[\s\S]*?([\s\S]*?)(?=\n## |$)/)
          systemPrompt = match ? match[1].trim() : '你是一位专业的角色设计师。'
        }
      }
      if (!systemPrompt) {
        systemPrompt = adultMode
          ? '你是一位专业的情色肉文角色设计师，擅长创建立体、充满强烈性欲的成人角色。'
          : '你是一位专业的角色设计师，擅长创建立体、有深度的角色。'
      }

      if (aiMode === 'create') {
        const genderLabel = form.basicInfo.gender === '女' ? '女性' : form.basicInfo.gender === '男' ? '男性' : '不限'
        const ageLabel = form.basicInfo.age.trim() || '不限'
        const nameSection = form.name.trim() ? `角色名字：${form.name.trim()}` : '角色名字：未指定，请自动生成'
        const roleLabel = getRoleLabel(form.roleType)
        const req = aiRequirements.trim() || '设计一个令人印象深刻的角色'

        prompt = `请为以下小说设计一个角色：

小说主题：${currentNovel?.summary || '自由创作'}
角色类型：${roleLabel}
角色性别：${genderLabel}
角色年龄：${ageLabel}
${nameSection}
基本要求：${req}

请按以下格式输出：
## 基本信息
- 姓名：
- 年龄：
- 性别：
- 身份/职业：

## 外貌特征
（详细描写）

## 性格特点
（核心性格、优点与缺点、习惯等）

## 背景故事
（成长经历、关键事件）

## 能力与特长
（特殊技能、擅长领域）

## 人际关系
（与他人的关系描述）

## 语言风格
（说话方式、口头禅、语气特点）

## 内心世界
（最深的渴望、恐惧、秘密）

## 目标与动机
（角色追求什么、为什么这样做）`
      } else if (aiMode === 'expand') {
        prompt = `请基于以下角色简要描述，扩展为完整的角色设定：

角色名：${form.name || '未命名'}
简要描述：${form.appearance || form.background || '暂无描述'}
小说类型：${currentNovel?.summary || '自由创作'}

请详细扩展外貌细节、性格层次、背景故事、说话方式、内心驱动、特殊设定。`
      } else if (aiMode === 'voice') {
        prompt = `请为以下角色设计独特的语言风格：

角色名：${form.name || '未命名'}
性格：${form.personality.join('、') || '未知'}
背景：${form.background || '未知'}
身份：${getRoleLabel(form.roleType)}

请设计：
1. 日常对话示例（3段）
2. 情绪激动时的说话方式
3. 口头禅和常用表达
4. 语言习惯（如语气词、断句方式等）`
      }

      await callAIStream(currentModel, systemPrompt, prompt, (text) => {
        setAiStream(text)
      }, ac.signal)

      addLog({ type: 'success', message: 'AI生成角色设定完成', detail: '' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '未知错误'
      if (msg !== 'The user aborted a request.') {
        addLog({ type: 'error', message: 'AI生成角色失败', detail: msg })
      }
    } finally {
      setAiGenerating(false)
      abortRef.current = null
    }
  }, [currentModel, aiMode, form, aiRequirements, adultMode, currentNovel, addLog])

  // ---- 应用 AI 结果到表单（P0 核心资产） ----
  const handleApplyAIResult = useCallback(() => {
    if (!aiStream.trim()) return
    // 此段吸收自 F:\1\old 新组件 applyAIResult，增强版使用统一解析器
    const parsed = parseAICharacterResult(aiStream)
    const newForm = applyParsedToForm(parsed, form)
    setForm(newForm)
    setPersonalityInput(newForm.personality.join('、'))
    setSelectedPersonalityTags(newForm.personality)
    setAiStream('')
    setShowAIGenerate(false)
    setToast('✅ AI 结果已应用到表单')
    setTimeout(() => setToast(''), 2000)
  }, [aiStream, form])

  // ---- 停止生成 ----
  const handleAbortAI = useCallback(() => {
    abortRef.current?.abort()
    setAiGenerating(false)
  }, [])

  // ---- 一键成人模式（P1 吸收自新组件） ----
  const handleOneClickAdultMode = useCallback(() => {
    const result = generateAdultModeContent(form.basicInfo.gender)
    setForm((prev) => ({
      ...prev,
      basicInfo: {
        ...prev.basicInfo,
        age: prev.basicInfo.age || '18',
        gender: prev.basicInfo.gender || '女',
      },
      appearance: prev.appearance ? prev.appearance + '\n\n' + result.appearance : result.appearance,
      innerWorld: prev.innerWorld ? prev.innerWorld + '\n\n' + result.innerWorld : result.innerWorld,
      arc: prev.arc || result.arc,
    }))
    setSelectedPersonalityTags((prev) => {
      const set = new Set(prev)
      for (const tag of result.personalityTags) set.add(tag)
      return Array.from(set)
    })
    addLog({ type: 'success', message: '已切换至成人模式', detail: '' })
    setToast('🔥 一键成人模式已激活！')
    setTimeout(() => setToast(''), 2500)
  }, [form.basicInfo.gender, form.basicInfo.age, form.appearance, form.innerWorld, form.arc, addLog])

  // ---- 从模板创建 ----
  const createFromTemplate = useCallback((template: typeof PRESET_CHARACTER_TEMPLATES[number]) => {
    setForm({
      ...createEmptyCharacter(),
      name: template.name,
      roleType: template.role,
      appearance: template.description,
      personality: [...template.personality],
      avatar: template.avatar,
    })
    setSelectedPersonalityTags([...template.personality])
    setPersonalityInput(template.personality.join('、'))
    setShowTemplatePanel(false)
    setShowForm(true)
    setEditingId(null)
  }, [])

  // ---- 导出角色 MD ----
  const exportCharacterMD = useCallback((char: Character) => {
    const content = [
      `# ${char.name}`,
      ``,
      `> 类型：${getRoleLabel(char.roleType)}`,
      `> 性别：${char.basicInfo.gender || '未设定'} | 年龄：${char.basicInfo.age || '未设定'}`,
      `> 职业：${char.basicInfo.occupation || '未设定'}`,
      ``,
      `## 外貌`,
      char.appearance || '暂无',
      ``,
      `## 性格`,
      char.personality.join('、') || '暂无',
      ``,
      `## 背景`,
      char.background || '暂无',
      ``,
      `## 能力`,
      char.abilities || '暂无',
      ``,
      `## 语言风格`,
      char.voice || '暂无',
      ``,
      `## 内心世界`,
      char.innerWorld || '暂无',
      ``,
      `## 目标/动机`,
      char.arc || '暂无',
      ``,
      `## 关系`,
      char.relationships.length > 0
        ? char.relationships.map(r => `- ${r.targetName}（${r.type}）：${r.description}`).join('\n')
        : '暂无',
      ``,
      `---`,
      `创建时间：${new Date(char.createdAt).toLocaleString()}`,
      `更新时间：${new Date(char.updatedAt).toLocaleString()}`,
    ].join('\n')
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${char.name}-角色设定.md`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  // ---- 导出全部 JSON ----
  const exportAllJSON = useCallback(() => {
    const data = { characters, exportedAt: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `角色数据-${new Date().toLocaleDateString()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [characters])

  // ---- 输入样式常量 ----
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', background: '#0f0f0f',
    border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0',
    fontSize: '14px', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '12px', color: '#aaa', marginBottom: '6px', display: 'block',
  }

  // ==========================================
  // 渲染
  // ==========================================
  return (
    <PageWrapper
      title="角色管理"
      subtitle="管理小说中的所有角色，编辑信息、建立关系、同步全局数据"
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={exportAllJSON} disabled={characters.length === 0}
            style={{ padding: '8px 16px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', color: characters.length === 0 ? '#555' : '#888', fontSize: '13px', cursor: characters.length === 0 ? 'not-allowed' : 'pointer' }}>
            📦 导出全部
          </button>
          <button onClick={() => setShowTemplatePanel(!showTemplatePanel)}
            style={{ padding: '8px 16px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#888', fontSize: '13px', cursor: 'pointer' }}>
            🎭 模板
          </button>
          <button onClick={openCreate}
            style={{ padding: '8px 16px', background: '#6366f1', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>
            + 新建角色
          </button>
        </div>
      }
    >
      {/* 统计卡片 - P2 stagger 动画 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {[
          { label: '总角色', value: stats.total, color: '#e0e0e0' },
          { label: '主角', value: stats.protagonist, color: '#6366f1' },
          { label: '配角', value: stats.supporting, color: '#10b981' },
          { label: '反派', value: stats.antagonist, color: '#ef4444' },
        ].map((s, i) => (
          <motion.div key={s.label} {...cardStagger} transition={{ delay: i * 0.05 }}
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* 预设模板面板 - P2 AnimatePresence */}
      <AnimatePresence>
        {showTemplatePanel && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#e0e0e0' }}>预设角色模板</span>
                <button onClick={() => setShowTemplatePanel(false)} style={{ color: '#666', border: 'none', background: 'none', fontSize: '16px', cursor: 'pointer' }}>×</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {PRESET_CHARACTER_TEMPLATES.map((t, i) => {
                  const config = CHARACTER_ROLE_CONFIG[t.role as RoleType]
                  return (
                    <motion.button key={i} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => createFromTemplate(t)}
                      style={{ padding: '12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', color: 'inherit' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '18px' }}>{t.avatar}</span>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: '#e0e0e0' }}>{t.name}</span>
                        <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '6px', background: config.bgColor, color: config.color }}>{config.label}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#888', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.description}</div>
                    </motion.button>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 工具栏 */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索角色姓名、职业、外貌..."
          style={{ flex: 1, ...inputStyle }} />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value as RoleType | 'all')}
          style={{ padding: '10px 14px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none' }}>
          <option value="all">全部类型</option>
          <option value="protagonist">主角</option>
          <option value="supporting">配角</option>
          <option value="minor">龙套</option>
          <option value="antagonist">反派</option>
        </select>
      </div>

      {/* 角色列表 - P2 stagger 进场动画 */}
      {filtered.length === 0 ? (
        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '14px', color: '#666' }}>
            {characters.length === 0 ? '暂无角色，点击上方按钮创建' : '没有匹配的角色'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {filtered.map((c, idx) => (
            <motion.div key={c.id} {...cardStagger} transition={{ delay: idx * 0.03 }}
              onClick={() => openEdit(c)}
              style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: `${roleColorMap[c.roleType]}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                    {c.avatar || (c.basicInfo.gender === '女' ? '👩' : '👨')}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: '#e0e0e0' }}>{c.name}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>{c.basicInfo.age} · {c.basicInfo.gender} · {c.basicInfo.occupation}</div>
                  </div>
                </div>
                <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '8px', border: `1px solid ${roleColorMap[c.roleType]}40`, color: roleColorMap[c.roleType], background: `${roleColorMap[c.roleType]}15`, flexShrink: 0 }}>
                  {roleLabelMap[c.roleType]}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {c.appearance || '暂无外貌描述'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                {c.personality.slice(0, 4).map((p) => {
                  const cat = getPersonalityCategory(p)
                  const tagColor = cat ? PERSONALITY_CATEGORY_CONFIG[cat].color : '#888'
                  return (
                    <span key={p} style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '8px', background: `${tagColor}15`, color: tagColor }}>{p}</span>
                  )
                })}
                {c.personality.length > 4 && (
                  <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '8px', background: '#333', color: '#666' }}>+{c.personality.length - 4}</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#666' }}>
                <span>{c.relationships.length > 0 ? `${c.relationships.length} 条关系` : '无关系'}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={(e) => { e.stopPropagation(); exportCharacterMD(c) }}
                    style={{ color: '#888', border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px' }}>导出</button>
                  <button onClick={(e) => { e.stopPropagation(); confirmDelete(c.id) }}
                    style={{ color: '#f87171', border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px' }}>删除</button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* 编辑/创建弹窗 - P2 Framer Motion 进场/退场动画 */}
      <AnimatePresence>
        {showForm && (
          <motion.div {...fadeInUp}
            style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#00000099', padding: '16px' }}>
            <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', width: '100%', maxWidth: '720px', maxHeight: '90vh', overflow: 'auto' }}>
              {/* 弹窗头部 */}
              <div style={{ position: 'sticky', top: 0, background: '#1a1a1a', borderBottom: '1px solid #2a2a2a', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
                <div style={{ fontSize: '16px', fontWeight: 500, color: '#e0e0e0' }}>{editingId ? '编辑角色' : '新建角色'}</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {/* AI 辅助按钮 */}
                  <button
                    onClick={() => {
                      if (!hasModel) return
                      setAiMode('create')
                      setShowAIGenerate(!showAIGenerate)
                    }}
                    style={{
                      padding: '6px 14px', borderRadius: '8px', fontSize: '13px', cursor: hasModel ? 'pointer' : 'not-allowed',
                      background: showAIGenerate ? '#6366f1' : '#1a1a1a', border: `1px solid ${showAIGenerate ? '#6366f1' : '#333'}`,
                      color: showAIGenerate ? '#fff' : '#888', opacity: hasModel ? 1 : 0.4,
                    }}>
                    ✨ AI辅助
                  </button>
                  <button onClick={closeForm} style={{ color: '#666', border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer' }}>×</button>
                </div>
              </div>

              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* 头像 + 名称 + 类型 - P3 头像选择器含 Emoji 分类 */}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div style={{ position: 'relative' }}>
                    <div
                      onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                      style={{
                        width: '56px', height: '56px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '28px', cursor: 'pointer', border: '2px dashed #2a2a2a', background: CHARACTER_ROLE_CONFIG[form.roleType].bgColor,
                      }}>
                      {form.avatar || '👤'}
                    </div>
                    {/* 头像选择器弹层 */}
                    <AnimatePresence>
                      {showAvatarPicker && (
                        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                          style={{ position: 'absolute', top: '100%', left: 0, marginTop: '8px', padding: '12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '12px', zIndex: 60, width: '280px' }}>
                          {/* Tab 切换 */}
                          <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                            <button onClick={() => setAvatarTab('preset')}
                              style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', background: avatarTab === 'preset' ? '#6366f1' : '#1a1a1a', color: avatarTab === 'preset' ? '#fff' : '#888', border: 'none' }}>
                              预设
                            </button>
                            <button onClick={() => setAvatarTab('emoji')}
                              style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', background: avatarTab === 'emoji' ? '#6366f1' : '#1a1a1a', color: avatarTab === 'emoji' ? '#fff' : '#888', border: 'none' }}>
                              Emoji
                            </button>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '4px' }}>
                            {(avatarTab === 'preset' ? AVATAR_OPTIONS : AVATAR_EMOJI_EXTRA).map((a, i) => (
                              <button key={i}
                                onClick={() => { setForm((p) => ({ ...p, avatar: a })); setShowAvatarPicker(false) }}
                                style={{
                                  width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '14px', border: 'none', cursor: 'pointer',
                                  background: form.avatar === a ? 'rgba(99,102,241,0.2)' : 'transparent',
                                  outline: form.avatar === a ? '1px solid #6366f1' : 'none',
                                }}>
                                {a}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* 姓名 - P4 限制20字 */}
                    <input value={form.name} maxLength={20}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value.slice(0, 20) }))}
                      placeholder="角色名称（最多20字）" style={inputStyle} />
                    {/* 性别 + 年龄 - P4 年龄过滤 */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {(['男', '女', '其他'] as const).map((g) => (
                        <button key={g}
                          onClick={() => setForm((p) => ({ ...p, basicInfo: { ...p.basicInfo, gender: g } }))}
                          style={{
                            padding: '6px 14px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer',
                            background: form.basicInfo.gender === g ? (g === '女' ? '#ec4899' : g === '男' ? '#3b82f6' : '#8b5cf6') : '#0f0f0f',
                            border: `1px solid ${form.basicInfo.gender === g ? 'transparent' : '#2a2a2a'}`,
                            color: form.basicInfo.gender === g ? '#fff' : '#888',
                          }}>
                          {g === '男' ? '👨' : g === '女' ? '👩' : '⚧'} {g}
                        </button>
                      ))}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', fontSize: '13px' }}>
                        <span style={{ color: '#888' }}>🎂</span>
                        <input value={form.basicInfo.age}
                          onChange={(e) => setForm((p) => ({ ...p, basicInfo: { ...p.basicInfo, age: e.target.value.replace(/[^\d岁半]/g, '') } }))}
                          placeholder="年龄" style={{ width: '48px', background: 'transparent', border: 'none', color: '#e0e0e0', fontSize: '13px', outline: 'none' }} />
                      </div>
                    </div>
                    {/* 角色类型 + 成人模式按钮 - P1 */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {ROLE_KEYS.map((role) => {
                        const config = CHARACTER_ROLE_CONFIG[role]
                        return (
                          <button key={role}
                            onClick={() => setForm((p) => ({ ...p, roleType: role }))}
                            style={{
                              padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer',
                              background: form.roleType === role ? config.color : '#0f0f0f',
                              border: `1px solid ${form.roleType === role ? 'transparent' : '#2a2a2a'}`,
                              color: form.roleType === role ? '#fff' : '#888',
                            }}>
                            {config.icon} {config.label}
                          </button>
                        )
                      })}
                      {/* P1 一键成人模式按钮 - 渐变+脉冲动画 */}
                      <button onClick={handleOneClickAdultMode}
                        style={{
                          padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer',
                          background: 'linear-gradient(to right, #ff3366, #ff6b6b)', border: 'none', color: '#fff',
                          animation: 'pulse 2s infinite', fontWeight: 500,
                          boxShadow: '0 0 12px rgba(255,51,102,0.3)',
                        }}>
                        🔥 一键成人模式
                      </button>
                    </div>
                  </div>
                </div>

                {/* 职业 */}
                <div>
                  <label style={labelStyle}>职业/身份</label>
                  <input value={form.basicInfo.occupation}
                    onChange={(e) => setForm((p) => ({ ...p, basicInfo: { ...p.basicInfo, occupation: e.target.value } }))}
                    placeholder="如：剑士、魔法师、公司职员..." style={inputStyle} />
                </div>

                {/* 性格标签选择 - P5 吸收自新组件的标签选择面板 */}
                <div style={{ background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '10px', padding: '14px' }}>
                  <label style={{ ...labelStyle, marginBottom: '10px' }}>性格标签（点击选择/取消）</label>
                  {(Object.entries(PERSONALITY_CATEGORY_CONFIG) as [keyof typeof PERSONALITY_TAGS, typeof PERSONALITY_CATEGORY_CONFIG[keyof typeof PERSONALITY_TAGS]][]).map(([cat, config]) => (
                    <div key={cat} style={{ marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', color: config.color, fontWeight: 600, display: 'block', marginBottom: '4px' }}>{config.label}</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {PERSONALITY_TAGS[cat].map((tag) => {
                          const selected = selectedPersonalityTags.includes(tag)
                          return (
                            <button key={tag} onClick={() => togglePersonalityTag(tag)}
                              style={{
                                padding: '3px 8px', borderRadius: '12px', fontSize: '11px', cursor: 'pointer', border: 'none',
                                background: selected ? config.color : '#1a1a1a',
                                color: selected ? '#fff' : '#888',
                                transition: 'all 0.15s',
                              }}>
                              {tag}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#666' }}>自定义标签（用、分隔）</span>
                    <input value={personalityInput} onChange={(e) => setPersonalityInput(e.target.value)}
                      placeholder="补充标签，如：腹黑、闷骚..." style={{ ...inputStyle, marginTop: '4px' }} />
                  </div>
                </div>

                {/* 外貌 */}
                <div>
                  <label style={labelStyle}>外貌描述</label>
                  <textarea value={form.appearance} onChange={(e) => setForm((p) => ({ ...p, appearance: e.target.value }))}
                    rows={3} placeholder="描述角色的身材、穿着、气质..." style={{ ...inputStyle, resize: 'vertical' }} />
                </div>

                {/* 背景 + 能力 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>背景经历</label>
                    <textarea value={form.background} onChange={(e) => setForm((p) => ({ ...p, background: e.target.value }))}
                      rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                  </div>
                  <div>
                    <label style={labelStyle}>能力/技能</label>
                    <textarea value={form.abilities} onChange={(e) => setForm((p) => ({ ...p, abilities: e.target.value }))}
                      rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                  </div>
                </div>

                {/* 语言风格 + 内心世界 + 目标 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>语言风格</label>
                    <textarea value={form.voice} onChange={(e) => setForm((p) => ({ ...p, voice: e.target.value }))}
                      rows={2} placeholder="说话方式、口头禅..." style={{ ...inputStyle, resize: 'vertical' }} />
                  </div>
                  <div>
                    <label style={labelStyle}>内心世界</label>
                    <textarea value={form.innerWorld} onChange={(e) => setForm((p) => ({ ...p, innerWorld: e.target.value }))}
                      rows={2} placeholder="渴望、恐惧、秘密..." style={{ ...inputStyle, resize: 'vertical' }} />
                  </div>
                  <div>
                    <label style={labelStyle}>目标/动机</label>
                    <textarea value={form.arc} onChange={(e) => setForm((p) => ({ ...p, arc: e.target.value }))}
                      rows={2} placeholder="角色追求什么..." style={{ ...inputStyle, resize: 'vertical' }} />
                  </div>
                </div>

                {/* 角色关系 */}
                <div style={{ border: '1px solid #2a2a2a', borderRadius: '8px', padding: '14px' }}>
                  <label style={{ ...labelStyle, fontWeight: 600, color: '#ccc' }}>角色关系</label>
                  {form.relationships.length === 0 && <div style={{ fontSize: '12px', color: '#666', margin: '8px 0' }}>暂无关系</div>}
                  {form.relationships.map((rel, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0f0f0f', borderRadius: '8px', padding: '8px 12px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px', color: '#e0e0e0' }}>{rel.targetName}</span>
                      <span style={{ fontSize: '12px', padding: '2px 6px', borderRadius: '8px', background: '#6366f115', color: '#6366f1' }}>{rel.type}</span>
                      <span style={{ fontSize: '12px', color: '#888', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rel.description}</span>
                      <button onClick={() => handleRemoveRelationship(idx)} style={{ fontSize: '12px', color: '#f87171', border: 'none', background: 'none', cursor: 'pointer' }}>移除</button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: '8px', paddingTop: '8px', borderTop: '1px solid #2a2a2a' }}>
                    <select value={relTargetId} onChange={(e) => setRelTargetId(e.target.value)}
                      style={{ flex: 1, padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none' }}>
                      <option value="">选择目标角色</option>
                      {characters.filter((c) => c.id !== form.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <input value={relType} onChange={(e) => setRelType(e.target.value)} placeholder="关系类型" style={{ flex: 1, ...inputStyle }} />
                    <input value={relDesc} onChange={(e) => setRelDesc(e.target.value)} placeholder="描述" style={{ flex: 2, ...inputStyle }} />
                    <button onClick={handleAddRelationship} disabled={!relTargetId || !relType.trim()}
                      style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer', opacity: (!relTargetId || !relType.trim()) ? 0.4 : 1 }}>添加</button>
                  </div>
                </div>

                {/* AI 生成区域 - P5 吸收自新组件 */}
                <AnimatePresence>
                  {showAIGenerate && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
                      <div style={{ padding: '14px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', color: '#6366f1', fontWeight: 600 }}>✨ AI 辅助生成</span>
                          {/* 模式切换 */}
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {[
                              { key: 'create' as const, label: '创建角色' },
                              { key: 'expand' as const, label: '扩展设定' },
                              { key: 'voice' as const, label: '语言风格' },
                            ].map((m) => (
                              <button key={m.key} onClick={() => setAiMode(m.key)}
                                style={{
                                  padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer',
                                  background: aiMode === m.key ? '#6366f1' : 'transparent', border: 'none',
                                  color: aiMode === m.key ? '#fff' : '#888',
                                }}>
                                {m.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 生成要求输入 */}
                        {aiMode === 'create' && (
                          <input value={aiRequirements} onChange={(e) => setAiRequirements(e.target.value)}
                            placeholder="输入角色生成要求（如：冷酷杀手，身世神秘...）" style={inputStyle} />
                        )}

                        {/* 操作按钮 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button onClick={handleAIGenerate} disabled={aiGenerating || !hasModel}
                            style={{
                              padding: '8px 16px', borderRadius: '8px', fontSize: '13px', cursor: aiGenerating || !hasModel ? 'not-allowed' : 'pointer',
                              background: '#6366f1', color: '#fff', border: 'none', opacity: aiGenerating || !hasModel ? 0.4 : 1,
                            }}>
                            {aiGenerating ? '⏳ 生成中...' : '✨ 开始生成'}
                          </button>
                          {aiGenerating && (
                            <button onClick={handleAbortAI}
                              style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: '#ef4444', color: '#fff', border: 'none' }}>
                              ⏹ 停止
                            </button>
                          )}
                          {!hasModel && (
                            <span style={{ fontSize: '12px', color: '#f59e0b' }}>请先在模型中心配置模型</span>
                          )}
                        </div>

                        {/* 流式输出展示 - P5 带打字机光标动画 */}
                        {aiStream && (
                          <div>
                            <div style={{
                              padding: '12px', background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '8px',
                              maxHeight: '200px', overflowY: 'auto', fontSize: '12px', color: '#aaa', whiteSpace: 'pre-wrap', lineHeight: 1.6,
                            }}>
                              {aiStream}
                              {aiGenerating && <span style={{ display: 'inline-block', width: '6px', height: '14px', background: '#6366f1', marginLeft: '2px', verticalAlign: 'middle', animation: 'pulse 1s infinite' }} />}
                            </div>
                            {!aiGenerating && (
                              <button onClick={handleApplyAIResult}
                                style={{
                                  marginTop: '8px', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer',
                                  background: '#3b82f6', color: '#fff', border: 'none',
                                }}>
                                ✅ 应用到表单
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 操作按钮 */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '8px' }}>
                  <button onClick={closeForm} style={{ background: '#1a1a1a', color: '#e0e0e0', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer' }}>取消</button>
                  <button onClick={handleSave} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer', fontWeight: 500 }}>{editingId ? '保存修改' : '创建角色'}</button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 删除确认弹窗 */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div {...fadeInUp}
            style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#00000099', padding: '16px' }}>
            <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', width: '100%', maxWidth: '384px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '16px', fontWeight: 500, color: '#e0e0e0' }}>确认删除角色</div>
              <div style={{ fontSize: '14px', color: '#888' }}>删除后该角色将从所有章节和关联关系中移除，此操作不可撤销。</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button onClick={() => setShowDeleteConfirm(false)} style={{ background: '#1a1a1a', color: '#e0e0e0', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer' }}>取消</button>
                <button onClick={executeDelete} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer' }}>确认删除</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast 提示 */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            style={{
              position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)', zIndex: 100,
              padding: '10px 24px', borderRadius: '12px',
              background: 'linear-gradient(to right, #ff3366, #ff6b6b)', color: '#fff',
              fontSize: '14px', fontWeight: 500, boxShadow: '0 4px 20px rgba(255,51,102,0.4)',
            }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 脉冲动画关键帧 - 全局注入一次 */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </PageWrapper>
  )
}
