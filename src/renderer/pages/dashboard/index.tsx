/**
 * 仪表盘 - 设计系统版
 * 深色现代风格，主色 #FF4D94
 */
import React, { useMemo } from 'react'
import { useStore } from '../../store'
import { StatCard, Card, Empty, Btn, Divider } from '../../components/ui'

const A = '#FF4D94'

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

  const stats = useMemo(() => ({
    totalWords: chapters.reduce((sum, ch) => sum + ch.wordCount, 0),
    chapterCount: chapters.length,
    completedChapters: chapters.filter((ch) => ch.status === 'completed' || ch.status === 'polished').length,
    characterCount: characters.length,
    worldCount: worldSettings.length,
    tagCount: tags.length,
    emotionNodes: emotionArc?.nodes.length || 0,
    lustPoints: lustArc?.intensityCurve.length || 0,
    avgIntensity: lustArc?.intensityCurve.length
      ? Math.round(lustArc.intensityCurve.reduce((s, p) => s + p.value, 0) / lustArc.intensityCurve.length)
      : 0,
    logCount: logs.length,
  }), [chapters, characters, worldSettings, tags, emotionArc, lustArc, logs])

  const exportLogs = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `logs_${Date.now()}.json`; a.click()
  }

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#f0f0f0', marginBottom: '4px' }}>📊 仪表盘</h2>
      <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '24px' }}>项目概览与统计数据</p>

      {/* 项目概述卡片 */}
      {currentNovel ? (
        <Card hoverable style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#f0f0f0', marginBottom: '6px' }}>
                📖 {currentNovel.title}
              </h3>
              <p style={{ color: '#6b7280', fontSize: '13px', lineHeight: 1.6, maxWidth: 500 }}>
                {currentNovel.summary?.slice(0, 200)}...
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
              <span style={{ padding: '4px 10px', borderRadius: '9999px', fontSize: '11px', background: `${A}18`, color: A }}>
                {currentNovel.adultMode ? '🔞 成人' : '📚 常规'}
              </span>
              <span style={{ padding: '4px 10px', borderRadius: '9999px', fontSize: '11px', background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>
                目标: {currentNovel.targetWords}字
              </span>
            </div>
          </div>
        </Card>
      ) : (
        <Card style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📚</div>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>暂无项目</div>
          <div style={{ fontSize: '12px', color: '#4b5563' }}>点击导航栏的「一键推导」开始创作</div>
        </Card>
      )}

      <Divider />

      {/* 统计卡片网格 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
        <StatCard icon="📝" label="总字数" value={stats.totalWords.toLocaleString()} color="#8b5cf6" />
        <StatCard icon="📑" label="章节" value={`${stats.completedChapters}/${stats.chapterCount}`} color="#3b82f6" />
        <StatCard icon="👤" label="角色" value={stats.characterCount} color="#10b981" />
        <StatCard icon="🌍" label="世界观" value={stats.worldCount} color="#f59e0b" />
        <StatCard icon="🏷️" label="标签" value={stats.tagCount} color="#ec4899" />
        <StatCard icon="💕" label="感情节点" value={stats.emotionNodes} color={A} />
        {adultMode && (
          <>
            <StatCard icon="🔥" label="肉欲点" value={stats.lustPoints} color="#ef4444" />
            <StatCard icon="📈" label="平均强度" value={stats.avgIntensity} color="#f97316" />
          </>
        )}
      </div>

      {/* 最近日志 */}
      <Card style={{ marginTop: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#aaa' }}>📋 最近日志 ({stats.logCount})</span>
          <Btn variant="secondary" size="sm" onClick={exportLogs}>📤 导出</Btn>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 300, overflow: 'auto' }}>
          {logs.slice(0, 20).map((log) => (
            <div key={log.id} style={{
              padding: '8px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.02)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: log.type === 'success' ? '#10b981' : log.type === 'error' ? '#ef4444' : log.type === 'warn' ? '#f59e0b' : '#3b82f6',
              }} />
              <span style={{ color: '#f0f0f0', fontSize: 13, flex: 1 }}>{log.message}</span>
              <span style={{ color: '#6b7280', fontSize: 11, flexShrink: 0 }}>
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
          {logs.length === 0 && <div style={{ color: '#6b7280', textAlign: 'center', padding: 20, fontSize: 13 }}>暂无日志</div>}
        </div>
      </Card>
    </div>
  )
}
