/**
 * 肉欲线强度曲线交互编辑器
 * SRS v2.3 中优先级：支持拖拽调整各章节强度值
 */

import React, { useState, useCallback } from 'react'
import { useStore } from '../../store'
import type { LustIntensityPoint } from '../../types/types'

export default function LustCurveEditor() {
  const lustArc = useStore((s) => s.lustArc)
  const updateLustArc = useStore((s) => s.updateLustArc)
  const chapters = useStore((s) => s.chapters)

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [hoverPoint, setHoverPoint] = useState<string | null>(null)

  const curve = lustArc?.intensityCurve || []

  const handleMouseDown = (id: string) => {
    setDraggingId(id)
  }

  const handleMouseMove = useCallback(
    (e: React.MouseEvent, containerHeight: number) => {
      if (!draggingId) return
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const y = e.clientY - rect.top
      const percentage = Math.max(0, Math.min(100, Math.round((1 - y / containerHeight) * 100)))

      const updated = curve.map((p) =>
        p.id === draggingId ? { ...p, value: percentage } : p,
      )
      updateLustArc({ intensityCurve: updated })
    },
    [draggingId, curve, updateLustArc],
  )

  const handleMouseUp = () => {
    setDraggingId(null)
  }

  const handleAddClimax = (pointId: string) => {
    if (!lustArc) return
    const point = curve.find((p) => p.id === pointId)
    if (!point) return
    const existing = lustArc.climaxPoints.find((cp) => cp.id === pointId)
    if (existing) return

    const newClimax = {
      id: pointId,
      chapterId: point.chapterId,
      chapterTitle: point.chapterTitle,
      intensity: point.value,
      description: point.description,
      characters: point.characters,
      type: 'climax' as const,
      order: point.order,
    }
    updateLustArc({ climaxPoints: [...lustArc.climaxPoints, newClimax] })
  }

  const handleRemoveClimax = (pointId: string) => {
    if (!lustArc) return
    updateLustArc({ climaxPoints: lustArc.climaxPoints.filter((cp) => cp.id !== pointId) })
  }

  const containerHeight = 250

  return (
    <div style={{ padding: '20px' }}>
      <h3 style={{ color: '#e0e0e0', fontSize: 16, marginBottom: 16 }}>🔥 肉欲线强度编辑器（拖拽调整）</h3>

      {curve.length === 0 ? (
        <div style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>暂无肉欲线数据</div>
      ) : (
        <>
          {/* 强度曲线 */}
          <div
            style={{
              height: containerHeight,
              background: '#0f0f0f',
              borderRadius: 8,
              border: '1px solid #2a2a2a',
              position: 'relative',
              padding: '20px 10px 30px',
              cursor: draggingId ? 'grabbing' : 'default',
            }}
            onMouseMove={(e) => handleMouseMove(e, containerHeight - 50)}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* 网格线 */}
            {[0, 25, 50, 75, 100].map((level) => (
              <div
                key={level}
                style={{
                  position: 'absolute',
                  left: 10, right: 10,
                  bottom: 30 + (level / 100) * (containerHeight - 50),
                  borderTop: '1px dashed #2a2a2a',
                  fontSize: 10,
                  color: '#4b5563',
                }}
              >
                <span style={{ position: 'absolute', left: -20, top: -6 }}>{level}</span>
              </div>
            ))}

            {/* 柱状图 + 拖拽点 */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: '100%', paddingBottom: 30 }}>
              {curve.map((point) => {
                const isClimax = lustArc?.climaxPoints.some((cp) => cp.id === point.id)
                return (
                  <div
                    key={point.id}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}
                    onMouseEnter={() => setHoverPoint(point.id)}
                    onMouseLeave={() => setHoverPoint(null)}
                  >
                    {/* 柱子 */}
                    <div
                      style={{
                        width: '100%',
                        height: `${(point.value / 100) * (containerHeight - 50)}px`,
                        background: isClimax ? '#ef4444' : point.value > 75 ? '#f59e0b' : '#a855f7',
                        borderRadius: '4px 4px 0 0',
                        opacity: 0.7,
                        transition: 'all 0.1s',
                      }}
                    />
                    {/* 拖拽手柄 */}
                    <div
                      onMouseDown={() => handleMouseDown(point.id)}
                      style={{
                        width: 16, height: 16, borderRadius: '50%',
                        background: isClimax ? '#ef4444' : '#fff',
                        border: `2px solid ${isClimax ? '#ef4444' : '#a855f7'}`,
                        position: 'absolute',
                        bottom: `${(point.value / 100) * (containerHeight - 50) + 22}px`,
                        cursor: 'grab',
                        zIndex: 10,
                        boxShadow: hoverPoint === point.id ? '0 0 8px rgba(168,85,247,0.5)' : 'none',
                      }}
                    />
                    {/* 章节标题 */}
                    <span style={{
                      position: 'absolute', bottom: -24, left: '50%', transform: 'translateX(-50%) rotate(-45deg)',
                      color: '#6b7280', fontSize: 10, whiteSpace: 'nowrap',
                    }}>
                      {point.chapterTitle.slice(0, 6)}
                    </span>
                    {/* 数值 */}
                    <span style={{
                      position: 'absolute',
                      top: -18, left: '50%', transform: 'translateX(-50%)',
                      color: '#d1d5db', fontSize: 10, fontWeight: 600,
                    }}>
                      {point.value}
                    </span>

                    {/* 悬浮操作 */}
                    {hoverPoint === point.id && (
                      <div style={{
                        position: 'absolute',
                        top: -50, left: '50%', transform: 'translateX(-50%)',
                        background: '#1a1a1a', border: '1px solid #2a2a2a',
                        borderRadius: 6, padding: '4px 8px',
                        display: 'flex', gap: 4, zIndex: 20,
                      }}>
                        {isClimax ? (
                          <button
                            onClick={() => handleRemoveClimax(point.id)}
                            style={{ fontSize: 10, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                          >
                            取消高潮
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAddClimax(point.id)}
                            style={{ fontSize: 10, color: '#f59e0b', background: 'none', border: 'none', cursor: 'pointer' }}
                          >
                            标记高潮
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 图例 */}
          <div style={{ display: 'flex', gap: 16, marginTop: 16, fontSize: 12, color: '#6b7280' }}>
            <span><span style={{ color: '#a855f7' }}>■</span> 普通强度</span>
            <span><span style={{ color: '#f59e0b' }}>■</span> 高强度 (&gt;75)</span>
            <span><span style={{ color: '#ef4444' }}>■</span> 高潮点</span>
            <span style={{ marginLeft: 'auto' }}>💡 拖拽圆点调整强度，悬浮标记高潮</span>
          </div>
        </>
      )}
    </div>
  )
}
