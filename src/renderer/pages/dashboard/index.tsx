import { useStore } from '../../store'
import { useRef, useCallback } from 'react'

export default function Dashboard() {
  const novel = useStore((s) => s.currentNovel)
  const characters = useStore((s) => s.characters)
  const chapters = useStore((s) => s.chapters)
  const worlds = useStore((s) => s.worldSettings)
  const tags = useStore((s) => s.tags)
  const memories = useStore((s) => s.memories)
  const logs = useStore((s) => s.logs)

  const exportProject = useStore((s) => s.exportProject)
  const loadProject = useStore((s) => s.loadProject)
  const addLog = useStore((s) => s.addLog)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = useCallback(() => {
    const data = exportProject()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${novel?.title || 'project'}_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    addLog({ type: 'success', message: '项目导出成功', detail: `文件名: ${a.download}` })
  }, [exportProject, novel, addLog])

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        loadProject(data)
        addLog({ type: 'success', message: '项目导入成功', detail: `文件: ${file.name}` })
      } catch (err) {
        addLog({ type: 'error', message: '项目导入失败', detail: String(err) })
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [loadProject, addLog])

  const stats = [
    { label: '角色', count: characters.length, icon: '👥', bg: 'rgba(168,85,247,0.1)', color: '#c084fc' },
    { label: '章节', count: chapters.length, icon: '📄', bg: 'rgba(59,130,246,0.1)', color: '#60a5fa' },
    { label: '世界观', count: worlds.length, icon: '🌍', bg: 'rgba(34,197,94,0.1)', color: '#4ade80' },
    { label: '标签', count: tags.length, icon: '🏷️', bg: 'rgba(234,179,8,0.1)', color: '#facc15' },
    { label: '记忆', count: memories.length, icon: '🧠', bg: 'rgba(236,72,153,0.1)', color: '#f472b6' },
    { label: '总字数', count: chapters.reduce((sum, c) => sum + (c.content?.length || 0), 0), icon: '📝', bg: 'rgba(99,102,241,0.1)', color: '#818cf8' },
  ]

  return (
    <div style={{ width: '100%' }}>
      {/* 标题区 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>
            {novel?.title || '未命名项目'}
          </h2>
          <p style={{ margin: 0, color: '#888', fontSize: '14px' }}>
            {novel?.summary || '暂无简介，在下方创建你的第一个项目吧'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            style={{ display: 'none' }}
          />
          <button onClick={handleExport} style={{
            padding: '8px 16px',
            background: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '8px',
            color: '#e0e0e0',
            fontSize: '14px',
            cursor: 'pointer'
          }}>
            导出项目
          </button>
          <button onClick={() => fileInputRef.current?.click()} style={{
            padding: '8px 16px',
            background: '#6366f1',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '14px',
            cursor: 'pointer'
          }}>
            导入项目
          </button>
        </div>
      </div>

      {/* 统计卡片 - 3列 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {stats.map((stat) => (
          <div key={stat.label} style={{
            background: '#1a1a1a',
            border: '1px solid #2a2a2a',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '10px',
              background: stat.bg,
              color: stat.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              flexShrink: 0
            }}>
              {stat.icon}
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff', lineHeight: 1 }}>
                {stat.count}
              </div>
              <div style={{ fontSize: '13px', color: '#888', marginTop: '2px' }}>
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 快速入口 */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 12px 0' }}>
          快速入口
        </h3>
        <div style={{ display: 'flex', gap: '12px' }}>
          {[
            { label: '一键推导', path: '#/deduce', icon: '⚡', bg: 'rgba(249,115,22,0.1)', color: '#fb923c' },
            { label: '长篇规划', path: '#/longplan', icon: '📝', bg: 'rgba(34,197,94,0.1)', color: '#4ade80' },
            { label: '自动续写', path: '#/continue', icon: '✍️', bg: 'rgba(59,130,246,0.1)', color: '#60a5fa' },
            { label: '剧情观可视化', path: '#/plotview', icon: '🕸️', bg: 'rgba(168,85,247,0.1)', color: '#c084fc' },
          ].map((item) => (
            <a key={item.path} href={item.path} style={{
              flex: 1,
              background: '#1a1a1a',
              border: '1px solid #2a2a2a',
              borderRadius: '12px',
              padding: '16px',
              textDecoration: 'none',
              display: 'block'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>{item.icon}</div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: '#fff' }}>{item.label}</div>
            </a>
          ))}
        </div>
      </div>

      {/* 最近活动：从日志读取 */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
            最近活动
          </h3>
          <span onClick={() => window.location.hash = '#/logs'} style={{ fontSize: '12px', color: '#6366f1', cursor: 'pointer' }}>查看全部</span>
        </div>
        <div style={{
          background: '#1a1a1a',
          border: '1px solid #2a2a2a',
          borderRadius: '12px',
          padding: '16px'
        }}>
          {logs.length === 0 ? (
            <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>暂无活动记录</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {logs.slice(0, 5).map((log) => (
                <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: log.type === 'success' ? '#10b981' : log.type === 'error' ? '#ef4444' : log.type === 'warn' ? '#f59e0b' : '#3b82f6',
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: '13px', color: '#e0e0e0', flex: 1 }}>{log.message}</span>
                  <span style={{ fontSize: '11px', color: '#666' }}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}