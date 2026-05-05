import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

/**
 * 页面级安全渲染边界
 * 捕获子组件树中的任何渲染错误，防止整个应用白屏崩溃
 */
export default class SafeRender extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '60px 24px',
          textAlign: 'center',
          color: '#e0e0e0',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ color: '#ef4444', fontSize: '18px', marginBottom: '8px' }}>
            页面渲染出错
          </h2>
          <p style={{ color: '#888', fontSize: '14px', marginBottom: '16px' }}>
            {this.state.error?.message || '未知错误'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }) }}
            style={{
              padding: '10px 24px',
              background: '#6366f1',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '14px',
              cursor: 'pointer',
              marginRight: '8px',
            }}
          >
            重试
          </button>
          <button
            onClick={() => { window.location.hash = '#/' }}
            style={{
              padding: '10px 24px',
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '8px',
              color: '#e0e0e0',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            返回首页
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
