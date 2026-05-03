import { HashRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
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
        </main>
      </div>
    </HashRouter>
  )
}

export default App