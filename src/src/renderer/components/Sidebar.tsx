import { Link, useLocation } from 'react-router-dom'

const menuItems = [
  { path: '/', label: '项目总览', icon: '📊' },
  { path: '/deduce', label: '一键推导', icon: '⚡' },
  { path: '/longplan', label: '长篇规划', icon: '📝' },
  { path: '/continue', label: '自动续写', icon: '✍️' },
  { path: '/polish', label: '文本润色', icon: '🎨' },
  { path: '/character', label: '角色管理', icon: '👤' },
  { path: '/world', label: '世界观管理', icon: '🌍' },
  { path: '/plotview', label: '剧情观可视化', icon: '🕸️' },
  { path: '/tags', label: '智能标签', icon: '🏷️' },
  { path: '/memory', label: '本地记忆', icon: '🧠' },
  { path: '/aimodel', label: 'AI 模型中心', icon: '🤖' },
  { path: '/chat', label: 'AI 对话助手', icon: '💬' },
  { path: '/logs', label: '日志中心', icon: '📋' },
]

export default function Sidebar() {
  const location = useLocation()

  return (
    <aside style={{
      width: '220px',
      height: '100vh',
      background: '#141414',
      borderRight: '1px solid #2a2a2a',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0
    }}>
      <div style={{ padding: '16px', borderBottom: '1px solid #2a2a2a' }}>
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#6366f1' }}>PNS Pro</h1>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 16px',
                margin: '2px 8px',
                borderRadius: '8px',
                textDecoration: 'none',
                fontSize: '14px',
                transition: 'all 0.2s',
                background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
                color: isActive ? '#6366f1' : '#a0a0a0',
                border: isActive ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = '#1f1f1f'
                  e.currentTarget.style.color = '#e0e0e0'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = '#a0a0a0'
                }
              }}
            >
              <span style={{ marginRight: '10px', fontSize: '16px' }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div style={{ padding: '12px', borderTop: '1px solid #2a2a2a' }}>
        <Link
          to="/settings"
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 16px',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: '14px',
            color: '#a0a0a0'
          }}
        >
          <span style={{ marginRight: '10px' }}>⚙️</span>
          <span>设置中心</span>
        </Link>
      </div>
    </aside>
  )
}