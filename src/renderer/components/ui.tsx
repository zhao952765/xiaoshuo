/**
 * ============================================
 * 共享 UI 组件库 - Private Novel Studio Pro
 * 统一的深色现代风格设计系统
 * ============================================
 */
import type { ReactNode, CSSProperties, ChangeEvent } from 'react'

// ==========================================
// 设计 Token（与 index.css 变量同步）
// ==========================================
export const theme = {
  accent: '#FF4D94',
  accentHover: '#ff70a8',
  accentLight: 'rgba(255, 77, 148, 0.12)',
  accentGlow: 'rgba(255, 77, 148, 0.25)',
  bg: {
    base: '#0f0f0f',
    surface: '#1a1a1a',
    raised: '#222222',
    input: '#0f0f0f',
  },
  border: {
    subtle: '#2a2a2a',
    default: '#333',
    accent: 'rgba(255, 77, 148, 0.3)',
  },
  text: {
    primary: '#f0f0f0',
    secondary: '#aaa',
    tertiary: '#6b7280',
    muted: '#4b5563',
  },
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
} as const

// ==========================================
// 基础样式辅助
// ==========================================
export const s = {
  card: { background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, borderRadius: '12px', padding: '16px' } as CSSProperties,
  cardHover: { background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, borderRadius: '12px', padding: '16px', transition: 'border-color 0.2s, box-shadow 0.2s' } as CSSProperties,
  section: { padding: '16px', background: theme.bg.base, borderRadius: '10px', border: `1px solid ${theme.border.subtle}` } as CSSProperties,
  sectionTitle: { fontSize: '14px', fontWeight: 600, color: theme.text.secondary, marginBottom: '12px' } as CSSProperties,
  label: { display: 'block', fontSize: '12px', fontWeight: 500, color: theme.text.secondary, marginBottom: '6px' } as CSSProperties,
  input: { padding: '8px 12px', background: theme.bg.input, border: `1px solid ${theme.border.subtle}`, borderRadius: '6px', color: theme.text.primary, fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' } as CSSProperties,
  textarea: { padding: '12px 14px', background: theme.bg.input, border: `1px solid ${theme.border.subtle}`, borderRadius: '8px', color: theme.text.primary, fontSize: '14px', outline: 'none', width: '100%', fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box' } as CSSProperties,
  flexCenter: { display: 'flex', alignItems: 'center', justifyContent: 'center' } as CSSProperties,
  flexBetween: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as CSSProperties,
  flexGap: (gap = '8px'): CSSProperties => ({ display: 'flex', alignItems: 'center', gap }),
}

// ==========================================
// 卡片
// ==========================================
interface CardProps {
  children: ReactNode
  style?: CSSProperties
  hoverable?: boolean
  onClick?: () => void
  className?: string
}
export function Card({ children, style, hoverable, onClick, className }: CardProps) {
  return (
    <div
      className={className || (hoverable ? 'card-hover' : '')}
      onClick={onClick}
      style={{
        background: theme.bg.surface,
        border: `1px solid ${theme.border.subtle}`,
        borderRadius: '12px',
        padding: '16px',
        cursor: onClick ? 'pointer' : undefined,
        transition: 'border-color 0.2s, box-shadow 0.2s',
        ...(hoverable ? hoverCardStyle : {}),
        ...style,
      }}
    >
      {children}
      <style>{`
        .card-hover:hover {
          border-color: ${theme.border.accent} !important;
          box-shadow: 0 0 20px ${theme.accentGlow} !important;
        }
      `}</style>
    </div>
  )
}
const hoverCardStyle: CSSProperties = {}

// ==========================================
// 统计卡片
// ==========================================
interface StatCardProps {
  icon?: string
  label: string
  value: string | number
  color?: string
  size?: 'sm' | 'md'
}
export function StatCard({ icon, label, value, color = theme.accent, size = 'md' }: StatCardProps) {
  return (
    <Card style={{ textAlign: 'center' }}>
      {icon && <div style={{ fontSize: size === 'sm' ? '20px' : '26px', marginBottom: '4px' }}>{icon}</div>}
      <div style={{ fontSize: size === 'sm' ? '20px' : '26px', fontWeight: 700, color, marginBottom: '2px' }}>{value}</div>
      <div style={{ fontSize: '12px', color: theme.text.tertiary }}>{label}</div>
    </Card>
  )
}

// ==========================================
// 按钮
// ==========================================
interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  style?: CSSProperties
  fullWidth?: boolean
  type?: 'button' | 'submit'
}
export function Btn({ children, onClick, variant = 'secondary', size = 'sm', disabled, loading, style, fullWidth }: ButtonProps) {
  const variantStyles: Record<string, CSSProperties> = {
    primary: { background: theme.accent, color: '#fff', border: 'none' },
    secondary: { background: 'transparent', color: theme.text.secondary, border: `1px solid ${theme.border.default}` },
    danger: { background: 'transparent', color: theme.error, border: `1px solid rgba(239,68,68,0.3)` },
    ghost: { background: 'transparent', color: theme.text.secondary, border: 'none' },
  }
  const sizeStyles: Record<string, CSSProperties> = {
    sm: { padding: '6px 12px', fontSize: '12px', borderRadius: '8px' },
    md: { padding: '10px 16px', fontSize: '13px', borderRadius: '8px' },
    lg: { padding: '12px 20px', fontSize: '15px', borderRadius: '10px' },
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        fontWeight: 500,
        cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
        opacity: (disabled || loading) ? 0.5 : 1,
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
        width: fullWidth ? '100%' : undefined,
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
    >
      {loading && <span className="animate-pulse" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block' }} />}
      {children}
    </button>
  )
}

// ==========================================
// 输入框
// ==========================================
interface InputProps {
  value: string | number
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  type?: string
  style?: CSSProperties
  min?: number
  max?: number
  step?: number
  disabled?: boolean
}
export function Input({ value, onChange, placeholder, type = 'text', style, min, max, step, disabled }: InputProps) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      min={min}
      max={max}
      step={step}
      style={{ ...s.input, ...style }}
    />
  )
}

// ==========================================
// 选择框
// ==========================================
interface SelectProps {
  value: string | number
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void
  children: ReactNode
  style?: CSSProperties
}
export function Select({ value, onChange, children, style }: SelectProps) {
  return (
    <select value={value} onChange={onChange} style={{ ...s.input, cursor: 'pointer', ...style }}>
      {children}
    </select>
  )
}

// ==========================================
// 文本域
// ==========================================
interface TextareaProps {
  value: string
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void
  placeholder?: string
  style?: CSSProperties
  rows?: number
}
export function Textarea({ value, onChange, placeholder, style, rows }: TextareaProps) {
  return <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} style={{ ...s.textarea, ...style }} />
}

// ==========================================
// 标签 Badge
// ==========================================
interface BadgeProps {
  children: ReactNode
  color?: string
  bgColor?: string
  style?: CSSProperties
  dot?: boolean
}
export function Badge({ children, color, bgColor, style, dot }: BadgeProps) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 8px', borderRadius: '9999px', fontSize: '11px',
      color: color || theme.text.secondary,
      background: bgColor || `${theme.border.subtle}40`,
      ...style,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: color || theme.accent }} />}
      {children}
    </span>
  )
}

// ==========================================
// 模态框
// ==========================================
interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  width?: string
}
export function Modal({ open, onClose, title, children, width = '420px' }: ModalProps) {
  if (!open) return null
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="animate-slide-up"
        style={{
          background: theme.bg.surface,
          border: `1px solid ${theme.border.subtle}`,
          borderRadius: '14px',
          width: '90%',
          maxWidth: width,
          maxHeight: '85vh',
          overflow: 'auto',
          padding: '20px',
        }}
      >
        {title && (
          <div style={{ ...s.flexBetween, marginBottom: '16px' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: theme.text.primary }}>{title}</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: theme.text.tertiary, fontSize: '20px', cursor: 'pointer', padding: '4px' }}>✕</button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

// ==========================================
// 进度条
// ==========================================
interface ProgressBarProps {
  percent: number
  color?: string
  height?: string
  style?: CSSProperties
}
export function ProgressBar({ percent, color = theme.accent, height = '8px', style }: ProgressBarProps) {
  return (
    <div style={{ width: '100%', height, background: theme.bg.base, borderRadius: '9999px', overflow: 'hidden', ...style }}>
      <div style={{ height: '100%', background: color, borderRadius: '9999px', width: `${Math.min(100, Math.max(0, percent))}%`, transition: 'width 0.3s ease' }} />
    </div>
  )
}

// ==========================================
// 标签选择器（Tag Chip）
// ==========================================
interface ChipProps {
  label: string
  selected?: boolean
  onClick?: () => void
  color?: string
  removable?: boolean
  onRemove?: () => void
}
export function Chip({ label, selected, onClick, color = theme.accent, removable, onRemove }: ChipProps) {
  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '3px 10px', borderRadius: '9999px', fontSize: '12px',
        cursor: onClick ? 'pointer' : 'default',
        background: selected ? `${color}20` : theme.bg.raised,
        border: `1px solid ${selected ? `${color}50` : theme.border.subtle}`,
        color: selected ? color : theme.text.secondary,
        transition: 'all 0.15s',
        userSelect: 'none',
      }}
    >
      {label}
      {removable && (
        <span onClick={(e) => { e.stopPropagation(); onRemove?.() }} style={{ cursor: 'pointer', opacity: 0.6, fontSize: '14px', lineHeight: '14px' }}>×</span>
      )}
    </span>
  )
}

// ==========================================
// 空状态
// ==========================================
interface EmptyProps {
  icon?: string
  message: string
  submessage?: string
}
export function Empty({ icon = '📭', message, submessage }: EmptyProps) {
  return (
    <div style={{ padding: '48px 16px', textAlign: 'center', color: theme.text.tertiary }}>
      <div style={{ fontSize: '40px', marginBottom: '12px' }}>{icon}</div>
      <div style={{ fontSize: '14px', marginBottom: '4px' }}>{message}</div>
      {submessage && <div style={{ fontSize: '12px', color: theme.text.muted }}>{submessage}</div>}
    </div>
  )
}

// ==========================================
// 分隔线
// ==========================================
export function Divider({ style }: { style?: CSSProperties }) {
  return <div style={{ height: '1px', background: theme.border.subtle, margin: '8px 0', ...style }} />
}

// ==========================================
// 加载占位
// ==========================================
export function LoadingFallback({ text = '加载中...' }: { text?: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '80px 24px', color: theme.text.tertiary, gap: '16px',
    }}>
      <div style={{
        width: 32, height: 32,
        border: '3px solid rgba(255,77,148,0.2)',
        borderTopColor: '#FF4D94',
        borderRadius: '50%',
      }} className="animate-pulse" />
      <div style={{ fontSize: '14px' }}>{text}</div>
    </div>
  )
}
