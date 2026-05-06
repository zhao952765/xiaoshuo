/**
 * 设置页面（Settings）
 * SRS v2.3 基础配置：主题 / 字体 / 自动保存 / 备份 / API超时
 */

import React from 'react'
import { useStore } from '../../store'

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

  return (
    <div style={{ padding: '24px', maxWidth: 700, margin: '0 auto', color: '#e0e0e0' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>⚙️ 设置</h2>

      {/* 外观设置 */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>🎨 外观</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>字体大小</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['small', 'medium', 'large'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setFontSize(size)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 6,
                    border: fontSize === size ? '1px solid #8b5cf6' : '1px solid #2a2a2a',
                    background: fontSize === size ? 'rgba(139,92,246,0.15)' : '#0f0f0f',
                    color: fontSize === size ? '#a78bfa' : '#9ca3af',
                    fontSize: 13, cursor: 'pointer',
                  }}
                >
                  {size === 'small' ? '小' : size === 'medium' ? '中' : '大'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 自动保存 */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>💾 自动保存</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>自动保存间隔（秒）</label>
            <input
              type="range"
              min={1}
              max={60}
              value={autoSaveInterval}
              onChange={(e) => setAutoSaveInterval(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ textAlign: 'center', color: '#6b7280', fontSize: 12, marginTop: 4 }}>
              {autoSaveInterval} 秒
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#9ca3af' }}>
            <input
              type="checkbox"
              checked={autoBackup}
              onChange={(e) => setAutoBackup(e.target.checked)}
              style={{ accentColor: '#8b5cf6' }}
            />
            启用自动备份
          </label>
        </div>
      </div>

      {/* AI 默认参数 */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>🤖 AI 默认参数</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>默认 Temperature ({defaultTemperature})</label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={defaultTemperature}
              onChange={(e) => setDefaultTemperature(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280' }}>
              <span>精确</span>
              <span>平衡</span>
              <span>创意</span>
            </div>
          </div>
          <div>
            <label style={labelStyle}>默认 Max Tokens</label>
            <select
              value={defaultMaxTokens}
              onChange={(e) => setDefaultMaxTokens(parseInt(e.target.value))}
              style={inputStyle}
            >
              <option value={2048}>2K</option>
              <option value={4096}>4K</option>
              <option value={8192}>8K</option>
              <option value={16384}>16K</option>
              <option value={32768}>32K</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>API 超时（秒）</label>
            <input
              type="number"
              min={10}
              max={300}
              value={apiTimeout}
              onChange={(e) => setApiTimeout(parseInt(e.target.value))}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* 成人模式 */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>🔞 成人内容</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#a855f7' }}>
          <input
            type="checkbox"
            checked={adultMode}
            onChange={toggleAdultMode}
            style={{ accentColor: '#a855f7' }}
          />
          启用成人模式（生成感情线 + 肉欲线双轨，显示 NSFW 内容）
        </label>
      </div>

      {/* 危险操作 */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>⚠️ 危险操作</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => {
              if (confirm('确定要清除所有项目数据吗？AI 模型设置将保留。')) {
                clearAllData()
                addLog({ type: 'warn', message: '清除所有项目数据', detail: '' })
              }
            }}
            style={{
              padding: '10px 16px', background: '#ef4444', color: '#fff',
              border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            🗑️ 清除所有项目数据
          </button>
          <button
            onClick={() => {
              if (confirm('确定要重置所有设置吗？这将恢复到默认状态。')) {
                resetAll()
                addLog({ type: 'warn', message: '重置所有设置', detail: '' })
              }
            }}
            style={{
              padding: '10px 16px', background: '#1f1f1f', color: '#9ca3af',
              border: '1px solid #2a2a2a', borderRadius: 6, fontSize: 13,
              cursor: 'pointer',
            }}
          >
            🔄 重置所有设置
          </button>
        </div>
      </div>
    </div>
  )
}

const sectionStyle: React.CSSProperties = {
  padding: 16, background: '#0a0a0a', borderRadius: 10,
  border: '1px solid #1a1a1a', marginBottom: 16,
}
const sectionTitleStyle: React.CSSProperties = {
  fontSize: 14, fontWeight: 600, color: '#9ca3af', marginBottom: 12,
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 500, color: '#9ca3af', marginBottom: 6,
}
const inputStyle: React.CSSProperties = {
  padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a',
  borderRadius: '6px', color: '#e0e0e0', fontSize: '13px', outline: 'none', width: '100%',
}
