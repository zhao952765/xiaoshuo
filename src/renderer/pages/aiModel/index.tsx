import { useState } from 'react'
import PageWrapper from '../../components/PageWrapper'
import { useStore } from '../../store'

interface ModelForm {
  id: string
  name: string
  modelType: string
  baseUrl: string
  modelId: string
  apiKey: string
  temperature: number
  maxTokens: number
  stream: boolean
}

const MODEL_TYPES = ['OpenAI', 'Anthropic', 'Google', 'Azure', 'DeepSeek', '月之暗面', '通义千问', '百度千帆', '硅基流动', '本地', '自定义']

const DEFAULTS: Record<string, Partial<ModelForm>> = {
  OpenAI: { baseUrl: 'https://api.openai.com/v1', modelId: 'gpt-4o-mini', temperature: 0.7, maxTokens: 2048 },
  Anthropic: { baseUrl: 'https://api.anthropic.com', modelId: 'claude-3-haiku-20240307', temperature: 0.7, maxTokens: 4096 },
  Google: { baseUrl: 'https://generativelanguage.googleapis.com', modelId: 'gemini-pro', temperature: 0.7, maxTokens: 2048 },
  Azure: { baseUrl: 'https://your-resource.openai.azure.com', modelId: 'gpt-4', temperature: 0.7, maxTokens: 2048 },
  DeepSeek: { baseUrl: 'https://api.deepseek.com', modelId: 'deepseek-chat', temperature: 0.7, maxTokens: 4096 },
  '月之暗面': { baseUrl: 'https://api.moonshot.cn/v1', modelId: 'moonshot-v1-8k', temperature: 0.7, maxTokens: 4096 },
  '通义千问': { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', modelId: 'qwen-turbo', temperature: 0.7, maxTokens: 4096 },
  '百度千帆': { baseUrl: 'https://aip.baidubce.com', modelId: 'ERNIE-Bot', temperature: 0.7, maxTokens: 2048 },
  '硅基流动': { baseUrl: 'https://api.siliconflow.cn/v1', modelId: 'Qwen/Qwen2.5-7B-Instruct', temperature: 0.7, maxTokens: 4096 },
  本地: { baseUrl: 'http://localhost:11434/v1', modelId: 'llama2', temperature: 0.7, maxTokens: 2048 },
  自定义: { baseUrl: '', modelId: '', temperature: 0.7, maxTokens: 2048 },
}

/** 测试模型连接 */
async function testConnection(model: { baseUrl: string; apiKey: string; modelId: string }): Promise<string> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 10000)
    const res = await fetch(`${model.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${model.apiKey}` },
      body: JSON.stringify({ model: model.modelId, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }),
    })
    clearTimeout(timer)
    if (!res.ok) return `❌ HTTP ${res.status}`
    const data = await res.json()
    return data?.choices?.[0]?.message?.content !== undefined ? '✅ 连接成功' : '❌ 返回格式异常'
  } catch (e: any) {
    return `❌ ${e.name === 'AbortError' ? '连接超时' : e.message?.slice(0, 100) || '连接失败'}`
  }
}

/** 从 API 拉取模型列表 */
async function fetchModelList(model: { baseUrl: string; apiKey: string }): Promise<string[]> {
  const base = model.baseUrl.replace(/\/+$/, '').replace('/v1', '')
  const res = await fetch(`${base}/models`, {
    headers: { Authorization: `Bearer ${model.apiKey}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return (data.data || data).map((m: any) => m.id || m).filter(Boolean)
}

export default function AIModel() {
  const models = useStore((s) => s.aiModels)
  const addModel = useStore((s) => s.addModel)
  const updateModel = useStore((s) => s.updateModel)
  const removeModel = useStore((s) => s.removeModel)
  const setCurrentModel = useStore((s) => s.setCurrentModel)
  const currentModel = useStore((s) => s.currentModel)

  const [showModal, setShowModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [testResults, setTestResults] = useState<Record<string, string>>({})
  const [testingId, setTestingId] = useState<string | null>(null)
  const [fetchedModelList, setFetchedModelList] = useState<Record<string, string[]>>({})
  const [form, setForm] = useState<ModelForm>({
    id: '',
    name: '',
    modelType: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    modelId: 'gpt-4o-mini',
    apiKey: '',
    temperature: 0.7,
    maxTokens: 2048,
    stream: true,
  })

  const openModal = () => {
    setIsEditing(false)
    setForm({
      id: Date.now().toString(),
      name: '',
      modelType: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      modelId: 'gpt-4o-mini',
      apiKey: '',
      temperature: 0.7,
      maxTokens: 2048,
      stream: true,
    })
    setShowModal(true)
  }

  const editModel = (m: typeof models[0]) => {
    setIsEditing(true)
    setForm({
      id: m.id,
      name: m.name,
      modelType: m.modelType,
      baseUrl: m.baseUrl,
      modelId: m.modelId,
      apiKey: m.apiKey,
      temperature: m.temperature,
      maxTokens: m.maxTokens,
      stream: m.stream,
    })
    setShowModal(true)
  }

  const handleTypeChange = (type: string) => {
    const defaults = DEFAULTS[type] || {}
    setForm((prev) => ({
      ...prev,
      modelType: type,
      // 自动填充显示名称：如果 name 为空或是上一个类型的默认名，则自动更新
      name: !prev.name || Object.keys(DEFAULTS).some((k) => prev.name === k)
        ? type
        : prev.name,
      baseUrl: defaults.baseUrl || prev.baseUrl,
      modelId: defaults.modelId || prev.modelId,
      temperature: defaults.temperature ?? prev.temperature,
      maxTokens: defaults.maxTokens ?? prev.maxTokens,
    }))
  }

  const save = () => {
    if (!form.name.trim()) return
    if (isEditing) {
      updateModel(form.id, { ...form, updatedAt: Date.now() } as any)
    } else {
      addModel({ ...form, isDefault: false, createdAt: Date.now(), updatedAt: Date.now() } as any)
    }
    setShowModal(false)
  }

  const handleTest = async (m: typeof models[0]) => {
    setTestingId(m.id)
    setTestResults((prev) => ({ ...prev, [m.id]: '测试中...' }))
    const result = await testConnection(m)
    setTestResults((prev) => ({ ...prev, [m.id]: result }))
    setTestingId(null)
  }

  const handleFetchModels = async (m: typeof models[0]) => {
    setTestingId(m.id)
    setTestResults((prev) => ({ ...prev, [m.id]: '正在获取模型列表...' }))
    try {
      const list = await fetchModelList(m)
      setFetchedModelList((prev) => ({ ...prev, [m.id]: list }))
      setTestResults((prev) => ({ ...prev, [m.id]: `✅ 获取到 ${list.length} 个模型，点击下方列表项可应用` }))
    } catch (e: any) {
      setTestResults((prev) => ({ ...prev, [m.id]: `❌ ${e.message?.slice(0, 80) || '获取失败'}` }))
    }
    setTestingId(null)
  }

  const applyFetchedModel = (modelId: string, fetchedModel: string) => {
    updateModel(modelId, { modelId: fetchedModel } as any)
    setFetchedModelList((prev) => ({ ...prev, [modelId]: [] }))
    setTestResults((prev) => ({ ...prev, [modelId]: `✅ 已应用模型: ${fetchedModel}` }))
  }

  return (
    <PageWrapper
      title="AI 模型中心"
      subtitle="配置和管理你的 AI 模型"
      actions={
        <button
          onClick={openModal}
          style={{
            padding: '8px 16px',
            background: '#6366f1',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          + 添加模型
        </button>
      }
    >
      {/* 模型列表 */}
      {models.length === 0 ? (
        <div
          style={{
            background: '#1a1a1a',
            border: '1px solid #2a2a2a',
            borderRadius: '12px',
            padding: '60px 16px',
            textAlign: 'center',
          }}
        >
          <p style={{ color: '#666', margin: 0 }}>暂无模型，点击右上角添加</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {models.map((m) => (
            <div
              key={m.id}
              style={{
                background: '#1a1a1a',
                border: currentModel?.id === m.id ? '1px solid #6366f1' : '1px solid #2a2a2a',
                borderRadius: '12px',
                padding: '16px 20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: currentModel?.id === m.id ? 'rgba(99,102,241,0.15)' : 'rgba(168,85,247,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    flexShrink: 0,
                  }}
                >
                  {'🤖'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '2px' }}>
                    {m.name}
                    {currentModel?.id === m.id && (
                      <span
                        style={{
                          marginLeft: '8px',
                          padding: '2px 8px',
                          background: 'rgba(99,102,241,0.15)',
                          color: '#6366f1',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 500,
                        }}
                      >
                        默认
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: '#888' }}>
                    {m.modelType} · {m.modelId} · {m.baseUrl}
                  </div>
                </div>
              </div>

              {/* 测试结果 */}
              {testResults[m.id] && (
                <div style={{ fontSize: '12px', color: testResults[m.id].startsWith('✅') ? '#4ade80' : '#f87171', marginBottom: '8px', padding: '6px 10px', background: '#0f0f0f', borderRadius: '6px' }}>
                  {testResults[m.id]}
                </div>
              )}

              {/* 获取到的模型列表 */}
              {fetchedModelList[m.id] && fetchedModelList[m.id].length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px', padding: '8px 10px', background: '#0f0f0f', borderRadius: '8px' }}>
                  {fetchedModelList[m.id].map((name) => (
                    <button
                      key={name}
                      onClick={() => applyFetchedModel(m.id, name)}
                      style={{
                        padding: '4px 10px',
                        background: 'rgba(99,102,241,0.1)',
                        border: '1px solid rgba(99,102,241,0.3)',
                        borderRadius: '6px',
                        color: '#818cf8',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.25)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)' }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleTest(m)}
                  disabled={testingId === m.id}
                  style={{
                    padding: '6px 14px',
                    background: '#2a2a2a',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    color: '#e0e0e0',
                    fontSize: '13px',
                    cursor: testingId === m.id ? 'not-allowed' : 'pointer',
                    opacity: testingId === m.id ? 0.6 : 1,
                  }}
                >
                  {testingId === m.id ? '测试中...' : '测试连接'}
                </button>
                <button
                  onClick={() => handleFetchModels(m)}
                  disabled={testingId === m.id}
                  style={{
                    padding: '6px 14px',
                    background: '#2a2a2a',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    color: '#e0e0e0',
                    fontSize: '13px',
                    cursor: testingId === m.id ? 'not-allowed' : 'pointer',
                    opacity: testingId === m.id ? 0.6 : 1,
                  }}
                >
                  {testingId === m.id ? '获取中...' : '获取模型'}
                </button>
                <button
                  onClick={() => editModel(m)}
                  style={{
                    padding: '6px 14px',
                    background: '#2a2a2a',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    color: '#e0e0e0',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  编辑
                </button>
                {currentModel?.id !== m.id && (
                  <button
                    onClick={() => setCurrentModel(m)}
                    style={{
                      padding: '6px 14px',
                      background: '#2a2a2a',
                      border: '1px solid #333',
                      borderRadius: '6px',
                      color: '#e0e0e0',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    设为默认
                  </button>
                )}
                <button
                  onClick={() => removeModel(m.id)}
                  style={{
                    padding: '6px 14px',
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: '6px',
                    color: '#ef4444',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== 添加模型弹窗 ===== */}
      {showModal && (
        <>
          <div
            onClick={() => setShowModal(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.7)',
              zIndex: 100,
            }}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '480px',
              maxHeight: '85vh',
              overflowY: 'auto',
              background: '#1a1a1a',
              border: '1px solid #2a2a2a',
              borderRadius: '14px',
              padding: '24px',
              zIndex: 101,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#fff' }}>{isEditing ? '编辑模型' : '添加模型'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '6px', fontWeight: 500 }}>显示名称</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如：DeepSeek V3" style={{ width: '100%', padding: '10px 14px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '6px', fontWeight: 500 }}>模型类型</label>
                <select value={form.modelType} onChange={(e) => handleTypeChange(e.target.value)} style={{ width: '100%', padding: '10px 14px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box', cursor: 'pointer' }}>
                  {MODEL_TYPES.map((t) => <option key={t} value={t} style={{ background: '#1a1a1a', color: '#e0e0e0' }}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '6px', fontWeight: 500 }}>Base URL</label>
                <input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder="https://api.deepseek.com" style={{ width: '100%', padding: '10px 14px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '6px', fontWeight: 500 }}>模型 ID</label>
                <input value={form.modelId} onChange={(e) => setForm({ ...form, modelId: e.target.value })} placeholder="deepseek-chat" style={{ width: '100%', padding: '10px 14px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '6px', fontWeight: 500 }}>API Key</label>
                <input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder="sk-..." style={{ width: '100%', padding: '10px 14px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '6px', fontWeight: 500 }}>Temperature ({form.temperature})</label>
                <input type="range" min={0} max={2} step={0.1} value={form.temperature} onChange={(e) => setForm({ ...form, temperature: parseFloat(e.target.value) })} style={{ width: '100%', accentColor: '#6366f1' }} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '6px', fontWeight: 500 }}>Max Tokens ({form.maxTokens})</label>
                <input type="range" min={256} max={8192} step={256} value={form.maxTokens} onChange={(e) => setForm({ ...form, maxTokens: parseInt(e.target.value) })} style={{ width: '100%', accentColor: '#6366f1' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="stream" checked={form.stream} onChange={(e) => setForm({ ...form, stream: e.target.checked })} style={{ width: '16px', height: '16px', accentColor: '#6366f1', cursor: 'pointer' }} />
                <label htmlFor="stream" style={{ color: '#e0e0e0', fontSize: '14px', cursor: 'pointer' }}>启用流式输出</label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #2a2a2a' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '10px 20px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', cursor: 'pointer' }}>取消</button>
              <button onClick={save} style={{ padding: '10px 20px', background: '#6366f1', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px', cursor: 'pointer', fontWeight: 500 }}>保存</button>
            </div>
          </div>
        </>
      )}
    </PageWrapper>
  )
}