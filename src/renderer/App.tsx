import { useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { useStore } from './store'
import Sidebar from './components/Sidebar'
import ErrorBoundary from './components/ErrorBoundary'
import SafeRender from './components/SafeRender'
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
  const validateCurrentModel = useStore((s) => s.validateCurrentModel);

  useEffect(() => {
    // 启动时校验 AI 模型状态
    validateCurrentModel();
    // 修复：如果 deduceTask 持久化了 isRunning=true（上次推导被中断），重置为失败状态
    const task = useStore.getState().deduceTask;
    if (task?.isRunning) {
      useStore.getState().failDeduceTask('上次推导已被中断，请重新开始');
    }
  }, []);

  useEffect(() => {
    // 退出/刷新/关闭窗口前强制持久化所有数据
    const handleBeforeUnload = () => {
      try {
        // zustand persist 自动同步到 localStorage，这里确保最后一次变更已写入
        const state = useStore.getState();
        localStorage.setItem('private-novel-studio-pro-storage', JSON.stringify({
          state: {
            currentNovel: state.currentNovel,
            characters: state.characters,
            worldSettings: state.worldSettings,
            chapters: state.chapters,
            volumes: state.volumes,
            plotLines: state.plotLines,
            tags: state.tags,
            memories: state.memories,
            logs: state.logs,
            aiModels: state.aiModels,
            currentModel: state.currentModel,
            adultMode: state.adultMode,
            conversations: state.conversations,
            emotionEvents: state.emotionEvents,
            outlineNodes: state.outlineNodes,
            selectedTagIds: state.selectedTagIds,
            fontSize: state.fontSize,
            autoSaveInterval: state.autoSaveInterval,
            autoBackup: state.autoBackup,
            defaultTemperature: state.defaultTemperature,
            defaultMaxTokens: state.defaultMaxTokens,
            apiTimeout: state.apiTimeout,
            deduceTask: state.deduceTask,
          },
          version: 0,
        }));
      } catch (e) {
        console.error('保存数据时出错:', e);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

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
            <Route path="/" element={<SafeRender><Dashboard /></SafeRender>} />
            <Route path="/deduce" element={<SafeRender><Deduce /></SafeRender>} />
            <Route path="/longplan" element={<SafeRender><LongPlan /></SafeRender>} />
            <Route path="/continue" element={<SafeRender><ContinueWrite /></SafeRender>} />
            <Route path="/polish" element={<SafeRender><Polish /></SafeRender>} />
            <Route path="/character" element={<SafeRender><Character /></SafeRender>} />
            <Route path="/world" element={<SafeRender><World /></SafeRender>} />
            <Route path="/plotview" element={<SafeRender><PlotView /></SafeRender>} />
            <Route path="/tags" element={<SafeRender><Tags /></SafeRender>} />
            <Route path="/memory" element={<SafeRender><Memory /></SafeRender>} />
            <Route path="/aimodel" element={<SafeRender><AIModel /></SafeRender>} />
            <Route path="/chat" element={<SafeRender><Chat /></SafeRender>} />
            <Route path="/logs" element={<SafeRender><Logs /></SafeRender>} />
            <Route path="/settings" element={<SafeRender><Settings /></SafeRender>} />
          </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </HashRouter>
  )
}

export default App