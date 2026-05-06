/**
 * 润色区（Polish Studio）增强版
 * SRS v2.3 要求：支持局部选区润色 + 专项风格
 * 
 * 风格：文学化 / 情欲强化 / 病娇风 / 黑暗向
 * 深度：轻度 / 中度 / 重度
 */

import React, { useState, useCallback, useRef } from 'react'
import { useStore } from '../../store'

type PolishStyle = 'literary' | 'erotic' | 'yandere' | 'dark' | 'normal' | 'deai'
type PolishDepth = 'light' | 'medium' | 'deep'

interface PolishStyleConfig {
  id: PolishStyle
  label: string
  icon: string
  color: string
  systemPrompt: string
}

const POLISH_STYLES: PolishStyleConfig[] = [
  {
    id: 'normal',
    label: '普通润色',
    icon: '✨',
    color: '#8b5cf6',
    systemPrompt: '对文本进行通顺度和表达优化，修正语病，提升可读性。',
  },
  {
    id: 'literary',
    label: '文学化',
    icon: '📚',
    color: '#3b82f6',
    systemPrompt: '将文本文学化处理：增加修辞手法（比喻、拟人、通感），提升画面感和意境，语言更加凝练优美。保留原意，但让文字更有质感。',
  },
  {
    id: 'erotic',
    label: '情欲强化',
    icon: '🔥',
    color: '#ec4899',
    systemPrompt: '强化文本中的情欲氛围：增加感官细节描写（触觉、嗅觉、温度、心跳），深化心理活动和欲望张力。保持优雅含蓄，不粗俗。重点描写眼神接触、肢体距离、呼吸变化、皮肤触感等微妙细节。',
  },
  {
    id: 'yandere',
    label: '病娇风',
    icon: '😈',
    color: '#ef4444',
    systemPrompt: '将文本转换为病娇风格：增加偏执、占有欲、极端情感的描写。语言带有甜蜜与危险并存的反差感，角色表现出对目标的极度依恋和排他性。心理描写要细腻，展现从温柔到疯狂的渐变。',
  },
  {
    id: 'dark',
    label: '黑暗向',
    icon: '🌑',
    color: '#1f2937',
    systemPrompt: '将文本转换为黑暗风格：增加压抑、绝望、虚无的氛围。语言更加冷峻锋利，描写残酷现实和人性阴暗面。保持文学性，不沦为猎奇。增加环境对情绪的映射（天气、光线、声音）。',
  },
  {
    id: 'deai',
    label: '去 AI 味',
    icon: '🧹',
    color: '#10b981',
    systemPrompt: '去除文本中的 AI 生成痕迹：消除"首先/其次/最后/总而言之"等模板化连接词，减少重复句式，增加人类写作的不规则性和个性化表达。让文本读起来像真人写的网络小说。',
  },
]

const DEPTH_CONFIG = {
  light: { label: '轻度', percent: 30 },
  medium: { label: '中度', percent: 60 },
  deep: { label: '重度', percent: 100 },
}

export default function PolishPage() {
  const chapters = useStore((s) => s.chapters)
  const currentModel = useStore((s) => s.currentModel)
  const applyPolishResult = useStore((s) => s.applyPolishResult)
  const addLog = useStore((s) => s.addLog)

  const [selectedChapterId, setSelectedChapterId] = useState('')
  const [content, setContent] = useState('')
  const [selectedStyle, setSelectedStyle] = useState<PolishStyle>('normal')
  const [depth, setDepth] = useState<PolishDepth>('medium')
  const [isPolishing, setIsPolishing] = useState(false)
  const [result, setResult] = useState('')
  const [aiScore, setAiScore] = useState(0)
  const [aiWords, setAiWords] = useState<string[]>([])
  const [selection, setSelection] = useState({ start: 0, end: 0, text: '' })
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const selectedChapter = chapters.find((c) => c.id === selectedChapterId)

  // 加载章节
  const handleLoadChapter = (id: string) => {
    setSelectedChapterId(id)
    const ch = chapters.find((c) => c.id === id)
    if (ch) {
      setContent(ch.content || '')
      setResult('')
      setAiScore(0)
      setAiWords([])
    }
  }

  // 检测选区
  const handleTextSelect = () => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    if (start !== end) {
      setSelection({ start, end, text: content.slice(start, end) })
    }
  }

  // AI 味检测
  const detectAiFlavor = useCallback((text: string) => {
    const AI_FLAVOR_WORDS = [
      '首先', '其次', '最后', '总而言之', '综上所述', '不难发现',
      '值得注意的是', '某种程度上', '一定程度上', '众所周知',
      '毫无疑问', '显然', '显然地', '可以想见', '可想而知',
      '不得不说', '平心而论', '客观地说', '从某种意义上说',
    ]
    let found: string[] = []
    AI_FLAVOR_WORDS.forEach((w) => {
      if (text.includes(w)) found.push(w)
    })
    const score = Math.min(100, Math.round((found.length / 5) * 100))
    return { score, words: found }
  }, [])

  // 执行润色
  const handlePolish = useCallback(async () => {
    if (!currentModel) {
      addLog({ type: 'error', message: '请先配置 AI 模型', detail: '' })
      return
    }

    const targetText = selection.text || content
    if (!targetText.trim()) {
      addLog({ type: 'warn', message: '没有可润色的内容', detail: '' })
      return
    }

    setIsPolishing(true)
    setResult('')
    abortRef.current = new AbortController()

    const style = POLISH_STYLES.find((s) => s.id === selectedStyle)!
    const depthConfig = DEPTH_CONFIG[depth]

    // 先检测 AI 味
    const { score, words } = detectAiFlavor(targetText)
    setAiScore(score)
    setAiWords(words)

    try {
      const res = await fetch(`${currentModel.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentModel.apiKey}`,
        },
        body: JSON.stringify({
          model: currentModel.modelId,
          messages: [
            {
              role: 'system',
              content: `${style.systemPrompt}\n\n润色深度：${depthConfig.label}（约修改 ${depthConfig.percent}% 的表达方式）\n\n要求：\n1. 只返回润色后的文本，不要解释\n2. 保持原意和情节不变\n3. 不要添加原文没有的内容`,
            },
            {
              role: 'user',
              content: `请润色以下文本：\n\n${targetText}`,
            },
          ],
          temperature: 0.7,
          max_tokens: Math.min(targetText.length * 2, 8000),
          stream: true,
        }),
        signal: abortRef.current.signal,
      })

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let polished = ''

      while (true) {
        const { done, value } = await reader!.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter((l) => l.trim())
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              const text = parsed.choices?.[0]?.delta?.content || ''
              polished += text
              setResult(polished)
            } catch {}
          }
        }
      }

      // 如果是局部润色，合并回原文
      if (selection.text) {
        const merged = content.slice(0, selection.start) + polished + content.slice(selection.end)
        setResult(merged)
      }

      addLog({
        type: 'success',
        message: `润色完成：${style.label}`,
        detail: `AI 味评分: ${score} | 检测词: ${words.join('、') || '无'}`,
      })
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        addLog({ type: 'error', message: '润色失败', detail: err.message })
      }
    } finally {
      setIsPolishing(false)
    }
  }, [currentModel, content, selection, selectedStyle, depth, detectAiFlavor, addLog])

  // 应用润色结果到章节
  const handleApply = () => {
    if (!selectedChapterId || !result) return
    applyPolishResult(selectedChapterId, {
      original: content,
      polished: result,
      aiScore,
      aiWords,
      level: depth,
      style: selectedStyle === 'literary' ? 'literary' : selectedStyle === 'erotic' ? 'webnovel' : 'custom',
    })
    setContent(result)
    addLog({ type: 'success', message: '润色结果已应用到章节', detail: selectedChapter?.title || '' })
  }

  const handleCancel = () => {
    abortRef.current?.abort()
    setIsPolishing(false)
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto', color: '#e0e0e0' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>✨ 文本润色工作室</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 1fr', gap: 20, height: 'calc(100vh - 160px)' }}>
        {/* 左侧章节列表 */}
        <div style={{ background: '#0a0a0a', borderRadius: 10, border: '1px solid #1a1a1a', overflow: 'auto' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a1a1a' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af' }}>📑 选择章节</h3>
          </div>
          {chapters.sort((a, b) => a.order - b.order).map((ch) => (
            <button
              key={ch.id}
              onClick={() => handleLoadChapter(ch.id)}
              style={{
                width: '100%',
                padding: '8px 16px',
                textAlign: 'left',
                background: selectedChapterId === ch.id ? 'rgba(139,92,246,0.15)' : 'transparent',
                color: selectedChapterId === ch.id ? '#a78bfa' : '#9ca3af',
                border: 'none',
                borderLeft: selectedChapterId === ch.id ? '3px solid #8b5cf6' : '3px solid transparent',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              {ch.title}
            </button>
          ))}
        </div>

        {/* 中间原文编辑器 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#9ca3af' }}>📝 原文 {selection.text ? `(已选 ${selection.text.length} 字)` : ''}</span>
            {aiScore > 0 && (
              <span style={{ fontSize: 12, color: aiScore > 60 ? '#ef4444' : aiScore > 30 ? '#f59e0b' : '#10b981' }}>
                AI 味: {aiScore}/100 {aiWords.length > 0 ? `(${aiWords.length}个)` : ''}
              </span>
            )}
          </div>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onSelect={handleTextSelect}
            placeholder="选择章节或粘贴文本..."
            style={{
              flex: 1,
              padding: 16,
              background: '#0f0f0f',
              border: '1px solid #2a2a2a',
              borderRadius: 8,
              color: '#e0e0e0',
              fontSize: 14,
              lineHeight: 1.7,
              resize: 'none',
              outline: 'none',
            }}
          />
        </div>

        {/* 右侧润色面板 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* 风格选择 */}
          <div style={{ background: '#0a0a0a', borderRadius: 8, border: '1px solid #1a1a1a', padding: 12 }}>
            <h3 style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 10 }}>🎨 润色风格</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {POLISH_STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStyle(s.id)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: selectedStyle === s.id ? `1px solid ${s.color}` : '1px solid #2a2a2a',
                    background: selectedStyle === s.id ? `${s.color}15` : '#0f0f0f',
                    color: selectedStyle === s.id ? s.color : '#9ca3af',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontWeight: selectedStyle === s.id ? 600 : 400,
                  }}
                >
                  <span style={{ marginRight: 4 }}>{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* 深度选择 */}
          <div style={{ background: '#0a0a0a', borderRadius: 8, border: '1px solid #1a1a1a', padding: 12 }}>
            <h3 style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 10 }}>⚡ 润色深度</h3>
            <div style={{ display: 'flex', gap: 6 }}>
              {(Object.keys(DEPTH_CONFIG) as PolishDepth[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDepth(d)}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    borderRadius: 6,
                    border: depth === d ? '1px solid #8b5cf6' : '1px solid #2a2a2a',
                    background: depth === d ? 'rgba(139,92,246,0.15)' : '#0f0f0f',
                    color: depth === d ? '#a78bfa' : '#9ca3af',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {DEPTH_CONFIG[d].label}
                </button>
              ))}
            </div>
          </div>

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={isPolishing ? handleCancel : handlePolish}
              disabled={!content.trim() || !currentModel}
              style={{
                flex: 1,
                padding: '10px 0',
                background: isPolishing ? '#ef4444' : '#8b5cf6',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                opacity: !content.trim() || !currentModel ? 0.5 : 1,
              }}
            >
              {isPolishing ? '⏹ 停止' : selection.text ? '✨ 润色选区' : '✨ 全文润色'}
            </button>
          </div>

          {selection.text && (
            <div style={{ padding: 8, background: 'rgba(139,92,246,0.08)', borderRadius: 6, fontSize: 11, color: '#a78bfa' }}>
              💡 已选中 {selection.text.length} 字，将只润色选区
            </div>
          )}

          {/* 润色结果 */}
          {result && (
            <>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 13, color: '#9ca3af' }}>✨ 润色结果</span>
                <textarea
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  style={{
                    flex: 1,
                    padding: 16,
                    background: '#0f0f0f',
                    border: '1px solid #2a2a2a',
                    borderRadius: 8,
                    color: '#e0e0e0',
                    fontSize: 14,
                    lineHeight: 1.7,
                    resize: 'none',
                    outline: 'none',
                  }}
                />
              </div>
              <button
                onClick={handleApply}
                style={{
                  padding: '10px 0',
                  background: '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ✅ 应用到章节
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
