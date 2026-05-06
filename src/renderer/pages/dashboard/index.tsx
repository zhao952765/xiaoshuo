/**
 * 仪表盘（Dashboard）增强版
 * SRS v2.3 要求：项目统计、最近项目、日志系统可导出
 */

import React, { useMemo } from 'react'
import { useStore } from '../../store'

export default function DashboardPage() {
  const currentNovel = useStore((s) => s.currentNovel)
  const characters = useStore((s) => s.characters)
  const chapters = useStore((s) => s.chapters)
  const worldSettings = useStore((s) => s.worldSettings)
  const tags = useStore((s) => s.tags)
  const emotionArc = useStore((s) => s.emotionArc)
  const lustArc = useStore((s) => s.lustArc)
  const logs = useStore((s) => s.logs)
  const adultMode = useStore((s) => s.adultMode)

  const stats = useMemo(() => {
    const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0)
    const completedChapters = chapters.filter((ch) => ch.status === 'completed' || ch.status === 'polished').length
    const avgIntensity = lustArc?.intensityCurve.length
      ? Math.round(lustArc.intensityCurve.reduce((s, p) => s + p.value, 0) / lustArc.intensityCurve.length)
      : 0

    return {
      totalWords,
      chapterCount: chapters.length,
      completedChapters,
      characterCount: characters.length,
      worldCount: worldSettings.length,
      tagCount: tags.length,
      emotionNodes: emotionArc?.nodes.length || 0,
      lustPoints: lustArc?.intensityCurve.length || 0,
      avgIntensity,
      logCount: logs.length,
    }
  }, [chapters, characters, worldSettings, tags, emotionArc, lustArc, logs])

  const exportLogs = () => {
    const data = JSON.stringify(logs, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs_${Date.now()}.json`
    a.click()
  }

  return (
    <div style={{ padding: '24px', color: '#e0e0e0' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>📊 仪表盘</h2>

      {/* 项目概览 */}
      {currentNovel ? (
        <div style={{ padding: 16, background: '#0a0a0a', borderRadius: 10, border: '1px solid #1a1a1a', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#e0e0e0', marginBottom: 8 }}>
            📖 {currentNovel.title}
          </h3>
          <p style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.6 }}>{currentNovel.summary?.slice(0, 200)}...</p>
          <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
            <span style={{ padding: '4px 10px', borderRadius: 4, fontSize: 12, background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>
              {currentNovel.adultMode ? '🔞 成人模式' : '📚 常规模式'}
            </span>
            <span style={{ padding: '4px 10px', borderRadius: 4, fontSize: 12, background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>
              目标: {currentNovel.targetWords}字
            </span>
          </div>
        </div>
      ) : (
        <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', background: '#0a0a0a', borderRadius: 10, marginBottom: 20 }}>
          暂无项目，点击「一键推导」开始创作
        </div>
      )}

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard icon="📝" label="总字数" value={stats.totalWords.toLocaleString()} color="#8b5cf6" />
        <StatCard icon="📑" label="章节数" value={`${stats.completedChapters}/${stats.chapterCount}`} color="#3b82f6" />
        <StatCard icon="👤" label="角色数" value={stats.characterCount} color="#10b981" />
        <StatCard icon="🌍" label="世界观" value={stats.worldCount} color="#f59e0b" />
        <StatCard icon="🏷️" label="标签数" value={stats.tagCount} color="#ec4899" />
        <StatCard icon="💕" label="感情节点" value={stats.emotionNodes} color="#a855f7" />
        {adultMode && (
          <>
            <StatCard icon="🔥" label="肉欲强度点" value={stats.lustPoints} color="#ef4444" />
            <StatCard icon="📈" label="平均强度" value={stats.avgIntensity} color="#f97316" />
          </>
        )}
      </div>

      {/* 最近日志 */}
      <div style={{ background: '#0a0a0a', borderRadius: 10, border: '1px solid #1a1a1a', padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#9ca3af' }}>📋 最近日志 ({stats.logCount})</h3>
          <button onClick={exportLogs} style={btnSecondaryStyle}>📤 导出日志</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflow: 'auto' }}>
          {logs.slice(0, 20).map((log) => (
            <div key={log.id} style={{
              padding: '8px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.02)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: log.type === 'success' ? '#10b981' : log.type === 'error' ? '#ef4444' : log.type === 'warn' ? '#f59e0b' : '#3b82f6',
              }} />
              <span style={{ color: '#e0e0e0', fontSize: 13, flex: 1 }}>{log.message}</span>
              <span style={{ color: '#6b7280', fontSize: 11 }}>
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
          {logs.length === 0 && (
            <div style={{ color: '#6b7280', textAlign: 'center', padding: 20 }}>暂无日志</div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string | number; color: string }) {
  return (
    <div style={{
      padding: 16, background: '#0a0a0a', borderRadius: 10, border: '1px solid #1a1a1a',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 24, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
    </div>
  )
}

const btnSecondaryStyle: React.CSSProperties = {
  padding: '6px 12px', background: '#1f1f1f', color: '#9ca3af',
  border: '1px solid #2a2a2a', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
}
