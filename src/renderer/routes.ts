/**
 * 导航配置 - 与 App.tsx 路由一一对应
 */
export interface NavItem {
  path: string
  label: string
  icon: string
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: '仪表盘', icon: '📊' },
  { path: '/deduce', label: '一键推导', icon: '🎯' },
  { path: '/chunkDeduce', label: '分块推导', icon: '🧩' },
  { path: '/longplan', label: '长篇规划', icon: '🚀' },
  { path: '/continue', label: '自动续写', icon: '✨' },
  { path: '/polish', label: '润色', icon: '✨' },
  { path: '/write', label: '写作区', icon: '✍️' },
  { path: '/plotview', label: '剧情观', icon: '📘' },
  { path: '/emotionFlow', label: '感情线', icon: '💕' },
  { path: '/lustCurve', label: '肉欲线', icon: '🔥' },
  { path: '/character', label: '角色', icon: '👤' },
  { path: '/world', label: '世界观', icon: '🌍' },
  { path: '/tags', label: '标签', icon: '🏷️' },
  { path: '/templates', label: '模板库', icon: '📦' },
  { path: '/memory', label: '记忆', icon: '🧠' },
  { path: '/chat', label: 'AI 对话', icon: '💬' },
  { path: '/export', label: '导出', icon: '📤' },
  { path: '/aimodel', label: 'AI 模型', icon: '🤖' },
  { path: '/logs', label: '日志', icon: '📋' },
  { path: '/settings', label: '设置', icon: '⚙️' },
]
