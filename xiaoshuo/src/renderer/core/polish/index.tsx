import { useState, useCallback } from 'react'
import { useAppStore } from '../../store'
import { loadPrompt } from '../../utils/promptLoader'
import PageWrapper from '../../components/PageWrapper'
import type { AIModel } from '../../../config/types'

// ==========================================
// 工具
// ==========================================

async function callAIStream(
  model: AIModel,
  systemPrompt: string,
  userPrompt: string,
  onChunk: (text: string) => void
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
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`AI 请求失败 (${res.status}): ${errText || res.statusText}`)
  }

  const reader = res.body?.getReader()
  const decoder = new TextDecoder()
  let fullText = ''
  if (!reader) throw new Error('响应流不可用')

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    for (const line of chunk.split('\n')) {
      const t = line.trim()
      if (!t.startsWith('data: ')) continue
      const data = t.slice(6)
      if (data === '[DONE]') continue
      try {
        const p = JSON.parse(data)
        const c = p.choices?.[0]?.delta?.content
        if (typeof c === 'string') {
          fullText += c
          onChunk(fullText)
        }
      } catch {
        // 忽略解析失败
      }
    }
  }
  return fullText
}

// ==========================================
// 润色风格配置
// ==========================================

type PolishStyle =
  | 'formal'
  | 'vivid'
  | 'concise'
  | 'ornate'
  | 'adult'
  | 'removeAI'

interface StyleConfig {
  label: string
  description: string
  systemExtra: string
}

const styleConfigMap: Record<PolishStyle, StyleConfig> = {
  formal: {
    label: '正式严谨',
    description: '规范用词，提升逻辑性和专业感',
    systemExtra: '请使用正式、规范的语言风格，提升文本的逻辑性和专业感，避免口语化表达。',
  },
  vivid: {
    label: '生动形象',
    description: '增强画面感和感官描写',
    systemExtra: '请增强画面感和感官描写，让场景更生动、更有代入感，多用具体细节替代抽象描述。',
  },
  concise: {
    label: '简洁有力',
    description: '删繁就简，节奏明快',
    systemExtra: '请精简冗余表达，删除不必要的修饰词和重复句，让行文更简洁、节奏更明快。',
  },
  ornate: {
    label: '华丽辞藻',
    description: '提升文学性，修辞丰富',
    systemExtra: '请提升文学性和修辞水平，适当运用比喻、排比、对仗等修辞手法，文字富有诗意和韵律感。',
  },
  adult: {
    label: '成人向',
    description: '强化情欲张力与感官描写',
    systemExtra: '请强化情欲张力和感官描写，运用五感（视觉、触觉、听觉、嗅觉、味觉）让情欲场景更具体、更露骨、更有冲击力。',
  },
  removeAI: {
    label: '去AI味',
    description: '消除AI生成痕迹',
    systemExtra: '请消除文本中的AI生成痕迹：去除模板化过渡句、过度副词（不禁、缓缓、微微等）、总结性语句、千篇一律的情感描写，让文字更像人类作家写的。',
  },
}

// ==========================================
// 主组件
// ==========================================

export default function PolishPage() {
  const aiModels = useAppStore((s) => s.aiModels)
  const currentModel = useAppStore((s) => s.currentModel)
  const adultMode = useAppStore((s) => s.adultMode)
  const addLog = useAppStore((s) => s.addLog)

  const [selectedModelId, setSelectedModelId] = useState(
    currentModel?.id ?? ''
  )
  const [style, setStyle] = useState<PolishStyle>(
    adultMode ? 'adult' : 'vivid'
  )
  const [original, setOriginal] = useState('')
  const [polished, setPolished] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'split' | 'polished'>('split')

  const selectedModel =
    aiModels.find((m) => m.id === selectedModelId) || currentModel

  const handlePolish = useCallback(async () => {
    if (!original.trim()) {
      setError('请输入需要润色的文本')
      return
    }
    if (!selectedModel) {
      setError('请选择 AI 模型')
      return
    }

    setError(null)
    setLoading(true)
    setProgress(5)
    setStatusText('正在加载提示词...')
    setPolished('')

    try {
      const promptText = loadPrompt('prompts')
      if (!promptText) throw new Error('prompts.md 加载失败')

      // 提取润色系统提示词
      let systemPrompt = ''

      if (style === 'adult') {
        const adultMatch = promptText.match(
          /## 成人情色小说 - 润色系统提示词\s*([\s\S]*?)(?=\n\s*---|\n\s*## |$)/
        )
        systemPrompt = adultMatch
          ? adultMatch[1].trim()
          : '你是一位极具文学功底的中文成人情色小说润色专家。'
      } else if (style === 'removeAI') {
        const aiMatch = promptText.match(
          /## 去AI味专用提示词\s*([\s\S]*?)(?=\n\s*---|\n\s*## |$)/
        )
        systemPrompt = aiMatch
          ? aiMatch[1].trim()
          : '你是一位专业的人类化文本改写专家。'
      } else {
        const polishMatch = promptText.match(
          /## 润色系统提示词\s*([\s\S]*?)(?=\n\s*---|\n\s*## |$)/
        )
        systemPrompt = polishMatch
          ? polishMatch[1].trim()
          : '你是一位顶级文本润色编辑。'
      }

      // 追加风格指令
      systemPrompt += '\n\n' + styleConfigMap[style].systemExtra

      // 用户提示词模板
      let userTemplate = ''
      if (style === 'removeAI') {
        const match = promptText.match(
          /## 去AI味专用提示词\s*[\s\S]*?(?=\n\s*---|$)/
        )
        userTemplate = match ? match[0] : ''
      } else {
        const match = promptText.match(
          /## 润色中心 - 润色提示词模板\s*[\s\S]*?(?=\n\s*---|$)/
        )
        userTemplate = match ? match[0] : ''
      }

      if (!userTemplate) {
        // 兜底：直接构建用户提示词
        userTemplate = `请对以下文本进行润色优化。

【润色风格】{style}

【润色原则】
- 保留剧情和人物行为不变
- 只做表达层面的优化

【待润色文本】
{content}`
      }

      const vars: Record<string, string> = {
        level: '深度',
        style: styleConfigMap[style].label,
        content: original.trim(),
      }

      let userPrompt = userTemplate
      for (const [k, v] of Object.entries(vars)) {
        userPrompt = userPrompt.split(`{${k}}`).join(v)
      }

      // 如果去AI味模板中有 {content} 但上面没替换到（因为模板结构不同），兜底替换
      userPrompt = userPrompt.split('{content}').join(original.trim())

      setProgress(15)
      setStatusText('正在请求 AI 润色...')

      const result = await callAIStream(
        selectedModel,
        systemPrompt,
        userPrompt,
        (text) => {
          const p = Math.min(15 + Math.floor((text.length / original.length) * 80), 95)
          setProgress(p)
          setStatusText('AI 正在润色中...')
          setPolished(text)
        }
      )

      setPolished(result)
      setProgress(100)
      setStatusText('润色完成')
      setLoading(false)

      addLog({
        type: 'success',
        message: '文本润色完成',
        detail: `风格：${styleConfigMap[style].label}，原 ${original.length} 字 → 润色后 ${result.length} 字`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误'
      setError(`润色失败：${msg}`)
      setLoading(false)
      addLog({ type: 'error', message: '文本润色失败', detail: msg })
    }
  }, [original, selectedModel, style, adultMode, addLog])

  const handleReplace = useCallback(() => {
    if (!polished.trim()) return
    setOriginal(polished.trim())
    addLog({ type: 'success', message: '已用润色稿替换原稿', detail: '' })
  }, [polished, addLog])

  // ==========================================
  // 渲染
  // ==========================================

  return (
    <PageWrapper
      title="文本润色"
      subtitle="输入文本，选择风格，AI 将为你进行专业的文字打磨与风格转换"
    >
      {/* 配置面板 */}
      <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '8px' }}>AI 模型 <span style={{ color: '#ef4444' }}>*</span></div>
            <select
              value={selectedModelId}
              onChange={(e) => setSelectedModelId(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
            >
              {aiModels.length === 0 && <option value="">未配置模型</option>}
              {aiModels.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          {/* 润色风格选择 */}
          <div>
            <div style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '12px', fontWeight: 500 }}>
              润色风格
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
              {[
                { key: 'formal', title: '正式严谨', desc: '规范用词，提升逻辑性和专业感' },
                { key: 'vivid', title: '生动形象', desc: '增强画面感和感官描写' },
                { key: 'concise', title: '简洁有力', desc: '删繁就简，节奏明快' },
                { key: 'ornate', title: '华丽辞藻', desc: '提升文学性，修辞丰富' },
                { key: 'removeAI', title: '去AI味', desc: '消除AI生成痕迹' },
              ].map((s) => (
                <button
                  key={s.key}
                  onClick={() => setStyle(s.key as any)}
                  style={{
                    padding: '16px',
                    background: style === s.key ? 'rgba(99,102,241,0.12)' : '#0f0f0f',
                    border: style === s.key ? '2px solid #6366f1' : '1px solid #2a2a2a',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    color: style === s.key ? '#818cf8' : '#e0e0e0',
                    marginBottom: '6px',
                  }}>
                    {s.title}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: style === s.key ? 'rgba(129,140,248,0.7)' : '#666',
                    lineHeight: 1.5,
                  }}>
                    {s.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div style={{ background: '#ef444410', border: '1px solid #ef444440', borderRadius: '8px', padding: '12px 16px', fontSize: '14px', color: '#ef4444' }}>{error}</div>
        )}

        <button
          onClick={handlePolish}
          disabled={loading}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: loading ? '#6366f180' : '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px 16px', fontSize: '14px', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? <><span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid #ffffff40', borderTopColor: '#fff', borderRadius: '50%' }} />{statusText}</> : <><span>🔧</span>开始润色</>}
        </button>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ width: '100%', height: '8px', background: '#0f0f0f', borderRadius: '9999px', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#6366f1', borderRadius: '9999px', width: `${progress}%` }} />
            </div>
            <div style={{ fontSize: '12px', color: '#666', textAlign: 'right' }}>{progress}%</div>
          </div>
        )}
      </div>

      {/* 输入 + 对比区域 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {polished && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setViewMode('split')}
              style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px', border: viewMode === 'split' ? '1px solid #6366f1' : '1px solid #333', background: 'transparent', color: viewMode === 'split' ? '#6366f1' : '#888', cursor: 'pointer' }}
            >
              左右对比
            </button>
            <button
              onClick={() => setViewMode('polished')}
              style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px', border: viewMode === 'polished' ? '1px solid #6366f1' : '1px solid #333', background: 'transparent', color: viewMode === 'polished' ? '#6366f1' : '#888', cursor: 'pointer' }}
            >
              仅润色稿
            </button>
            <div style={{ flex: 1 }} />
            {polished && (
              <button onClick={handleReplace} style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px', background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer' }}>
                一键替换原稿
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'split' && polished ? '1fr 1fr' : '1fr', gap: '16px' }}>
          <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '14px', fontWeight: 500, color: '#ccc' }}>原稿</span>
              <span style={{ fontSize: '12px', color: '#666' }}>{original.length} 字</span>
            </div>
            <textarea
              value={original}
              onChange={(e) => { setOriginal(e.target.value); setPolished('') }}
              placeholder="在此粘贴或输入需要润色的文本..."
              style={{ width: '100%', padding: '16px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', minHeight: '360px', resize: 'vertical', fontFamily: 'monospace', lineHeight: 1.6, boxSizing: 'border-box' }}
            />
          </div>

          {(viewMode === 'split' || polished) && (
            <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#ccc' }}>
                  润色稿
                  {polished && <span style={{ marginLeft: '8px', fontSize: '12px', color: '#6366f1' }}>{styleConfigMap[style].label}</span>}
                </span>
                <span style={{ fontSize: '12px', color: '#666' }}>{polished.length} 字</span>
              </div>
              <textarea
                value={polished}
                onChange={(e) => setPolished(e.target.value)}
                placeholder={polished ? '' : '润色结果将显示在这里，支持手动编辑...'}
                style={{ width: '100%', padding: '16px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', minHeight: '360px', resize: 'vertical', fontFamily: 'monospace', lineHeight: 1.6, boxSizing: 'border-box' }}
              />
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  )
}
