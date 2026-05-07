/**
 * 主应用 - 性能优化版
 * - React.lazy 按需加载所有页面
 * - 移除冗余错误边界
 * - 优化持久化
 */
import { useEffect, lazy, Suspense, memo } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { useStore, saveNow } from './store'
import Sidebar from './components/Sidebar'
import { LoadingFallback } from './components/ui'

// 按需加载页面（tree-shake 友好）
const Dashboard = lazy(() => import('./pages/dashboard'))
const Deduce = lazy(() => import('./pages/deduce'))
const LongPlan = lazy(() => import('./pages/longPlan'))
const ContinueWrite = lazy(() => import('./pages/continue'))
const Polish = lazy(() => import('./pages/polish'))
const Character = lazy(() => import('./pages/character'))
const World = lazy(() => import('./pages/world'))
const PlotView = lazy(() => import('./pages/plotView'))
const Tags = lazy(() => import('./pages/tags'))
const Memory = lazy(() => import('./pages/memory'))
const AIModel = lazy(() => import('./pages/aiModel'))
const Chat = lazy(() => import('./pages/chat'))
const Logs = lazy(() => import('./pages/logs'))
const Settings = lazy(() => import('./pages/settings'))

function App() {
  const validateCurrentModel = useStore((s) => s.validateCurrentModel);

  useEffect(() => {
    validateCurrentModel();
    const task = useStore.getState().deduceTask;
    if (task?.isRunning) {
      useStore.getState().failDeduceTask('上次推导已被中断，请重新开始');
    }
  }, []);

  // 退出/隐藏标签页时强制持久化
  useEffect(() => {
    const handleBeforeUnload = () => saveNow();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') saveNow();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <HashRouter>
      <div style={{ display: 'flex', height: '100vh', width: '100vw', background: '#0f0f0f', overflow: 'hidden' }}>
        <Sidebar />
        <main style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
          <Suspense fallback={<LoadingFallback />}>
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
          </Suspense>
        </main>
      </div>
    </HashRouter>
  )
}

export default App
