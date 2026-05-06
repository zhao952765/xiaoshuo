/**
 * 路由配置 - SRS v2.3 完整版
 * 9大模块导航 + 新增模块路由
 */

import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

// 核心页面
import DashboardPage from './pages/dashboard'
import DeducePage from './core/deduce'
import PlotView from './modules/plotView'
import WritePage from './core/write'
import PolishPage from './core/polish'
import ChatPage from './modules/chat'
import TagsPage from './modules/tags'
import AIModelPage from './pages/aiModel'
import TemplatesPage from './modules/templates'
import ExportPage from './pages/export'
import MemoryPage from './modules/memory'
import SettingsPage from './pages/settings'

export const NAV_ITEMS = [
  { path: '/', label: '仪表盘', icon: '📊', component: DashboardPage },
  { path: '/deduce', label: '一键推导', icon: '🎯', component: DeducePage },
  { path: '/plot', label: '编辑中心', icon: '📘', component: PlotView },
  { path: '/write', label: '写作区', icon: '✍️', component: WritePage },
  { path: '/polish', label: '润色区', icon: '✨', component: PolishPage },
  { path: '/chat', label: 'AI 对话', icon: '💬', component: ChatPage },
  { path: '/tags', label: '智能标签', icon: '🏷️', component: TagsPage },
  { path: '/aimodel', label: 'AI 模型', icon: '🤖', component: AIModelPage },
  { path: '/templates', label: '模板库', icon: '📦', component: TemplatesPage },
  { path: '/export', label: '导出中心', icon: '📤', component: ExportPage },
  { path: '/memory', label: '记忆系统', icon: '🧠', component: MemoryPage },
  { path: '/settings', label: '设置', icon: '⚙️', component: SettingsPage },
]

export default function AppRoutes() {
  return (
    <Routes>
      {NAV_ITEMS.map((item) => (
        <Route key={item.path} path={item.path} element={<item.component />} />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
