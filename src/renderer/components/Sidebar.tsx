/**
 * 侧边栏导航 - v2.3 设计系统版
 * React.memo 包裹减少不必要的重渲染
 * 深色现代风格，主色 #FF4D94
 */
import React, { memo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { NAV_ITEMS } from '../routes'

const Sidebar = memo(function Sidebar() {
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
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ fontSize: 15, fontWeight: 700, background: 'linear-gradient(135deg, #FF4D94, #ff8ab5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Novel Studio Pro
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
          v2.3 {adultMode && <span style={{ color: '#FF4D94' }}>🔞</span>}
        </div>
      </div>

      {/* 项目状态 */}
      {currentNovel && (
        <div style={{
          padding: '10px 16px',
          background: 'rgba(255,77,148,0.06)',
          borderBottom: '1px solid #1a1a1a',
        }}>
          <div style={{ fontSize: 12, color: '#FF4D94', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            📖 {currentNovel.title}
          </div>
        </div>
      )}

      {/* 导航菜单 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path
          const core = ['/', '/deduce', '/plot', '/write'].includes(item.path)

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
                background: isActive ? 'rgba(255,77,148,0.1)' : 'transparent',
                color: isActive ? '#FF4D94' : core ? '#d1d5db' : '#555',
                border: 'none',
                borderLeft: isActive ? '3px solid #FF4D94' : '3px solid transparent',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: isActive ? 600 : core ? 500 : 400,
                textAlign: 'left',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ width: 20, textAlign: 'center', fontSize: 15, opacity: isActive ? 1 : 0.7 }}>{item.icon}</span>
              <span>{item.label}</span>
              {item.path === '/deduce' && isLoading && (
                <span style={{ marginLeft: 'auto', fontSize: 10 }}>⏳</span>
              )}
            </button>
          )
        })}
      </div>

      {/* 底部 */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #1a1a1a', fontSize: 11, color: '#4b5563' }}>
        <div>完全本地运行</div>
        <div style={{ marginTop: 2 }}>数据存储于本地</div>
      </div>
    </div>
  )
})

export default Sidebar
