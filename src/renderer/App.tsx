import { useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { useStore } from './store'
import Sidebar from './components/Sidebar'
import ErrorBoundary from './components/ErrorBoundary'
import Dashboard from './pages/dashboard'
import Deduce from './core/deduce'
import LongPlan from './core/longPlan'
import ContinueWrite from './core/continue'
import Polish from './core/polish'
import Character from './modules/character'
import World from './modules/world'
import PlotView from './modules/plotView'
import Tags from './modules/tags'
import Memory from './modules/memory'
import AIModel from './pages/aiModel'
import Chat from './modules/chat'
import Logs from './pages/logs'
import Settings from './pages/settings'

function App() {
  const validateCurrentModel = useStore((s) => s.validateCurrentModel)

  useEffect(() => {
    // 启动时校验 AI 模型状态：持久化的 currentModel 若不存在则自动选第一个
    validateCurrentModel()
  }, [])

  return (
    <HashRouter>
      <div style={{ display: 'flex', height: '100vh', width: '100vw', background: '#0f0f0f', color: '#e0e0e0', overflow: 'hidden' }}>
        <Sidebar />
        <main style={{ 
          flex: 1, 
          overflow: 'auto', 
          padding: '24px',
          display: 'block',
          textAlign: 'left'
        }}>
          <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/deduce" element={<Deduce />} />
            <Route path="/longplan" element={<LongPlan />} />
            <Route path="/continue" element={<ContinueWrite />} />
            <Route path="/polish" element={<Polish />} />
            <Route path="/character" element={<Character />} />
            <Route path="/world" element={<World />} />
            <Route path="/plotview" element={<PlotView />} />
            <Route path="/tags" element={<Tags />} />
            <Route path="/memory" element={<Memory />} />
            <Route path="/aimodel" element={<AIModel />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </HashRouter>
  )
}

export default App