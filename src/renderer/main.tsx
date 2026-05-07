/**
 * 应用入口 - 启动优化版
 * - 全局异常捕获（onerror + unhandledrejection）
 * - 启动速度优化（load 事件后才渲染）
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// ════════════════════════════════════════
// 全局异常捕获
// ════════════════════════════════════════

/** 渲染错误弹窗（避免白屏） */
function renderFatalError(message: string) {
  const root = document.getElementById('root')
  if (!root) return
  root.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#0f0f0f;color:#e0e0e0;padding:40px;font-family:system-ui,sans-serif;">
      <div style="font-size:48px;margin-bottom:16px;">💥</div>
      <h2 style="color:#ef4444;font-size:18px;margin-bottom:8px;">应用发生严重错误</h2>
      <p style="color:#888;font-size:14px;margin-bottom:16px;max-width:500px;text-align:center;">${message}</p>
      <button onclick="localStorage.clear();location.reload()" style="padding:10px 24px;background:#6366f1;border:none;border-radius:8px;color:#fff;font-size:14px;cursor:pointer;">
        重置并重试
      </button>
    </div>`
}

window.onerror = (_msg, _url, _line, _col, error) => {
  console.error('[Global Error]', error)
  renderFatalError(error?.message || '未知渲染错误')
  return true
}

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Rejection]', event.reason)
  // 不直接白屏，只记录
})

// ════════════════════════════════════════
// 应用启动（延迟到 load 事件触发，加快首屏感知速度）
// ════════════════════════════════════════
function bootstrap() {
  const root = document.getElementById('root')
  if (!root) {
    renderFatalError('DOM root 元素缺失')
    return
  }
  try {
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  } catch (e) {
    console.error('[Bootstrap Error]', e)
    renderFatalError((e as Error).message || '应用启动失败')
  }
}

if (document.readyState === 'complete') {
  bootstrap()
} else {
  window.addEventListener('load', bootstrap)
}
