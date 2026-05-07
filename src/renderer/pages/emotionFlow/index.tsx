/**
 * 感情线交互增强组件
 * 修复：节点/边从 store 同步，删除/addCharacter 时实时更新关系图
 */
import React, { useState, useCallback, useEffect } from 'react'
import {
  ReactFlow,
  Background, Controls, MiniMap, useNodesState, useEdgesState,
  addEdge, ReactFlowProvider,
} from '@xyflow/react'
import type { Node, Edge, Connection } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useStore } from '../../store'
import type { EmotionArcNode, EmotionArcEdge, EmotionEventType } from '../../types/types'

const TYPE_OPTIONS: { value: EmotionEventType; label: string; color: string }[] = [
  { value: 'emotion', label: '感情', color: '#ec4899' },
  { value: 'conflict', label: '冲突', color: '#f59e0b' },
  { value: 'climax', label: '高潮', color: '#ef4444' },
  { value: 'adult', label: '肉欲', color: '#a855f7' },
]

function emotionArcToFlowNodes(arc: EmotionArcNode[]): Node[] {
  return (arc || []).map((n) => ({
    id: n.id, type: 'default', position: n.position,
    data: { label: n.data.label, ...n.data },
    style: {
      background: n.data.color || '#8b5cf6', color: '#fff',
      border: '2px solid #fff', borderRadius: '8px',
      padding: '10px 14px', fontSize: '12px', fontWeight: 600, width: 140,
    },
  }))
}
function emotionArcToFlowEdges(arc: EmotionArcEdge[]): Edge[] {
  return (arc || []).map((e) => ({
    id: e.id, source: e.source, target: e.target,
    type: e.type, label: e.label, animated: e.animated, style: e.style,
  }))
}

export default function EmotionFlowEditor() {
  const emotionArc = useStore((s) => s.emotionArc)
  const updateEmotionArc = useStore((s) => s.updateEmotionArc)
  const characters = useStore((s) => s.characters)

  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [showNodeEditor, setShowNodeEditor] = useState(false)
  const [editingNode, setEditingNode] = useState<Partial<EmotionArcNode>>({})

  // Bug 修复：当 store 数据变化时同步 Flow 状态
  const [nodes, setNodes, onNodesChange] = useNodesState(emotionArcToFlowNodes(emotionArc?.nodes || []))
  const [edges, setEdges, onEdgesChange] = useEdgesState(emotionArcToFlowEdges(emotionArc?.edges || []))

  useEffect(() => {
    setNodes(emotionArcToFlowNodes(emotionArc?.nodes || []))
    setEdges(emotionArcToFlowEdges(emotionArc?.edges || []))
  }, [emotionArc, setNodes, setEdges])

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge: Edge = {
        id: `e-${params.source}-${params.target}`,
        source: params.source!, target: params.target!,
        type: 'smoothstep', animated: true,
        style: { stroke: '#8b5cf6', strokeWidth: 2 },
      }
      setEdges((eds) => addEdge(newEdge, eds))
    },
    [setEdges],
  )

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    setSelectedNode(node.id)
    const arcNode = emotionArc?.nodes.find((n) => n.id === node.id)
    if (arcNode) {
      setEditingNode({ ...arcNode })
      setShowNodeEditor(true)
    }
  }

  const handleSaveNode = () => {
    if (!emotionArc || !selectedNode) return
    updateEmotionArc({
      nodes: emotionArc.nodes.map((n) =>
        n.id === selectedNode
          ? {
              ...n,
              data: {
                ...n.data,
                label: editingNode.data?.label || n.data.label,
                description: editingNode.data?.description || n.data.description,
                intensity: editingNode.data?.intensity ?? n.data.intensity,
              },
              type: (editingNode.type as EmotionEventType) || n.type,
            }
          : n,
      ),
    })
    setShowNodeEditor(false)
  }

  const handleAddNode = () => {
    if (!emotionArc) return
    updateEmotionArc({
      nodes: [
        ...emotionArc.nodes,
        {
          id: `node_${Date.now()}`,
          type: 'emotion',
          position: { x: 100 + emotionArc.nodes.length * 50, y: 100 },
          data: {
            label: '新节点', description: '', intensity: 50,
            characterIds: characters.slice(0, 2).map((c) => c.id),
            chapterId: null, color: '#ec4899',
          },
        },
      ],
    })
  }

  const handleDeleteNode = () => {
    if (!emotionArc || !selectedNode) return
    updateEmotionArc({
      nodes: emotionArc.nodes.filter((n) => n.id !== selectedNode),
      edges: emotionArc.edges.filter((e) => e.source !== selectedNode && e.target !== selectedNode),
    })
    setShowNodeEditor(false)
    setSelectedNode(null)
  }

  const handleSaveEdgesToStore = () => {
    if (!emotionArc) return
    updateEmotionArc({
      edges: edges.map((e) => ({
        id: e.id, source: e.source, target: e.target,
        type: e.type as 'smoothstep' | 'default' | 'straight',
        label: e.label || '', animated: e.animated || false,
        style: { stroke: '#8b5cf6', strokeWidth: 2 },
      })),
    })
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: '8px 16px', background: '#0a0a0a', borderBottom: '1px solid #1a1a1a',
        display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <button onClick={handleAddNode} style={{ ...btnStyle, background: '#8b5cf6', color: '#fff' }}>➕ 添加节点</button>
        {selectedNode && (
          <>
            <button onClick={() => setShowNodeEditor(true)} style={btnStyle}>✏️ 编辑</button>
            <button onClick={handleDeleteNode} style={{ ...btnStyle, background: '#ef4444', color: '#fff' }}>🗑️ 删除</button>
            <button onClick={handleSaveEdgesToStore} style={{ ...btnStyle, background: '#10b981', color: '#fff' }}>💾 保存连线</button>
          </>
        )}
        <span style={{ marginLeft: 'auto', color: '#6b7280', fontSize: 12 }}>
          拖拽调整位置，点击节点编辑，拖拽连线连接
        </span>
      </div>

      <div style={{ flex: 1 }}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            fitView
          >
            <Background color="#333" gap={16} />
            <Controls />
            <MiniMap nodeColor={(n) => (n.style?.background as string) || '#666'} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>

      {showNodeEditor && editingNode.data && (
        <div style={modalOverlayStyle} onClick={() => setShowNodeEditor(false)}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>✏️ 编辑感情节点</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>节点名称</label>
                <input value={editingNode.data.label || ''}
                  onChange={(e) => setEditingNode((p) => ({ ...p, data: { ...p.data!, label: e.target.value } }))}
                  style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>类型</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {TYPE_OPTIONS.map((opt) => (
                    <button key={opt.value}
                      onClick={() => setEditingNode((p) => ({ ...p, type: opt.value, data: { ...p.data!, color: opt.color } }))}
                      style={{
                        flex: 1, padding: '6px 0', borderRadius: 6,
                        border: editingNode.type === opt.value ? `1px solid ${opt.color}` : '1px solid #2a2a2a',
                        background: editingNode.type === opt.value ? `${opt.color}20` : '#0f0f0f',
                        color: editingNode.type === opt.value ? opt.color : '#9ca3af',
                        fontSize: 12, cursor: 'pointer',
                      }}
                    >{opt.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>强度 ({editingNode.data.intensity})</label>
                <input type="range" min={0} max={100} value={editingNode.data.intensity || 50}
                  onChange={(e) => setEditingNode((p) => ({ ...p, data: { ...p.data!, intensity: parseInt(e.target.value) } }))}
                  style={{ width: '100%', accentColor: '#8b5cf6' }} />
              </div>
              <div>
                <label style={labelStyle}>描述</label>
                <textarea value={editingNode.data.description || ''}
                  onChange={(e) => setEditingNode((p) => ({ ...p, data: { ...p.data!, description: e.target.value } }))}
                  rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={handleSaveNode} style={{ ...btnPrimaryStyle, flex: 1 }}>💾 保存</button>
                <button onClick={() => setShowNodeEditor(false)} style={{ ...btnSecondaryStyle, flex: 1 }}>取消</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 6, border: '1px solid #2a2a2a',
  background: '#1f1f1f', color: '#9ca3af', fontSize: 12, cursor: 'pointer',
}
const inputStyle: React.CSSProperties = {
  padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a',
  borderRadius: '6px', color: '#e0e0e0', fontSize: '13px', outline: 'none', width: '100%',
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
const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
}
const modalContentStyle: React.CSSProperties = {
  background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 12,
  padding: 24, maxWidth: 400, width: '90%',
}
