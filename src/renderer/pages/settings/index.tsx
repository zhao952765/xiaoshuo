/**
 * 设置页面 - 设计系统版
 * 深色现代风格，主色 #FF4D94
 */
import React from 'react'
import { useStore } from '../../store'
import PageWrapper from '../../components/PageWrapper'
import { StatCard, Btn, Divider, Badge } from '../../components/ui'

const A = '#FF4D94'

export default function SettingsPage() {
  const fontSize = useStore((s) => s.fontSize)
  const autoSaveInterval = useStore((s) => s.autoSaveInterval)
  const autoBackup = useStore((s) => s.autoBackup)
  const defaultTemperature = useStore((s) => s.defaultTemperature)
  const defaultMaxTokens = useStore((s) => s.defaultMaxTokens)
  const apiTimeout = useStore((s) => s.apiTimeout)
  const adultMode = useStore((s) => s.adultMode)

  const setFontSize = useStore((s) => s.setFontSize)
  const setAutoSaveInterval = useStore((s) => s.setAutoSaveInterval)
  const setAutoBackup = useStore((s) => s.setAutoBackup)
  const setDefaultTemperature = useStore((s) => s.setDefaultTemperature)
  const setDefaultMaxTokens = useStore((s) => s.setDefaultMaxTokens)
  const setApiTimeout = useStore((s) => s.setApiTimeout)
  const toggleAdultMode = useStore((s) => s.toggleAdultMode)
  const resetAll = useStore((s) => s.resetAll)
  const clearAllData = useStore((s) => s.clearAllData)
  const addLog = useStore((s) => s.addLog)

  const sectionStyle: React.CSSProperties = {
    padding: '16px', background: '#1a1a1a', borderRadius: '10px',
    border: '1px solid #2a2a2a',
  }
  const sectionTitle: React.CSSProperties = {
    fontSize: '14px', fontWeight: 600, color: '#aaa', marginBottom: '12px',
  }
  const label: React.CSSProperties = {
    display: 'block', fontSize: '12px', fontWeight: 500, color: '#aaa', marginBottom: '6px',
  }
  const inp: React.CSSProperties = {
    padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a',
    borderRadius: '6px', color: '#f0f0f0', fontSize: '13px', outline: 'none', width: '100%',
  }
  const accentStyle = (active: boolean): React.CSSProperties => ({
    border: active ? `1px solid ${A}` : '1px solid #2a2a2a',
    background: active ? `${A}18` : '#0f0f0f',
    color: active ? A : '#aaa',
  })

  return (
    <PageWrapper title="⚙️ 设置" subtitle="应用全局配置">
      {/* 外观 */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>🎨 外观</h3>
        <div>
          <label style={label}>字体大小</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['small', 'medium', 'large'] as const).map((s) => (
              <button key={s} onClick={() => setFontSize(s)}
                style={{ flex: 1, padding: '8px 0', borderRadius: 6, fontSize: 13, cursor: 'pointer', ...accentStyle(fontSize === s) }}>
                {s === 'small' ? '小' : s === 'medium' ? '中' : '大'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 自动保存 */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>💾 自动保存</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={label}>自动保存间隔（秒）</label>
            <input type="range" min={1} max={60} value={autoSaveInterval}
              onChange={(e) => setAutoSaveInterval(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: A }} />
            <div style={{ textAlign: 'center', color: '#6b7280', fontSize: 12, marginTop: 4 }}>{autoSaveInterval} 秒</div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#aaa' }}>
            <input type="checkbox" checked={autoBackup} onChange={(e) => setAutoBackup(e.target.checked)} style={{ accentColor: A }} />
            启用自动备份
          </label>
        </div>
      </div>

      {/* AI 默认参数 */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>🤖 AI 默认参数</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={label}>Temperature ({defaultTemperature})</label>
            <input type="range" min={0} max={2} step={0.1} value={defaultTemperature}
              onChange={(e) => setDefaultTemperature(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: A }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280' }}>
              <span>精确</span><span>平衡</span><span>创意</span>
            </div>
          </div>
          <div>
            <label style={label}>Max Tokens</label>
            <select value={defaultMaxTokens} onChange={(e) => setDefaultMaxTokens(parseInt(e.target.value))} style={inp}>
              {[2048, 4096, 8192, 16384, 32768].map(n => <option key={n} value={n}>{n >= 1000 ? `${n / 1000}K` : n}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>API 超时（秒）</label>
            <input type="number" min={10} max={300} value={apiTimeout}
              onChange={(e) => setApiTimeout(parseInt(e.target.value))} style={inp} />
          </div>
        </div>
      </div>

      {/* 成人模式 */}
      <div style={sectionStyle}>
        <h3 style={{ ...sectionTitle, color: A }}>🔞 成人内容</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: A }}>
          <input type="checkbox" checked={adultMode} onChange={toggleAdultMode} style={{ accentColor: A }} />
          启用成人模式（生成感情线 + 肉欲线双轨，显示 NSFW 内容）
        </label>
      </div>

      {/* 危险操作 */}
      <div style={sectionStyle}>
        <h3 style={{ ...sectionTitle, color: '#ef4444' }}>⚠️ 危险操作</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Btn variant="danger" size="md" fullWidth onClick={() => {
            if (confirm('确定要清除所有项目数据吗？AI 模型设置将保留。')) {
              clearAllData()
              addLog({ type: 'warn', message: '清除所有项目数据', detail: '' })
            }
          }}>
            🗑️ 清除所有项目数据
          </Btn>
          <Btn variant="secondary" size="md" fullWidth onClick={() => {
            if (confirm('确定要重置所有设置吗？')) {
              resetAll()
              addLog({ type: 'warn', message: '重置所有设置', detail: '' })
            }
          }}>
            🔄 重置所有设置
          </Btn>
        </div>
      </div>
    </PageWrapper>
  )
}
