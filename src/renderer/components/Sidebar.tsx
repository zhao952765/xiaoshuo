/**
 * 侧边栏导航 - SRS v2.3 完整版
 * 12个模块入口 + 项目状态指示
 */

import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { NAV_ITEMS } from '../routes'

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const currentNovel = useStore((s) => s.currentNovel)
  const adultMode = useStore((s) => s.adultMode)
  const isLoading = useStore((s) => s.isLoading)

  return (
    <div style={{
      width: 200,
      height: '100vh',
      background: '#0a0a0a',
      borderRight: '1px solid #1a1a1a',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#e0e0e0' }}>
          📘 情色推导器
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
          v2.3 {adultMode && <span style={{ color: '#a855f7' }}>🔞 成人模式</span>}
        </div>
      </div>

      {/* 项目状态 */}
      {currentNovel && (
        <div style={{
          padding: '10px 16px',
          background: 'rgba(139,92,246,0.08)',
          borderBottom: '1px solid #1a1a1a',
        }}>
          <div style={{ fontSize: 12, color: '#a78bfa', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            📖 {currentNovel.title}
          </div>
        </div>
      )}

      {/* 导航菜单 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path
          const isCore = ['/', '/deduce', '/plot', '/write'].includes(item.path)

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                width: '100%',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: isActive ? 'rgba(139,92,246,0.12)' : 'transparent',
                color: isActive ? '#a78bfa' : isCore ? '#d1d5db' : '#6b7280',
                border: 'none',
                borderLeft: isActive ? '3px solid #8b5cf6' : '3px solid transparent',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: isActive || isCore ? 500 : 400,
                textAlign: 'left',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ width: 20, textAlign: 'center', fontSize: 15 }}>{item.icon}</span>
              <span>{item.label}</span>
              {item.path === '/deduce' && isLoading && (
                <span style={{ marginLeft: 'auto', fontSize: 10, color: '#f59e0b' }}>⏳</span>
              )}
            </button>
          )
        })}
      </div>

      {/* 底部状态 */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid #1a1a1a',
        fontSize: 11,
        color: '#4b5563',
      }}>
        <div>完全本地运行</div>
        <div style={{ marginTop: 2 }}>数据存储于本地</div>
      </div>
    </div>
  )
}
