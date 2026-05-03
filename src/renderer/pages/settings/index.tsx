import { useState, useRef, useCallback } from 'react'
import { useAppStore } from '../../store'
import PageWrapper from '../../components/PageWrapper'

// ==========================================
// Tab 切换
// ==========================================
const TABS = [
  { key: 'general', label: '通用' },
  { key: 'export', label: '导出' },
  { key: 'ai', label: 'AI' },
  { key: 'data', label: '数据管理' },
] as const

type TabKey = typeof TABS[number]['key']

// ==========================================
// 辅助组件
// ==========================================
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '14px', fontWeight: 500, color: '#ccc', marginBottom: '12px' }}>{children}</div>
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px' }}>{children}</div>
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>{children}</div>
}

// ==========================================
// 主组件
// ==========================================
export default function SettingsPage() {
  const [tab, setTab] = useState<TabKey>('general')
  const [confirmReset, setConfirmReset] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /* ---- Store 数据 ---- */
  const fontSize = useAppStore((s) => s.fontSize)
  const autoSaveInterval = useAppStore((s) => s.autoSaveInterval)
  const autoBackup = useAppStore((s) => s.autoBackup)
  const defaultTemperature = useAppStore((s) => s.defaultTemperature)
  const defaultMaxTokens = useAppStore((s) => s.defaultMaxTokens)
  const apiTimeout = useAppStore((s) => s.apiTimeout)
  const adultMode = useAppStore((s) => s.adultMode)

  /* ---- Store Actions ---- */
  const setFontSize = useAppStore((s) => s.setFontSize)
  const setAutoSaveInterval = useAppStore((s) => s.setAutoSaveInterval)
  const setAutoBackup = useAppStore((s) => s.setAutoBackup)
  const setDefaultTemperature = useAppStore((s) => s.setDefaultTemperature)
  const setDefaultMaxTokens = useAppStore((s) => s.setDefaultMaxTokens)
  const setApiTimeout = useAppStore((s) => s.setApiTimeout)
  const toggleAdultMode = useAppStore((s) => s.toggleAdultMode)
  const exportProject = useAppStore((s) => s.exportProject)
  const loadProject = useAppStore((s) => s.loadProject)
  const resetAll = useAppStore((s) => s.resetAll)
  const addLog = useAppStore((s) => s.addLog)
  const currentNovel = useAppStore((s) => s.currentNovel)

  /* ---- 导出项目 ---- */
  const handleExport = useCallback(() => {
    const data = exportProject()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentNovel?.title || 'project'}_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    addLog({ type: 'success', message: '项目导出成功', detail: `文件名: ${a.download}` })
  }, [exportProject, currentNovel, addLog])

  /* ---- 导入项目 ---- */
  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result))
          loadProject(data)
          addLog({ type: 'success', message: '项目导入成功', detail: `文件: ${file.name}` })
        } catch {
          addLog({ type: 'error', message: '项目导入失败', detail: 'JSON 格式错误' })
        }
      }
      reader.readAsText(file)
      e.target.value = ''
    },
    [loadProject, addLog]
  )

  return (
    <PageWrapper title="设置中心">
      {/* Tab 栏 */}
      <div style={{ display: 'flex', gap: '4px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '4px', width: 'fit-content' }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '6px 16px', borderRadius: '6px', fontSize: '12px', border: 'none',
            background: tab === t.key ? '#6366f126' : 'transparent', color: tab === t.key ? '#6366f1' : '#888', cursor: 'pointer'
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'general' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Card>
            <SectionTitle>外观</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <Label>主题</Label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#666', padding: '6px 10px', borderRadius: '6px', background: '#0f0f0f', border: '1px solid #2a2a2a' }}>暗黑模式（固定）</span>
                </div>
              </div>
              <div>
                <Label>字体大小</Label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {([{ key: 'small' as const, label: '小' }, { key: 'medium' as const, label: '中' }, { key: 'large' as const, label: '大' }] as const).map((s) => (
                    <button key={s.key} onClick={() => setFontSize(s.key)} style={{
                      padding: '6px 12px', borderRadius: '6px', fontSize: '12px',
                      border: fontSize === s.key ? '1px solid #6366f140' : '1px solid #2a2a2a',
                      background: fontSize === s.key ? '#6366f126' : '#0f0f0f',
                      color: fontSize === s.key ? '#6366f1' : '#ccc', cursor: 'pointer'
                    }}>{s.label}</button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
          <Card>
            <SectionTitle>自动保存</SectionTitle>
            <div>
              <Label>自动保存间隔（分钟）</Label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[1, 3, 5, 10, 15].map((v) => (
                  <button key={v} onClick={() => setAutoSaveInterval(v)} style={{
                    padding: '6px 12px', borderRadius: '6px', fontSize: '12px',
                    border: autoSaveInterval === v ? '1px solid #6366f140' : '1px solid #2a2a2a',
                    background: autoSaveInterval === v ? '#6366f126' : '#0f0f0f',
                    color: autoSaveInterval === v ? '#6366f1' : '#ccc', cursor: 'pointer'
                  }}>{v} 分钟</button>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === 'export' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Card>
            <SectionTitle>导出选项</SectionTitle>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#ccc' }}>自动备份</div>
                <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>每次导出时自动生成带时间戳的备份文件</div>
              </div>
              <button onClick={() => setAutoBackup(!autoBackup)} style={{ width: '40px', height: '20px', borderRadius: '9999px', position: 'relative', background: autoBackup ? '#6366f1' : '#333', border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}>
                <span style={{ position: 'absolute', top: '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', left: autoBackup ? '22px' : '2px', transition: 'left 0.2s' }} />
              </button>
            </div>
          </Card>
        </div>
      )}

      {tab === 'ai' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Card>
            <SectionTitle>默认 AI 参数</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <Label>Temperature（随机性）</Label>
                  <span style={{ fontSize: '12px', color: '#6366f1', fontWeight: 500 }}>{defaultTemperature.toFixed(1)}</span>
                </div>
                <input type="range" min={0} max={2} step={0.1} value={defaultTemperature} onChange={(e) => setDefaultTemperature(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#6366f1', height: '4px', background: '#333', borderRadius: '8px', cursor: 'pointer' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#555', marginTop: '4px' }}>
                  <span>保守 0</span><span>平衡 1</span><span>创意 2</span>
                </div>
              </div>
              <div>
                <Label>最大 Token 数</Label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[1024, 2048, 4096, 8192, 16384].map((v) => (
                    <button key={v} onClick={() => setDefaultMaxTokens(v)} style={{
                      padding: '6px 12px', borderRadius: '6px', fontSize: '12px',
                      border: defaultMaxTokens === v ? '1px solid #6366f140' : '1px solid #2a2a2a',
                      background: defaultMaxTokens === v ? '#6366f126' : '#0f0f0f',
                      color: defaultMaxTokens === v ? '#6366f1' : '#ccc', cursor: 'pointer'
                    }}>{v.toLocaleString()}</button>
                  ))}
                </div>
              </div>
              <div>
                <Label>API 超时时间（秒）</Label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[15, 30, 45, 60, 90, 120].map((v) => (
                    <button key={v} onClick={() => setApiTimeout(v)} style={{
                      padding: '6px 12px', borderRadius: '6px', fontSize: '12px',
                      border: apiTimeout === v ? '1px solid #6366f140' : '1px solid #2a2a2a',
                      background: apiTimeout === v ? '#6366f126' : '#0f0f0f',
                      color: apiTimeout === v ? '#6366f1' : '#ccc', cursor: 'pointer'
                    }}>{v}s</button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === 'data' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Card>
            <SectionTitle>项目数据</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '12px', color: '#ccc' }}>导出当前项目（JSON）</div>
                <button onClick={handleExport} style={{ background: '#6366f126', color: '#6366f1', border: '1px solid #6366f140', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>导出项目</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '12px', color: '#ccc' }}>导入项目（JSON）</div>
                <button onClick={() => fileInputRef.current?.click()} style={{ background: '#1a1a1a', color: '#ccc', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>导入项目</button>
                <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
              </div>
            </div>
          </Card>
          <Card>
            <SectionTitle>危险操作</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#ccc' }}>成人模式</div>
                  <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>开启后将显示成人内容相关功能</div>
                </div>
                <button onClick={toggleAdultMode} style={{ width: '40px', height: '20px', borderRadius: '9999px', position: 'relative', background: adultMode ? '#6366f1' : '#333', border: 'none', cursor: 'pointer' }}>
                  <span style={{ position: 'absolute', top: '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', left: adultMode ? '22px' : '2px', transition: 'left 0.2s' }} />
                </button>
              </div>
              <div style={{ borderTop: '1px solid #252525', paddingTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#ef4444' }}>清除所有数据</div>
                  <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>删除所有小说、角色、章节、记忆等数据，不可恢复</div>
                </div>
                <button onClick={() => setConfirmReset(true)} style={{ background: '#ef444410', color: '#ef4444', border: '1px solid #ef444430', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>清除全部</button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {confirmReset && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#00000099', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', width: '90%', maxWidth: '384px', padding: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#ef4444', marginBottom: '12px' }}>确认清除所有数据</div>
            <p style={{ fontSize: '14px', color: '#e0e0e0', margin: '0 0 16px' }}>此操作将永久删除所有项目数据，包括小说、角色、章节、记忆、标签等。此操作不可撤销。</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { resetAll(); setConfirmReset(false); addLog({ type: 'warn', message: '已清除所有数据', detail: null }) }} style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', fontSize: '12px', background: '#ef444410', color: '#ef4444', border: '1px solid #ef444430', cursor: 'pointer' }}>确认清除</button>
              <button onClick={() => setConfirmReset(false)} style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', fontSize: '12px', background: '#1a1a1a', color: '#ccc', border: '1px solid #333', cursor: 'pointer' }}>取消</button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  )
}
