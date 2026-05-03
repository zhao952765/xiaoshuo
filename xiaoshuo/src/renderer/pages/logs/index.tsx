import { useState, useMemo, useCallback } from 'react'
import { useAppStore } from '../../store'
import PageWrapper from '../../components/PageWrapper'
import type { Log, LogType } from '../../../config/types'

// ==========================================
// 常量
// ==========================================
const LOG_COLORS: Record<LogType, string> = {
  info: '#3b82f6',
  warn: '#f59e0b',
  error: '#ef4444',
  success: '#10b981',
}

const LOG_BG_COLORS: Record<LogType, string> = {
  info: '#3b82f615',
  warn: '#f59e0b15',
  error: '#ef444415',
  success: '#10b98115',
}

const LOG_LABELS: Record<LogType, string> = {
  info: '信息',
  warn: '警告',
  error: '错误',
  success: '成功',
}

const FILTER_TYPES: { key: LogType | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'info', label: '信息' },
  { key: 'warn', label: '警告' },
  { key: 'error', label: '错误' },
  { key: 'success', label: '成功' },
]

// ==========================================
// 统计卡片
// ==========================================
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px' }}>
      <div style={{ fontSize: '20px', fontWeight: 600, color }}>{value}</div>
      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{label}</div>
    </div>
  )
}

// ==========================================
// 主组件
// ==========================================
export default function LogsPage() {
  const logs = useAppStore((s) => s.logs)
  const clearLogs = useAppStore((s) => s.clearLogs)
  const addLog = useAppStore((s) => s.addLog)

  const [filter, setFilter] = useState<LogType | 'all'>('all')
  const [confirmClear, setConfirmClear] = useState(false)

  /* ---- 筛选 ---- */
  const filtered = useMemo(() => {
    if (filter === 'all') return logs
    return logs.filter((l) => l.type === filter)
  }, [logs, filter])

  /* ---- 统计 ---- */
  const stats = useMemo(() => {
    const counts = { info: 0, warn: 0, error: 0, success: 0 }
    logs.forEach((l) => { counts[l.type]++ })
    return counts
  }, [logs])

  /* ---- 导出日志 ---- */
  const handleExport = useCallback(() => {
    const data = {
      exportedAt: Date.now(),
      total: logs.length,
      logs,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    addLog({ type: 'success', message: '日志导出成功', detail: `共 ${logs.length} 条` })
  }, [logs, addLog])

  return (
    <PageWrapper
      title="日志中心"
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleExport} disabled={logs.length === 0} style={{ background: '#1a1a1a', color: '#ccc', border: '1px solid #333', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: logs.length === 0 ? 'not-allowed' : 'pointer', opacity: logs.length === 0 ? 0.4 : 1 }}>导出日志</button>
          <button onClick={() => setConfirmClear(true)} disabled={logs.length === 0} style={{ background: '#ef444410', color: '#ef4444', border: '1px solid #ef444430', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: logs.length === 0 ? 'not-allowed' : 'pointer', opacity: logs.length === 0 ? 0.4 : 1 }}>清空日志</button>
        </div>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <StatCard label="总日志" value={logs.length} color="#ccc" />
        <StatCard label="信息" value={stats.info} color={LOG_COLORS.info} />
        <StatCard label="警告" value={stats.warn} color={LOG_COLORS.warn} />
        <StatCard label="错误" value={stats.error} color={LOG_COLORS.error} />
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        {FILTER_TYPES.map((t) => (
          <button key={t.key} onClick={() => setFilter(t.key)} style={{
            padding: '4px 12px', borderRadius: '9999px', fontSize: '12px', border: filter === t.key ? '1px solid #6366f140' : '1px solid #333',
            background: filter === t.key ? '#6366f115' : '#1a1a1a', color: filter === t.key ? '#6366f1' : '#888', cursor: 'pointer'
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '48px 16px', fontSize: '12px', color: '#555' }}>{logs.length === 0 ? '暂无日志记录' : '没有符合条件的日志'}</div>
        ) : (
          <div>
            {filtered.map((log, idx) => (
              <div key={log.id} style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #252525' : 'none' }}>
                <LogItem log={log} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ fontSize: '10px', color: '#444' }}>共 {filtered.length} 条日志</div>

      {confirmClear && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#00000099', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', width: '90%', maxWidth: '384px', padding: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#e0e0e0', marginBottom: '12px' }}>确认清空日志</div>
            <p style={{ fontSize: '14px', color: '#e0e0e0', margin: '0 0 16px' }}>确定清空全部 {logs.length} 条日志吗？此操作不可撤销。</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { clearLogs(); setConfirmClear(false) }} style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', fontSize: '12px', background: '#ef444410', color: '#ef4444', border: '1px solid #ef444430', cursor: 'pointer' }}>确认清空</button>
              <button onClick={() => setConfirmClear(false)} style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', fontSize: '12px', background: '#1a1a1a', color: '#ccc', border: '1px solid #333', cursor: 'pointer' }}>取消</button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  )
}

// ==========================================
// 单条日志
// ==========================================
function LogItem({ log }: { log: Log }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: log.detail ? 'pointer' : 'default' }} onClick={() => log.detail && setExpanded(!expanded)}>
        <span style={{ marginTop: '4px', padding: '2px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 500, flexShrink: 0, background: LOG_BG_COLORS[log.type], color: LOG_COLORS[log.type] }}>
          {LOG_LABELS[log.type]}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12px', color: '#ccc' }}>{log.message}</div>
          {expanded && log.detail && (
            <div style={{ fontSize: '11px', color: '#666', marginTop: '4px', background: '#0f0f0f', borderRadius: '8px', padding: '8px 10px', border: '1px solid #2a2a2a' }}>
              {log.detail}
            </div>
          )}
        </div>
        <div style={{ fontSize: '10px', color: '#555', flexShrink: 0 }}>
          {new Date(log.timestamp).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}
