/**
 * 剧情可视化 / 编辑中心
 * SRS v2.3 统一整合版修复
 *
 * Tab 结构（9大模块对应）：
 * 1. 故事梗概
 * 2. 角色档案（NSFW卡）
 * 3. 世界观
 * 4. 感情线（React Flow 双轨）
 * 5. 肉欲线（强度曲线）
 * 6. 剧情大纲
 * 7. 章节目录
 * 8. 关系图谱（React Flow）
 * 9. 标签管理
 */

import React, { useState, useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
} from '@xyflow/react'
import type { Node, Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useStore } from '../../store'
import type { EmotionArcNode, EmotionArcEdge, LustIntensityPoint, LustClimaxPoint } from '../../types/types'

// ==================== Tab 定义 ====================
type PlotTab =
  | 'overview'
  | 'characters'
  | 'world'
  | 'emotion'
  | 'lust'
  | 'outline'
  | 'chapters'
  | 'relations'
  | 'tags'

const TABS: { key: PlotTab; label: string; icon: string }[] = [
  { key: 'overview', label: '故事梗概', icon: '📖' },
  { key: 'characters', label: '角色档案', icon: '👤' },
  { key: 'world', label: '世界观', icon: '🌍' },
  { key: 'emotion', label: '感情线', icon: '💕' },
  { key: 'lust', label: '肉欲线', icon: '🔥' },
  { key: 'outline', label: '剧情大纲', icon: '📋' },
  { key: 'chapters', label: '章节目录', icon: '📑' },
  { key: 'relations', label: '关系图谱', icon: '🕸️' },
  { key: 'tags', label: '标签管理', icon: '🏷️' },
]

// ==================== 颜色配置 ====================
const ROLE_COLORS: Record<string, string> = {
  protagonist: '#8b5cf6', // 紫
  supporting: '#ec4899', // 粉
  antagonist: '#ef4444', // 红
  minor: '#6b7280', // 灰
}

const EMOTION_COLORS: Record<string, string> = {
  emotion: '#ec4899',
  conflict: '#f59e0b',
  climax: '#ef4444',
  adult: '#a855f7',
}

// ==================== 主组件 ====================
export default function PlotView() {
  const [activeTab, setActiveTab] = useState<PlotTab>('overview')

  // 从 Store 读取所有相关数据
  const currentNovel = useStore((s) => s.currentNovel)
  const characters = useStore((s) => s.characters)
  const worldSettings = useStore((s) => s.worldSettings)
  const chapters = useStore((s) => s.chapters)
  const plotLines = useStore((s) => s.plotLines)
  const tags = useStore((s) => s.tags)
  const emotionArc = useStore((s) => s.emotionArc)
  const lustArc = useStore((s) => s.lustArc)
  const outlineNodes = useStore((s) => s.outlineNodes)
  const updateNovel = useStore((s) => s.updateNovel)
  const updateCharacter = useStore((s) => s.updateCharacter)
  const updateWorldSetting = useStore((s) => s.updateWorldSetting)
  const updateOutlineNodes = useStore((s) => s.updateOutlineNodes)
  const updateEmotionArc = useStore((s) => s.updateEmotionArc)
  const updateLustArc = useStore((s) => s.updateLustArc)

  // 本地编辑状态
  const [editTitle, setEditTitle] = useState(currentNovel?.title || '')
  const [editSummary, setEditSummary] = useState(currentNovel?.summary || '')

  // ==================== 感情线 React Flow ====================
  const emotionFlowNodes = useMemo<Node[]>(() => {
    if (!emotionArc) return []
    return emotionArc.nodes.map((n: EmotionArcNode) => ({
      id: n.id,
      type: 'default',
      position: n.position,
      data: { label: n.data.label },
      style: {
        background: n.data.color,
        color: '#fff',
        border: '2px solid #fff',
        borderRadius: '8px',
        padding: '10px 14px',
        fontSize: '12px',
        fontWeight: 600,
        width: 140,
      },
    }))
  }, [emotionArc])

  const emotionFlowEdges = useMemo<Edge[]>(() => {
    if (!emotionArc) return []
    return emotionArc.edges.map((e: EmotionArcEdge) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type,
      label: e.label,
      animated: e.animated,
      style: e.style,
    }))
  }, [emotionArc])

  const [efNodes, setEfNodes, onEfNodesChange] = useNodesState(emotionFlowNodes)
  const [efEdges, setEfEdges, onEfEdgesChange] = useEdgesState(emotionFlowEdges)

  React.useEffect(() => {
    setEfNodes(emotionFlowNodes)
    setEfEdges(emotionFlowEdges)
  }, [emotionFlowNodes, emotionFlowEdges, setEfNodes, setEfEdges])

  // ==================== 关系图谱 React Flow ====================
  const relationNodes = useMemo<Node[]>(() => {
    return characters.map((char, idx) => ({
      id: char.id,
      type: 'default',
      position: { x: 100 + (idx % 4) * 200, y: 100 + Math.floor(idx / 4) * 150 },
      data: { label: char.name },
      style: {
        background: ROLE_COLORS[char.roleType] || '#6b7280',
        color: '#fff',
        border: '2px solid #fff',
        borderRadius: '50%',
        width: 80,
        height: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: 600,
      },
    }))
  }, [characters])

  const relationEdges = useMemo<Edge[]>(() => {
    const edges: Edge[] = []
    characters.forEach((char) => {
      char.relationships.forEach((rel) => {
        // 避免重复边
        const edgeId = `e-${char.id}-${rel.targetId}`
        const reverseId = `e-${rel.targetId}-${char.id}`
        if (edges.some((e) => e.id === reverseId)) return
        edges.push({
          id: edgeId,
          source: char.id,
          target: rel.targetId,
          label: rel.type,
          animated: rel.type === '恋人' || rel.type === '对立',
          style: {
            stroke: rel.type === '对立' ? '#ef4444' : rel.type === '恋人' ? '#ec4899' : '#9ca3af',
            strokeWidth: 2,
          },
        })
      })
    })
    return edges
  }, [characters])

  const [relNodes, setRelNodes, onRelNodesChange] = useNodesState(relationNodes)
  const [relEdges, setRelEdges, onRelEdgesChange] = useEdgesState(relationEdges)

  React.useEffect(() => {
    setRelNodes(relationNodes)
    setRelEdges(relationEdges)
  }, [relationNodes, relationEdges, setRelNodes, setRelEdges])

  // ==================== 保存梗概 ====================
  const handleSaveOverview = useCallback(() => {
    updateNovel({ title: editTitle, summary: editSummary })
  }, [editTitle, editSummary, updateNovel])

  // ==================== 渲染各 Tab ====================
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div style={{ padding: '20px', maxWidth: 800 }}>
            <h3 style={{ color: '#e0e0e0', marginBottom: 16 }}>📖 故事梗概</h3>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="输入小说标题..."
              style={inputStyle}
            />
            <textarea
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
              placeholder="输入故事简介..."
              rows={8}
              style={{ ...inputStyle, marginTop: 12, resize: 'vertical' }}
            />
            <button onClick={handleSaveOverview} style={btnPrimaryStyle}>
              保存梗概
            </button>
          </div>
        )

      case 'characters':
        return (
          <div style={{ padding: '20px' }}>
            <h3 style={{ color: '#e0e0e0', marginBottom: 16 }}>👤 角色档案</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {characters.map((char) => (
                <div key={char.id} style={cardStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: '50%',
                      background: ROLE_COLORS[char.roleType] || '#6b7280',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 700, fontSize: 16,
                    }}>
                      {char.name.slice(0, 1)}
                    </div>
                    <div>
                      <div style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 15 }}>{char.name}</div>
                      <div style={{ color: '#9ca3af', fontSize: 12 }}>
                        {char.basicInfo.gender} · {char.basicInfo.age} · {char.roleType === 'protagonist' ? '主角' : char.roleType === 'antagonist' ? '反派' : '配角'}
                      </div>
                    </div>
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: 13, lineHeight: 1.6 }}>
                    <p><strong style={{ color: '#d1d5db' }}>外貌：</strong>{char.appearance || '未填写'}</p>
                    <p><strong style={{ color: '#d1d5db' }}>性格：</strong>{char.personality.join('、') || '未填写'}</p>
                    <p><strong style={{ color: '#d1d5db' }}>背景：</strong>{char.background || '未填写'}</p>
                  </div>
                  {/* SRS v2.3: NSFW 卡展示 */}
                  {currentNovel?.adultMode && char.nsfwProfile && (
                    <div style={{ marginTop: 12, padding: 10, background: 'rgba(168,85,247,0.1)', borderRadius: 6, border: '1px solid rgba(168,85,247,0.3)' }}>
                      <div style={{ color: '#a855f7', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>🔞 NSFW 档案</div>
                      <div style={{ color: '#c4b5fd', fontSize: 12, lineHeight: 1.6 }}>
                        <p>体型：{char.nsfwProfile.bodyType || '未填写'}</p>
                        <p>敏感带：{char.nsfwProfile.sensitiveZones.join('、') || '未填写'}</p>
                        <p>性特质：{char.nsfwProfile.sexualTraits.join('、') || '未填写'}</p>
                        <p>经验：{char.nsfwProfile.experienceLevel || '未填写'}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {characters.length === 0 && (
                <div style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>暂无角色数据，请先进行一键推导</div>
              )}
            </div>
          </div>
        )

      case 'world':
        return (
          <div style={{ padding: '20px' }}>
            <h3 style={{ color: '#e0e0e0', marginBottom: 16 }}>🌍 世界观</h3>
            {worldSettings.map((ws) => (
              <div key={ws.id} style={cardStyle}>
                <h4 style={{ color: '#e0e0e0', marginBottom: 8 }}>{ws.name}</h4>
                <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 12 }}>{ws.overview}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <h5 style={{ color: '#d1d5db', fontSize: 13, marginBottom: 6 }}>⚖️ 规则</h5>
                    {ws.rules.map((r, i) => (
                      <div key={i} style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>• {r.name}: {r.description}</div>
                    ))}
                  </div>
                  <div>
                    <h5 style={{ color: '#d1d5db', fontSize: 13, marginBottom: 6 }}>📍 地点</h5>
                    {ws.locations.map((l, i) => (
                      <div key={i} style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>• {l.name}: {l.description}</div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {worldSettings.length === 0 && (
              <div style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>暂无世界观数据</div>
            )}
          </div>
        )

      case 'emotion':
        return (
          <div style={{ padding: '20px', height: 'calc(100vh - 180px)' }}>
            <h3 style={{ color: '#e0e0e0', marginBottom: 12 }}>💕 感情线（React Flow）</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {(['emotion', 'conflict', 'climax', 'adult'] as const).map((t) => (
                <span key={t} style={{
                  padding: '4px 10px', borderRadius: 4, fontSize: 12, color: '#fff',
                  background: EMOTION_COLORS[t],
                }}>
                  {t === 'emotion' ? '感情' : t === 'conflict' ? '冲突' : t === 'climax' ? '高潮' : '肉欲'}
                </span>
              ))}
            </div>
            {emotionArc ? (
              <div style={{ width: '100%', height: '80%', background: '#0f0f0f', borderRadius: 8, border: '1px solid #2a2a2a' }}>
                <ReactFlow
                  nodes={efNodes}
                  edges={efEdges}
                  onNodesChange={onEfNodesChange}
                  onEdgesChange={onEfEdgesChange}
                  fitView
                >
                  <Background color="#333" gap={16} />
                  <Controls />
                  <MiniMap nodeColor={(n) => (n.style?.background as string) || '#666'} />
                </ReactFlow>
              </div>
            ) : (
              <div style={{ color: '#6b7280', textAlign: 'center', padding: 60 }}>暂无感情线数据</div>
            )}
            {/* 时间轴列表（双轨展示） */}
            {emotionArc && (
              <div style={{ marginTop: 16 }}>
                <h4 style={{ color: '#d1d5db', fontSize: 14, marginBottom: 8 }}>时间轴事件</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {emotionArc.timeline.map((ev) => (
                    <div key={ev.id} style={{
                      padding: '10px 14px', borderRadius: 6,
                      background: 'rgba(255,255,255,0.03)',
                      borderLeft: `3px solid ${EMOTION_COLORS[ev.type]}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 13 }}>{ev.title}</span>
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: 11, color: '#fff',
                          background: EMOTION_COLORS[ev.type],
                        }}>
                          {ev.type === 'emotion' ? '感情' : ev.type === 'conflict' ? '冲突' : ev.type === 'climax' ? '高潮' : '肉欲'}
                        </span>
                      </div>
                      <p style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>{ev.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )

      case 'lust':
        return (
          <div style={{ padding: '20px' }}>
            <h3 style={{ color: '#e0e0e0', marginBottom: 16 }}>🔥 肉欲线（强度曲线）</h3>
            {lustArc && lustArc.intensityCurve.length > 0 ? (
              <>
                {/* 强度曲线可视化 */}
                <div style={{ marginBottom: 24, padding: 16, background: '#0f0f0f', borderRadius: 8, border: '1px solid #2a2a2a' }}>
                  <h4 style={{ color: '#d1d5db', fontSize: 14, marginBottom: 12 }}>📈 章节强度分布</h4>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 200, paddingBottom: 30, position: 'relative' }}>
                    {lustArc.intensityCurve.map((pt: LustIntensityPoint, idx: number) => (
                      <div key={pt.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                        <div style={{
                          width: '100%',
                          height: `${pt.value * 1.8}px`,
                          background: pt.value > 75 ? '#ef4444' : pt.value > 50 ? '#f59e0b' : '#a855f7',
                          borderRadius: '4px 4px 0 0',
                          opacity: 0.8,
                          transition: 'all 0.3s',
                        }} />
                        <span style={{
                          position: 'absolute', bottom: -24, left: '50%', transform: 'translateX(-50%) rotate(-45deg)',
                          color: '#6b7280', fontSize: 10, whiteSpace: 'nowrap',
                        }}>
                          {pt.chapterTitle.slice(0, 6)}
                        </span>
                        <span style={{
                          position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)',
                          color: '#d1d5db', fontSize: 10, fontWeight: 600,
                        }}>
                          {pt.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 高潮点列表 */}
                <div style={{ padding: 16, background: '#0f0f0f', borderRadius: 8, border: '1px solid #2a2a2a' }}>
                  <h4 style={{ color: '#d1d5db', fontSize: 14, marginBottom: 12 }}>🌟 高潮点</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {lustArc.climaxPoints.map((cp: LustClimaxPoint) => (
                      <div key={cp.id} style={{
                        padding: '10px 14px', borderRadius: 6,
                        background: 'rgba(239,68,68,0.08)',
                        borderLeft: '3px solid #ef4444',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 13 }}>{cp.chapterTitle}</span>
                          <span style={{ color: '#ef4444', fontSize: 12, fontWeight: 600 }}>强度 {cp.intensity}</span>
                        </div>
                        <p style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>{cp.description}</p>
                        <span style={{
                          display: 'inline-block', marginTop: 6, padding: '2px 8px', borderRadius: 4,
                          fontSize: 11, color: '#fca5a5', background: 'rgba(239,68,68,0.15)',
                        }}>
                          {cp.type === 'tease' ? '挑逗' : cp.type === 'buildup' ? '累积' : cp.type === 'climax' ? '高潮' : '余韵'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ color: '#6b7280', textAlign: 'center', padding: 60 }}>
                {currentNovel?.adultMode
                  ? '暂无肉欲线数据，请检查推导结果是否包含成人内容'
                  : '当前未开启成人模式，肉欲线仅在 adultMode 下生成'}
              </div>
            )}
          </div>
        )

      case 'outline':
        return (
          <div style={{ padding: '20px' }}>
            <h3 style={{ color: '#e0e0e0', marginBottom: 16 }}>📋 剧情大纲</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {outlineNodes.map((node, idx) => (
                <div key={node.id} style={{
                  padding: '12px 16px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid #2a2a2a',
                }}>
                  <div style={{ color: '#a855f7', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    节点 {idx + 1}
                  </div>
                  <input
                    value={node.title}
                    onChange={(e) => {
                      const updated = [...outlineNodes]
                      updated[idx] = { ...node, title: e.target.value }
                      updateOutlineNodes(updated)
                    }}
                    style={{ ...inputStyle, marginBottom: 6, fontSize: 14, fontWeight: 600 }}
                  />
                  <textarea
                    value={node.content}
                    onChange={(e) => {
                      const updated = [...outlineNodes]
                      updated[idx] = { ...node, content: e.target.value }
                      updateOutlineNodes(updated)
                    }}
                    rows={2}
                    style={{ ...inputStyle, fontSize: 13 }}
                  />
                </div>
              ))}
              {outlineNodes.length === 0 && (
                <div style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>暂无大纲数据</div>
              )}
            </div>
          </div>
        )

      case 'chapters':
        return (
          <div style={{ padding: '20px' }}>
            <h3 style={{ color: '#e0e0e0', marginBottom: 16 }}>📑 章节目录</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {chapters.sort((a, b) => a.order - b.order).map((ch) => (
                <div key={ch.id} style={{
                  padding: '10px 14px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid #2a2a2a',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <span style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 14 }}>{ch.title}</span>
                    <span style={{ color: '#6b7280', fontSize: 12, marginLeft: 8 }}>
                      {ch.status === 'draft' ? '📝 草稿' : ch.status === 'completed' ? '✅ 完成' : '✨ 已润色'}
                    </span>
                  </div>
                  <span style={{ color: '#6b7280', fontSize: 12 }}>{ch.wordCount} 字</span>
                </div>
              ))}
              {chapters.length === 0 && (
                <div style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>暂无章节数据</div>
              )}
            </div>
          </div>
        )

      case 'relations':
        return (
          <div style={{ padding: '20px', height: 'calc(100vh - 180px)' }}>
            <h3 style={{ color: '#e0e0e0', marginBottom: 12 }}>🕸️ 关系图谱</h3>
            {characters.length > 0 ? (
              <div style={{ width: '100%', height: '90%', background: '#0f0f0f', borderRadius: 8, border: '1px solid #2a2a2a' }}>
                <ReactFlow
                  nodes={relNodes}
                  edges={relEdges}
                  onNodesChange={onRelNodesChange}
                  onEdgesChange={onRelEdgesChange}
                  fitView
                >
                  <Background color="#333" gap={16} />
                  <Controls />
                  <MiniMap nodeColor={(n) => (n.style?.background as string) || '#666'} />
                </ReactFlow>
              </div>
            ) : (
              <div style={{ color: '#6b7280', textAlign: 'center', padding: 60 }}>暂无角色关系数据</div>
            )}
          </div>
        )

      case 'tags':
        return (
          <div style={{ padding: '20px' }}>
            <h3 style={{ color: '#e0e0e0', marginBottom: 16 }}>🏷️ 标签管理</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {tags.map((tag) => (
                <span key={tag.id} style={{
                  padding: '6px 12px', borderRadius: 16, fontSize: 13,
                  background: tag.color + '20',
                  color: tag.color,
                  border: `1px solid ${tag.color}40`,
                }}>
                  {tag.name}
                </span>
              ))}
              {tags.length === 0 && (
                <div style={{ color: '#6b7280', textAlign: 'center', padding: 40, width: '100%' }}>暂无标签</div>
              )}
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#050505', color: '#e0e0e0' }}>
      {/* 左侧 Tab 栏 */}
      <div style={{
        width: 180, flexShrink: 0,
        background: '#0a0a0a', borderRight: '1px solid #1a1a1a',
        display: 'flex', flexDirection: 'column', padding: '12px 8px',
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, padding: '0 8px 12px', color: '#e0e0e0' }}>
          📘 剧情观
        </h2>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              ...tabBtnStyle,
              background: activeTab === tab.key ? 'rgba(139,92,246,0.15)' : 'transparent',
              color: activeTab === tab.key ? '#a78bfa' : '#9ca3af',
              borderLeft: activeTab === tab.key ? '3px solid #8b5cf6' : '3px solid transparent',
            }}
          >
            <span style={{ width: 20, textAlign: 'center' }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 右侧内容区 */}
      <div style={{ flex: 1, overflow: 'auto', background: '#050505' }}>
        <ReactFlowProvider>
          {renderTabContent()}
        </ReactFlowProvider>
      </div>
    </div>
  )
}

// ==================== 样式常量 ====================
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: '#0f0f0f',
  border: '1px solid #2a2a2a',
  borderRadius: '8px',
  color: '#e0e0e0',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
}

const btnPrimaryStyle: React.CSSProperties = {
  marginTop: 12,
  padding: '8px 16px',
  background: '#8b5cf6',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
}

const cardStyle: React.CSSProperties = {
  padding: '16px',
  background: '#0f0f0f',
  border: '1px solid #1a1a1a',
  borderRadius: '10px',
}

const tabBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 10px',
  marginBottom: 4,
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  border: 'none',
  textAlign: 'left',
  transition: 'all 0.2s',
}
