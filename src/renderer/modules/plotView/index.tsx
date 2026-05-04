import { useState, useCallback, useEffect } from 'react'
import PageWrapper from '../../components/PageWrapper'
import { useStore } from '../../store'
import { ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState } from '@xyflow/react'
import '@xyflow/react/dist/style.css'

const tabs = [
  { key: 'summary', label: '故事梗概' },
  { key: 'characters', label: '角色档案' },
  { key: 'world', label: '世界观' },
  { key: 'emotion', label: '感情线' },
  { key: 'outline', label: '剧情大纲' },
  { key: 'chapters', label: '章节目录' },
  { key: 'graph', label: '关系图谱' },
]

export default function PlotView() {
  const [activeTab, setActiveTab] = useState('summary')
  const novel = useStore((s) => s.currentNovel)
  const characters = useStore((s) => s.characters)
  const chapters = useStore((s) => s.chapters)
  const worlds = useStore((s) => s.worldSettings)
  const updateNovel = useStore((s) => s.updateNovel)
  const updateEmotionEvents = useStore((s) => s.updateEmotionEvents)
  const updateOutlineNodes = useStore((s) => s.updateOutlineNodes)
  const adultMode = useStore((s) => s.adultMode)

  // 从根状态读取，不依赖 novel 嵌套字段
  const storeEmotionEvents = useStore((s) => s.emotionEvents || [])
  const storeOutlineNodes = useStore((s) => s.outlineNodes || [])

  const [editTitle, setEditTitle] = useState(novel?.title || '')
  const [editSummary, setEditSummary] = useState(novel?.summary || '')

  // ========== 剧情大纲状态 ==========
  const [outlineNodes, setOutlineNodes] = useState<Array<{ id: string; title: string; content: string; order: number }>>(
    storeOutlineNodes || []
  )

  // ========== 感情线状态 ==========
  const [emotionEvents, setEmotionEvents] = useState<Array<{
    id: string
    title: string
    description: string
    type: 'emotion' | 'adult' | 'conflict' | 'climax'
    characterIds: string[]
    order: number
  }>>(storeEmotionEvents || [])

  // 只在 novel 对象变化时（推导完成/切换项目）同步一次数据
  const novelId = novel?.id
  useEffect(() => {
    setEditTitle(novel?.title || '')
    setEditSummary(novel?.summary || '')
    setOutlineNodes(storeOutlineNodes || [])
    setEmotionEvents(storeEmotionEvents || [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novelId])

  const saveSummary = () => {
    updateNovel({ title: editTitle, summary: editSummary })
    updateEmotionEvents(emotionEvents)
    updateOutlineNodes(outlineNodes)
  }

  // ========== 剧情大纲操作 ==========
  const addOutlineNode = () => {
    setOutlineNodes((prev) => [
      ...prev,
      { id: Date.now().toString(), title: '', content: '', order: prev.length },
    ])
  }

  const updateOutlineNode = (id: string, field: 'title' | 'content', value: string) => {
    setOutlineNodes((prev) => prev.map((n) => (n.id === id ? { ...n, [field]: value } : n)))
  }

  const deleteOutlineNode = (id: string) => {
    setOutlineNodes((prev) => prev.filter((n) => n.id !== id))
  }

  const moveOutlineNode = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= outlineNodes.length) return
    const copy = [...outlineNodes]
    const [item] = copy.splice(index, 1)
    copy.splice(newIndex, 0, item)
    setOutlineNodes(copy)
  }

  // ========== 关系图谱状态 ==========
  const initialNodes = characters.map((char, i) => ({
    id: char.id,
    data: { label: char.name },
    position: { x: 100 + (i % 4) * 200, y: 100 + Math.floor(i / 4) * 150 },
    style: {
      background: char.roleType === 'protagonist' ? 'rgba(99,102,241,0.2)' : 'rgba(168,85,247,0.15)',
      color: '#e0e0e0',
      border: '1px solid #333',
      borderRadius: '10px',
      padding: '10px 16px',
      fontSize: '13px',
      fontWeight: 600,
      minWidth: '100px',
      textAlign: 'center' as const,
    },
  }))

  const initialEdges = (characters.flatMap((char) =>
    (char.relationships || [])
      .filter((rel: any) => characters.some((c) => c.id === rel.targetId))
      .map((rel: any) => ({
        id: `e-${char.id}-${rel.targetId}`,
        source: char.id,
        target: rel.targetId,
        label: rel.type || '关系',
        style: { stroke: '#6366f1', strokeWidth: 2 },
        labelStyle: { fill: '#888', fontSize: 12 },
        animated: true,
      }))
  ) as any[]).filter((e) => e.source !== e.target)

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(initialNodes)
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(initialEdges)

  const onConnect = useCallback(
    (params: any) => setRfEdges((eds) => addEdge({ ...params, style: { stroke: '#6366f1', strokeWidth: 2 }, animated: true }, eds)),
    [setRfEdges]
  )

  // 只在首次加载时设置图谱节点，保留用户拖拽位置
  useEffect(() => {
    setRfNodes(initialNodes)
    setRfEdges(initialEdges)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!novel) {
    return (
      <PageWrapper title="剧情观可视化" subtitle="请先使用一键推导生成小说数据">
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>📭</div>
          <h3 style={{ color: '#888', fontSize: '18px', marginBottom: '8px' }}>暂无项目数据</h3>
          <p style={{ color: '#666', fontSize: '14px' }}>请先使用左侧"一键推导"功能创建项目</p>
          <button
            onClick={() => window.location.hash = '#/deduce'}
            style={{ marginTop: '20px', padding: '10px 24px', background: '#6366f1', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px', cursor: 'pointer' }}
          >
            去一键推导
          </button>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper
      title="剧情观可视化"
      subtitle={`${novel.title} · 查看并编辑故事全貌`}
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => window.location.hash = '#/deduce'}
            style={{ padding: '8px 16px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', cursor: 'pointer' }}
          >
            🔄 重新推导
          </button>
        </div>
      }
    >
      {/* 标签切换栏 */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #2a2a2a' }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '17px 24px',
              background: activeTab === tab.key ? '#1a1a1a' : 'transparent',
              color: activeTab === tab.key ? '#6366f1' : '#a0a0a0',
              border: activeTab === tab.key ? '1px solid #2a2a2a' : '1px solid transparent',
              borderBottom: activeTab === tab.key ? '2px solid #6366f1' : '2px solid transparent',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: activeTab === tab.key ? 700 : 500,
              transition: 'all 0.2s',
              letterSpacing: '0.5px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 内容卡片 */}
      <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '24px', minHeight: '500px' }}>
        
        {/* ===== 故事梗概 ===== */}
        {activeTab === 'summary' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '8px', fontWeight: 500 }}>
                小说标题
              </label>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="输入小说标题..."
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#0f0f0f',
                  border: '1px solid #2a2a2a',
                  borderRadius: '8px',
                  color: '#e0e0e0',
                  fontSize: '16px',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '8px', fontWeight: 500 }}>
                故事简介
              </label>
              <textarea
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
                placeholder="输入故事简介..."
                rows={12}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#0f0f0f',
                  border: '1px solid #2a2a2a',
                  borderRadius: '8px',
                  color: '#e0e0e0',
                  fontSize: '14px',
                  resize: 'vertical',
                  minHeight: '200px',
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                  lineHeight: 1.6,
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={saveSummary}
                style={{
                  padding: '10px 28px',
                  background: '#6366f1',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                保存修改
              </button>
            </div>
          </div>
        )}

        {/* ===== 角色档案 ===== */}
        {activeTab === 'characters' && (
          <div>
            {characters.length === 0 ? (
              <p style={{ color: '#666', textAlign: 'center', padding: '80px 0' }}>暂无角色，请先在角色管理中添加</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                {characters.map((char) => (
                  <div key={char.id} style={{ background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '10px', padding: '16px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>{char.name}</div>
                    <div style={{ fontSize: '12px', color: '#6366f1', marginBottom: '10px' }}>
                      {char.roleType === 'protagonist' ? '主角' : char.roleType === 'supporting' ? '配角' : char.roleType === 'antagonist' ? '反派' : '次要角色'}
                    </div>
                    <div style={{ fontSize: '13px', color: '#888', lineHeight: 1.6, marginBottom: '6px' }}>{char.appearance || '暂无外貌描述'}</div>
                    <div style={{ fontSize: '12px', color: '#666', lineHeight: 1.6, marginBottom: '4px' }}>{char.background || '暂无背景'}</div>
                    <div style={{ fontSize: '12px', color: '#a78bfa' }}>{char.personality?.join('、') || '暂无性格标签'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== 世界观（问题3：完整显示规则/地点/时间线/社会/文化/经济） ===== */}
        {activeTab === 'world' && (
          <div>
            {worlds.length === 0 ? (
              <p style={{ color: '#666', textAlign: 'center', padding: '80px 0' }}>暂无世界观设定</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {worlds.map((w) => (
                  <div key={w.id} style={{ background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '10px', padding: '16px' }}>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>{w.name}</div>

                    {/* 概述 */}
                    <div style={{ fontSize: '13px', color: '#ccc', lineHeight: 1.6, marginBottom: '12px' }}>
                      {w.overview || w.description || '暂无描述'}
                    </div>

                    {/* 规则 */}
                    {w.rules?.length > 0 && (
                      <div style={{ marginTop: '12px' }}>
                        <div style={{ fontSize: '12px', color: '#6366f1', fontWeight: 600, marginBottom: '6px' }}>世界规则（{w.rules.length}）</div>
                        {w.rules.map((r: any, i: number) => (
                          <div key={i} style={{ padding: '8px 12px', background: '#1a1a1a', borderRadius: '6px', marginBottom: '4px' }}>
                            <div style={{ fontSize: '13px', color: '#e0e0e0', fontWeight: 500 }}>{r.name}</div>
                            <div style={{ fontSize: '12px', color: '#888' }}>{r.description}</div>
                            {r.scope && <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>适用范围：{r.scope}</div>}
                            {r.limit && <div style={{ fontSize: '11px', color: '#666' }}>限制：{r.limit}</div>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 地点 */}
                    {w.locations?.length > 0 && (
                      <div style={{ marginTop: '12px' }}>
                        <div style={{ fontSize: '12px', color: '#10b981', fontWeight: 600, marginBottom: '6px' }}>关键地点（{w.locations.length}）</div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {w.locations.map((loc: any, i: number) => (
                            <span key={i} style={{ padding: '4px 10px', background: 'rgba(16,185,129,0.1)', color: '#34d399', borderRadius: '6px', fontSize: '12px' }}>
                              {loc.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 时间线 */}
                    {w.timeline?.length > 0 && (
                      <div style={{ marginTop: '12px' }}>
                        <div style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 600, marginBottom: '6px' }}>历史时间线（{w.timeline.length}）</div>
                        {w.timeline.map((t: any, i: number) => (
                          <div key={i} style={{ padding: '6px 12px', background: '#1a1a1a', borderRadius: '6px', marginBottom: '4px', fontSize: '12px', color: '#888' }}>
                            <span style={{ color: '#f59e0b', fontWeight: 600 }}>{t.era || t.period}：</span>
                            {t.title || (Array.isArray(t.events) ? t.events.join('、') : t.events)}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 社会/文化/经济 */}
                    {(w.society || w.culture || w.economy) && (
                      <div style={{ marginTop: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {w.society && <span style={{ fontSize: '12px', color: '#888' }}>🏛️ 社会：{w.society}</span>}
                        {w.culture && <span style={{ fontSize: '12px', color: '#888' }}>🎭 文化：{w.culture}</span>}
                        {w.economy && <span style={{ fontSize: '12px', color: '#888' }}>💰 经济：{w.economy}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== 感情线（问题4：空事件时有默认生成按钮） ===== */}
        {activeTab === 'emotion' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#888', fontSize: '13px' }}>管理感情发展与肉欲情节的时间线</span>
              {emotionEvents.length > 0 ? (
                <button
                  onClick={() => {
                    setEmotionEvents(prev => [...prev, {
                      id: Date.now().toString(),
                      title: '',
                      description: '',
                      type: 'emotion',
                      characterIds: [],
                      order: prev.length
                    }])
                  }}
                  style={{
                    padding: '8px 16px',
                    background: '#6366f1',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  + 添加事件
                </button>
              ) : null}
            </div>

            {emotionEvents.filter((e) => adultMode || e.type === 'emotion' || e.type === 'conflict' || e.type === 'climax').length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <p style={{ color: '#666', marginBottom: '16px' }}>暂无感情线事件</p>
                <button
                  onClick={() => {
                    const defaultEvents = [
                      { id: Date.now().toString(), title: '初次相遇', description: '主角与关键角色第一次相遇，命运的齿轮开始转动...', type: 'emotion' as const, characterIds: characters.slice(0, 2).map(c => c.id), order: 0 },
                      { id: (Date.now() + 1).toString(), title: '感情升温', description: '两人关系逐渐亲密，彼此产生好感...', type: 'emotion' as const, characterIds: characters.slice(0, 2).map(c => c.id), order: 1 },
                      { id: (Date.now() + 2).toString(), title: '情感转折', description: '突发事件检验两人之间的信任和感情...', type: 'emotion' as const, characterIds: characters.slice(0, 2).map(c => c.id), order: 2 },
                    ]
                    setEmotionEvents(defaultEvents)
                    useStore.setState({ emotionEvents: defaultEvents })
                  }}
                  style={{
                    marginTop: '12px',
                    padding: '8px 24px',
                    background: '#6366f1',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  + 生成默认感情线（3个事件）
                </button>
              </div>
            ) : (
                emotionEvents.filter((e) => adultMode || e.type === 'emotion' || e.type === 'conflict' || e.type === 'climax').map((evt, idx) => (
                  <div key={evt.id} style={{ position: 'relative', marginBottom: '16px' }}>
                    {/* 节点圆点 */}
                    <div style={{
                      position: 'absolute',
                      left: '-27px',
                      top: '18px',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      background: evt.type === 'adult' ? '#ef4444' : '#ec4899',
                      border: '3px solid #1a1a1a',
                      boxShadow: evt.type === 'adult' ? '0 0 8px rgba(239,68,68,0.4)' : '0 0 8px rgba(236,72,153,0.4)',
                    }} />

                    {/* 事件卡片 */}
                    <div style={{
                      background: '#0f0f0f',
                      border: '1px solid #2a2a2a',
                      borderRadius: '10px',
                      padding: '16px',
                    }}>
                      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'center' }}>
                        <select
                          value={evt.type}
                          onChange={(e) => {
                            const val = e.target.value as 'emotion' | 'adult' | 'conflict' | 'climax'
                            setEmotionEvents(prev => prev.map(e => e.id === evt.id ? { ...e, type: val } : e))
                          }}
                          style={{
                            padding: '6px 10px',
                            background: evt.type === 'adult' ? 'rgba(239,68,68,0.15)' : evt.type === 'conflict' ? 'rgba(245,158,11,0.15)' : evt.type === 'climax' ? 'rgba(168,85,247,0.15)' : 'rgba(236,72,153,0.15)',
                            border: `1px solid ${evt.type === 'adult' ? 'rgba(239,68,68,0.3)' : evt.type === 'conflict' ? 'rgba(245,158,11,0.3)' : evt.type === 'climax' ? 'rgba(168,85,247,0.3)' : 'rgba(236,72,153,0.3)'}`,
                            borderRadius: '6px',
                            color: evt.type === 'adult' ? '#f87171' : evt.type === 'conflict' ? '#facc15' : evt.type === 'climax' ? '#c084fc' : '#f472b6',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            outline: 'none',
                          }}
                        >
                          <option value="emotion" style={{ background: '#1a1a1a', color: '#e0e0e0' }}>💕 感情线</option>
                          <option value="conflict" style={{ background: '#1a1a1a', color: '#e0e0e0' }}>⚔️ 冲突</option>
                          <option value="climax" style={{ background: '#1a1a1a', color: '#e0e0e0' }}>🔥 高潮</option>
                          <option value="adult" style={{ background: '#1a1a1a', color: '#e0e0e0' }}>🔞 肉欲线</option>
                        </select>

                        <input
                          value={evt.title}
                          onChange={(event) => setEmotionEvents(prev => prev.map(e => e.id === evt.id ? { ...e, title: event.target.value } : e))}
                          placeholder="事件标题（如：初次相遇、表白、亲密关系）"
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            background: '#0f0f0f',
                            border: '1px solid #2a2a2a',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '14px',
                            outline: 'none',
                          }}
                        />

                        <button
                          onClick={() => {
                            if (idx === 0) return
                            const copy = [...emotionEvents]
                            const [item] = copy.splice(idx, 1)
                            copy.splice(idx - 1, 0, item)
                            setEmotionEvents(copy)
                          }}
                          disabled={idx === 0}
                          style={{
                            padding: '4px 10px',
                            background: idx === 0 ? '#1a1a1a' : '#2a2a2a',
                            border: '1px solid #333',
                            borderRadius: '6px',
                            color: idx === 0 ? '#555' : '#e0e0e0',
                            fontSize: '12px',
                            cursor: idx === 0 ? 'not-allowed' : 'pointer',
                          }}
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => {
                            if (idx === emotionEvents.length - 1) return
                            const copy = [...emotionEvents]
                            const [item] = copy.splice(idx, 1)
                            copy.splice(idx + 1, 0, item)
                            setEmotionEvents(copy)
                          }}
                          disabled={idx === emotionEvents.length - 1}
                          style={{
                            padding: '4px 10px',
                            background: idx === emotionEvents.length - 1 ? '#1a1a1a' : '#2a2a2a',
                            border: '1px solid #333',
                            borderRadius: '6px',
                            color: idx === emotionEvents.length - 1 ? '#555' : '#e0e0e0',
                            fontSize: '12px',
                            cursor: idx === emotionEvents.length - 1 ? 'not-allowed' : 'pointer',
                          }}
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => setEmotionEvents(prev => prev.filter(e => e.id !== evt.id))}
                          style={{
                            padding: '4px 10px',
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.2)',
                            borderRadius: '6px',
                            color: '#ef4444',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          删除
                        </button>
                      </div>

                      <textarea
                        value={evt.description}
                        onChange={(event) => setEmotionEvents(prev => prev.map(e => e.id === evt.id ? { ...e, description: event.target.value } : e))}
                        placeholder="事件详细描述..."
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: '#0f0f0f',
                          border: '1px solid #2a2a2a',
                          borderRadius: '6px',
                          color: '#ccc',
                          fontSize: '13px',
                          resize: 'vertical',
                          outline: 'none',
                          lineHeight: 1.5,
                          marginBottom: '10px',
                        }}
                      />

                      {/* 关联角色 */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ color: '#888', fontSize: '12px' }}>涉及角色：</span>
                        {characters.map((char) => {
                          const selected = (evt.characterIds || []).includes(char.id)
                          return (
                            <button
                              key={char.id}
                              onClick={() => setEmotionEvents(prev => prev.map(e => {
                                if (e.id !== evt.id) return e
                                const ids = e.characterIds || []
                                return { ...e, characterIds: ids.includes(char.id) ? ids.filter(id => id !== char.id) : [...ids, char.id] }
                              }))}
                              style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                border: selected ? '1px solid #6366f1' : '1px solid #333',
                                background: selected ? 'rgba(99,102,241,0.2)' : '#1a1a1a',
                                color: selected ? '#818cf8' : '#888',
                              }}
                            >
                              {char.name}
                            </button>
                          )
                        })}
                        {characters.length === 0 && (
                          <span style={{ color: '#555', fontSize: '12px' }}>暂无角色</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}

            {emotionEvents.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => updateNovel({ title: editTitle, summary: editSummary, outlineNodes, emotionEvents } as any)}
                  style={{
                    padding: '10px 28px',
                    background: '#6366f1',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '14px',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  保存感情线
                </button>
              </div>
            )}
          </div>
        )}

        {/* ===== 剧情大纲（已实装） ===== */}
        {activeTab === 'outline' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#888', fontSize: '13px' }}>共 {outlineNodes.length} 个节点</span>
              <button
                onClick={addOutlineNode}
                style={{
                  padding: '8px 16px',
                  background: '#6366f1',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                + 添加节点
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {outlineNodes.map((node, idx) => (
                <div
                  key={node.id}
                  style={{
                    background: '#0f0f0f',
                    border: '1px solid #2a2a2a',
                    borderRadius: '10px',
                    padding: '16px',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                  }}
                >
                  <span style={{ color: '#6366f1', fontWeight: 600, fontSize: '13px', minWidth: '60px' }}>
                    节点 {idx + 1}
                  </span>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input
                      value={node.title}
                      onChange={(e) => updateOutlineNode(node.id, 'title', e.target.value)}
                      placeholder="节点标题（如：第一幕 开端）"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: '#0f0f0f',
                        border: '1px solid #2a2a2a',
                        borderRadius: '8px',
                        color: '#e0e0e0',
                        fontSize: '14px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <textarea
                      value={node.content}
                      onChange={(e) => updateOutlineNode(node.id, 'content', e.target.value)}
                      placeholder="内容概要..."
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: '#0f0f0f',
                        border: '1px solid #2a2a2a',
                        borderRadius: '8px',
                        color: '#e0e0e0',
                        fontSize: '13px',
                        resize: 'vertical',
                        outline: 'none',
                        boxSizing: 'border-box',
                        lineHeight: 1.5,
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button
                      onClick={() => moveOutlineNode(idx, -1)}
                      disabled={idx === 0}
                      style={{
                        padding: '4px 10px',
                        background: idx === 0 ? '#1a1a1a' : '#2a2a2a',
                        border: '1px solid #333',
                        borderRadius: '6px',
                        color: idx === 0 ? '#555' : '#e0e0e0',
                        fontSize: '12px',
                        cursor: idx === 0 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveOutlineNode(idx, 1)}
                      disabled={idx === outlineNodes.length - 1}
                      style={{
                        padding: '4px 10px',
                        background: idx === outlineNodes.length - 1 ? '#1a1a1a' : '#2a2a2a',
                        border: '1px solid #333',
                        borderRadius: '6px',
                        color: idx === outlineNodes.length - 1 ? '#555' : '#e0e0e0',
                        fontSize: '12px',
                        cursor: idx === outlineNodes.length - 1 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => deleteOutlineNode(node.id)}
                      style={{
                        padding: '4px 10px',
                        background: 'rgba(239,68,68,0.15)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: '6px',
                        color: '#ef4444',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {outlineNodes.length === 0 && (
              <p style={{ color: '#666', textAlign: 'center', padding: '40px 0' }}>暂无大纲节点，点击右上角添加</p>
            )}

            {outlineNodes.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={saveSummary}
                  style={{
                    padding: '10px 28px',
                    background: '#6366f1',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '14px',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  保存大纲
                </button>
              </div>
            )}
          </div>
        )}

        {/* ===== 章节目录（问题6：显示字数和状态） ===== */}
        {activeTab === 'chapters' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ color: '#888', fontSize: '13px' }}>共 {chapters.length} 章</span>
              <span style={{ color: '#666', fontSize: '12px' }}>
                总字数：{chapters.reduce((sum, c) => sum + (c.wordCount || 0), 0)}
              </span>
            </div>

            {chapters.length === 0 ? (
              <p style={{ color: '#666', textAlign: 'center', padding: '80px 0' }}>暂无章节，请使用长篇规划生成</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {chapters.map((ch, idx) => (
                  <div key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#0f0f0f', borderRadius: '8px', border: '1px solid #2a2a2a' }}>
                    <span style={{ color: '#6366f1', fontWeight: 700, fontSize: '13px', minWidth: '60px' }}>
                      第{idx + 1}章
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: '#fff' }}>{ch.title}</div>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{ch.summary}</div>
                    </div>
                    <span style={{
                      padding: '2px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      background: ch.status === 'completed' ? 'rgba(34,197,94,0.15)' : ch.status === 'polished' ? 'rgba(99,102,241,0.15)' : 'rgba(234,179,8,0.15)',
                      color: ch.status === 'completed' ? '#4ade80' : ch.status === 'polished' ? '#818cf8' : '#facc15'
                    }}>
                      {ch.status === 'completed' ? '完成' : ch.status === 'polished' ? '已润色' : '草稿'}
                    </span>
                    {ch.wordCount > 0 && (
                      <span style={{ fontSize: '12px', color: '#666' }}>{ch.wordCount}字</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== 关系图谱（问题7：角色类型区分主角/配角/反派颜色） ===== */}
        {activeTab === 'graph' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#888', fontSize: '13px' }}>
                拖拽节点调整位置，拖拽连线创建关系
              </span>
              <span style={{ color: '#888', fontSize: '13px' }}>
                节点数：{rfNodes.length} | 关系数：{rfEdges.length}
              </span>
            </div>

            {characters.length === 0 ? (
              <p style={{ color: '#666', textAlign: 'center', padding: '80px 0' }}>
                暂无角色，请先在角色管理中添加
              </p>
            ) : (
              <div style={{ height: '520px', border: '1px solid #2a2a2a', borderRadius: '10px', overflow: 'hidden' }}>
                <ReactFlow
                  nodes={characters.map((char, i) => ({
                    id: char.id,
                    data: { label: char.name },
                    position: { x: 100 + (i % 4) * 200, y: 100 + Math.floor(i / 4) * 150 },
                    style: {
                      background: char.roleType === 'protagonist' ? 'rgba(99,102,241,0.25)' :
                                 char.roleType === 'antagonist' ? 'rgba(239,68,68,0.25)' :
                                 'rgba(168,85,247,0.2)',
                      color: '#e0e0e0',
                      border: '2px solid ' + (char.roleType === 'protagonist' ? '#6366f1' :
                                              char.roleType === 'antagonist' ? '#ef4444' :
                                              '#a855f7'),
                      borderRadius: '10px',
                      padding: '12px 20px',
                      fontSize: '14px',
                      fontWeight: 700,
                      minWidth: '120px',
                      textAlign: 'center' as const,
                      boxShadow: '0 0 12px rgba(0,0,0,0.3)',
                    },
                  }))}
                  edges={characters.flatMap((char) =>
                    (char.relationships || [])
                      .filter((rel: any) => characters.some((c) => c.id === rel.targetId))
                      .map((rel: any) => ({
                        id: `e-${char.id}-${rel.targetId}`,
                        source: char.id,
                        target: rel.targetId,
                        label: rel.type || '关系',
                        labelStyle: { fill: '#888', fontSize: 12 },
                        style: { stroke: '#6366f1', strokeWidth: 2 },
                        animated: true,
                      }))
                  )}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  fitView
                  style={{ background: '#0f0f0f' }}
                >
                  <Background color="#333" gap={16} />
                  <Controls style={{ background: '#1a1a1a', color: '#e0e0e0' }} />
                  <MiniMap
                    style={{ background: '#1a1a1a' }}
                    nodeColor={(n: any) => {
                      const char = characters.find((c) => c.id === n.id)
                      return char?.roleType === 'protagonist' ? '#6366f1' :
                             char?.roleType === 'antagonist' ? '#ef4444' :
                             '#a855f7'
                    }}
                    maskColor="rgba(15,15,15,0.7)"
                  />
                </ReactFlow>
              </div>
            )}
          </div>
        )}
      </div>
    </PageWrapper>
  )
}