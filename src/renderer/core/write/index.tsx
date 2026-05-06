/**
 * 写作区（Writing Studio）
 * SRS v2.3 新增核心工作区
 * 
 * 布局：左右分屏
 * 左：章节编辑器（富文本/Markdown）
 * 右：上下文提示面板（角色/感情线/肉欲线/标签）
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useStore } from '../../store'

interface ContextPanelData {
  characters: Array<{ id: string; name: string; roleType: string; personality: string[]; nsfwProfile?: any }>
  emotionNode: { title: string; description: string; type: string; intensity: number } | null
  lustPoint: { chapterTitle: string; value: number; sceneType: string } | null
  tags: string[]
}

export default function WritePage() {
  const chapters = useStore((s) => s.chapters)
  const characters = useStore((s) => s.characters)
  const emotionArc = useStore((s) => s.emotionArc)
  const lustArc = useStore((s) => s.lustArc)
  const tags = useStore((s) => s.tags)
  const updateChapter = useStore((s) => s.updateChapter)
  const currentNovel = useStore((s) => s.currentNovel)
  const currentModel = useStore((s) => s.currentModel)
  const addLog = useStore((s) => s.addLog)

  const [selectedChapterId, setSelectedChapterId] = useState<string>('')
  const [content, setContent] = useState('')
  const [isAiWriting, setIsAiWriting] = useState(false)
  const [aiDirection, setAiDirection] = useState('natural')
  const [targetWords, setTargetWords] = useState(2000)
  const abortRef = useRef<AbortController | null>(null)

  const selectedChapter = chapters.find((c) => c.id === selectedChapterId)

  // 加载选中章节内容
  useEffect(() => {
    if (selectedChapter) {
      setContent(selectedChapter.content || '')
    }
  }, [selectedChapterId])

  // 自动保存
  useEffect(() => {
    if (!selectedChapterId || !selectedChapter) return
    const timer = setTimeout(() => {
      if (content !== selectedChapter.content) {
        updateChapter(selectedChapterId, { content, wordCount: content.length })
      }
    }, 2000)
    return () => clearTimeout(timer)
  }, [content, selectedChapterId])

  // 计算当前章节的上下文数据
  const contextData: ContextPanelData = useMemo(() => {
    if (!selectedChapter) return { characters: [], emotionNode: null, lustPoint: null, tags: [] }

    const order = selectedChapter.order
    const emotionNode = emotionArc?.timeline.find((t) => t.order === order) || null
    const lustPoint = lustArc?.intensityCurve.find((p) => p.order === order) || null
    const chapterChars = characters.filter((c) => selectedChapter.characters.includes(c.id))
    const chapterTags = tags.filter((t) => selectedChapter.tags.includes(t.id)).map((t) => t.name)

    return {
      characters: chapterChars.map((c) => ({
        id: c.id,
        name: c.name,
        roleType: c.roleType,
        personality: c.personality,
        nsfwProfile: c.nsfwProfile,
      })),
      emotionNode: emotionNode
        ? {
            title: emotionNode.title,
            description: emotionNode.description,
            type: emotionNode.type,
            intensity: emotionNode.intensity,
          }
        : null,
      lustPoint: lustPoint
        ? {
            chapterTitle: lustPoint.chapterTitle,
            value: lustPoint.value,
            sceneType: lustPoint.sceneType,
          }
        : null,
      tags: chapterTags,
    }
  }, [selectedChapter, characters, emotionArc, lustArc, tags])

  // AI 续写
  const handleAiContinue = useCallback(async () => {
    if (!currentModel || !selectedChapter) return
    setIsAiWriting(true)
    abortRef.current = new AbortController()

    const ctx = buildWritingContext(selectedChapter, contextData, content, aiDirection)

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
            { role: 'system', content: ctx.system },
            { role: 'user', content: ctx.user },
          ],
          temperature: 0.8,
          max_tokens: Math.min(targetWords * 2, 8000),
          stream: true,
        }),
        signal: abortRef.current.signal,
      })

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let newText = ''

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
              newText += text
              setContent((prev) => prev + text)
            } catch {}
          }
        }
      }

      addLog({
        type: 'success',
        message: `AI 续写完成：${selectedChapter.title}`,
        detail: `生成 ${newText.length} 字`,
      })
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        addLog({ type: 'error', message: 'AI 续写失败', detail: err.message })
      }
    } finally {
      setIsAiWriting(false)
    }
  }, [currentModel, selectedChapter, content, aiDirection, targetWords, contextData, addLog])

  const handleCancelAi = () => {
    abortRef.current?.abort()
    setIsAiWriting(false)
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', background: '#050505' }}>
      {/* 左侧章节列表 */}
      <div style={{ width: 220, flexShrink: 0, background: '#0a0a0a', borderRight: '1px solid #1a1a1a', overflow: 'auto' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a1a1a' }}>
          <h3 style={{ color: '#e0e0e0', fontSize: 14, fontWeight: 700 }}>📑 章节</h3>
        </div>
        {chapters
          .sort((a, b) => a.order - b.order)
          .map((ch) => (
            <button
              key={ch.id}
              onClick={() => setSelectedChapterId(ch.id)}
              style={{
                width: '100%',
                padding: '10px 16px',
                textAlign: 'left',
                background: selectedChapterId === ch.id ? 'rgba(139,92,246,0.15)' : 'transparent',
                color: selectedChapterId === ch.id ? '#a78bfa' : '#9ca3af',
                border: 'none',
                borderLeft: selectedChapterId === ch.id ? '3px solid #8b5cf6' : '3px solid transparent',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              <div style={{ fontWeight: 600 }}>{ch.title}</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>
                {ch.status === 'draft' ? '📝' : ch.status === 'completed' ? '✅' : '✨'} {ch.wordCount}字
              </div>
            </button>
          ))}
      </div>

      {/* 中间编辑器 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* 工具栏 */}
        <div style={{
          padding: '10px 16px',
          background: '#0a0a0a',
          borderBottom: '1px solid #1a1a1a',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
        }}>
          <select
            value={aiDirection}
            onChange={(e) => setAiDirection(e.target.value)}
            style={{ ...inputStyle, width: 140, fontSize: 12 }}
          >
            <option value="natural">自然推进</option>
            <option value="climax">高潮爆发</option>
            <option value="warm">温情过渡</option>
            <option value="suspense">悬念铺设</option>
            <option value="twist">反转突变</option>
            <option value="reveal">揭秘真相</option>
          </select>
          <select
            value={targetWords}
            onChange={(e) => setTargetWords(Number(e.target.value))}
            style={{ ...inputStyle, width: 120, fontSize: 12 }}
          >
            <option value={1000}>1000字</option>
            <option value={2000}>2000字</option>
            <option value={3000}>3000字</option>
            <option value={5000}>5000字</option>
          </select>
          <button
            onClick={isAiWriting ? handleCancelAi : handleAiContinue}
            disabled={!selectedChapterId || !currentModel}
            style={{
              ...btnPrimaryStyle,
              opacity: !selectedChapterId || !currentModel ? 0.5 : 1,
              fontSize: 12,
              padding: '6px 14px',
            }}
          >
            {isAiWriting ? '⏹ 停止' : '✨ AI 续写'}
          </button>
          <span style={{ color: '#6b7280', fontSize: 12, marginLeft: 'auto' }}>
            {content.length} 字
          </span>
        </div>

        {/* 编辑器 */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={selectedChapterId ? '开始写作...' : '请先在左侧选择章节'}
          disabled={!selectedChapterId}
          style={{
            flex: 1,
            padding: 20,
            background: '#050505',
            color: '#e0e0e0',
            fontSize: 15,
            lineHeight: 1.8,
            border: 'none',
            outline: 'none',
            resize: 'none',
            fontFamily: '"Noto Serif SC", "Source Han Serif SC", serif',
          }}
        />
      </div>

      {/* 右侧上下文提示面板 */}
      <div style={{ width: 280, flexShrink: 0, background: '#0a0a0a', borderLeft: '1px solid #1a1a1a', overflow: 'auto' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a1a1a' }}>
          <h3 style={{ color: '#e0e0e0', fontSize: 14, fontWeight: 700 }}>💡 上下文提示</h3>
        </div>

        {!selectedChapterId ? (
          <div style={{ padding: 20, color: '#6b7280', fontSize: 13, textAlign: 'center' }}>
            选择章节后显示上下文
          </div>
        ) : (
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 角色提示 */}
            <div>
              <h4 style={{ color: '#8b5cf6', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>👤 本章角色</h4>
              {contextData.characters.length > 0 ? (
                contextData.characters.map((char) => (
                  <div key={char.id} style={{ padding: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 6, marginBottom: 6 }}>
                    <div style={{ color: '#e0e0e0', fontSize: 13, fontWeight: 600 }}>{char.name}</div>
                    <div style={{ color: '#9ca3af', fontSize: 11 }}>{char.personality.slice(0, 3).join('、')}</div>
                    {currentNovel?.adultMode && char.nsfwProfile && (
                      <div style={{ color: '#a855f7', fontSize: 10, marginTop: 4 }}>
                        🔞 {char.nsfwProfile.sexualTraits?.slice(0, 2).join('、')}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div style={{ color: '#6b7280', fontSize: 12 }}>无角色数据</div>
              )}
            </div>

            {/* 感情线节点提示 */}
            {contextData.emotionNode && (
              <div>
                <h4 style={{ color: '#ec4899', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>💕 感情节点</h4>
                <div style={{
                  padding: 10,
                  background: 'rgba(236,72,153,0.08)',
                  borderRadius: 6,
                  borderLeft: '2px solid #ec4899',
                }}>
                  <div style={{ color: '#e0e0e0', fontSize: 13, fontWeight: 600 }}>{contextData.emotionNode.title}</div>
                  <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 4 }}>{contextData.emotionNode.description}</div>
                  <div style={{ color: '#ec4899', fontSize: 11, marginTop: 4 }}>
                    类型: {contextData.emotionNode.type} | 强度: {contextData.emotionNode.intensity}
                  </div>
                </div>
              </div>
            )}

            {/* 肉欲线提示 */}
            {contextData.lustPoint && currentNovel?.adultMode && (
              <div>
                <h4 style={{ color: '#a855f7', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>🔥 肉欲强度</h4>
                <div style={{
                  padding: 10,
                  background: 'rgba(168,85,247,0.08)',
                  borderRadius: 6,
                  borderLeft: '2px solid #a855f7',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{
                      height: 6, flex: 1, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${contextData.lustPoint.value}%`,
                        height: '100%',
                        background: contextData.lustPoint.value > 75 ? '#ef4444' : '#a855f7',
                        borderRadius: 3,
                      }} />
                    </div>
                    <span style={{ color: '#a855f7', fontSize: 12, fontWeight: 600 }}>{contextData.lustPoint.value}</span>
                  </div>
                  <div style={{ color: '#c4b5fd', fontSize: 11 }}>
                    场景类型: {contextData.lustPoint.sceneType}
                  </div>
                </div>
              </div>
            )}

            {/* 标签提示 */}
            {contextData.tags.length > 0 && (
              <div>
                <h4 style={{ color: '#f59e0b', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>🏷️ 标签</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {contextData.tags.map((tag, i) => (
                    <span key={i} style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 11,
                      background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== 构建写作上下文 Prompt ====================
function buildWritingContext(
  chapter: any,
  ctx: ContextPanelData,
  currentContent: string,
  direction: string,
) {
  const dirMap: Record<string, string> = {
    natural: '自然延续当前情节节奏',
    climax: '向高潮推进，增加冲突和张力',
    warm: '温情过渡，增加情感交流和内心描写',
    suspense: '铺设悬念，增加神秘感和伏笔',
    twist: '情节反转，打破读者预期',
    reveal: '揭示真相，解开前期伏笔',
  }

  const charContext = ctx.characters
    .map((c) => `- ${c.name}：${c.personality.join('、')}`)
    .join('\n')

  const emotionContext = ctx.emotionNode
    ? `【感情线节点】${ctx.emotionNode.title}（${ctx.emotionNode.type}，强度${ctx.emotionNode.intensity}）：${ctx.emotionNode.description}`
    : ''

  const lustContext = ctx.lustPoint
    ? `【肉欲线强度】${ctx.lustPoint.sceneType}（强度${ctx.lustPoint.value}）`
    : ''

  const system = `你是一位专业小说续写助手。请根据提供的角色信息、感情线/肉欲线节点提示，以及当前章节内容，进行高质量的续写。
要求：
1. 保持角色性格一致性
2. ${dirMap[direction]}
3. 语言风格与原文统一
4. 适当呼应上下文提示中的感情/肉欲节点
5. 不要重复已有内容，从断点处继续`

  const user = `【当前章节】${chapter.title}
【已有内容】
${currentContent.slice(-1000)}

【角色信息】
${charContext}

${emotionContext}
${lustContext}

请续写后续内容：`}

  return { system, user }
}

const inputStyle: React.CSSProperties = {
  padding: '6px 10px',
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
