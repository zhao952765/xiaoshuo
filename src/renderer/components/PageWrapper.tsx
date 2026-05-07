import type { ReactNode } from 'react'
import { theme } from './ui'

interface PageWrapperProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
}

export default function PageWrapper({ title, subtitle, actions, children }: PageWrapperProps) {
  return (
    <div style={{ width: '100%', animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '22px', fontWeight: 700, color: theme.text.primary }}>
            {title}
          </h2>
          {subtitle && (
            <p style={{ margin: 0, color: theme.text.tertiary, fontSize: '13px' }}>{subtitle}</p>
          )}
        </div>
        {actions && (
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            {actions}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {children}
      </div>
    </div>
  )
}

export { theme }
