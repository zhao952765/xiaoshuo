import type { ReactNode } from 'react'

interface PageWrapperProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
}

export default function PageWrapper({ title, subtitle, actions, children }: PageWrapperProps) {
  return (
    <div style={{ width: '100%' }}>
      {/* 标题区 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>
            {title}
          </h2>
          {subtitle && (
            <p style={{ margin: 0, color: '#888', fontSize: '14px' }}>{subtitle}</p>
          )}
        </div>
        {actions && (
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            {actions}
          </div>
        )}
      </div>

      {/* 内容区：统一间距 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {children}
      </div>
    </div>
  )
}