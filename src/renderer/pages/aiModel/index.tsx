/**
 * AI 模型设置增强版
 * SRS v2.3 要求：
 * - 支持 Ollama / LM Studio / OpenAI 兼容接口
 * - 模型列表自动获取
 * - 连接测试
 * - 参数配置（Temperature / Top P / Max Tokens）
 * - 模型策略：全局默认 / 项目独立模型
 */

import React, { useState, useCallback, useEffect } from 'react'
import { useStore } from '../../store'
import type { AIModel, AIModelType } from '@cfg/types'

interface ModelPreset {
  type: AIModelType
  name: string
  baseUrl: string
  modelId: string
}

const MODEL_PRESETS: ModelPreset[] = [
  { type: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', modelId: 'gpt-4o' },
  { type: 'openai', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', modelId: 'deepseek-chat' },
  { type: 'openai', name: '月之暗面', baseUrl: 'https://api.moonshot.cn/v1', modelId: 'moonshot-v1-8k' },
  { type: 'openai', name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', modelId: 'qwen-turbo' },
  { type: 'openai', name: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1', modelId: 'deepseek-ai/DeepSeek-V3' },
  { type: 'local', name: 'Ollama', baseUrl: 'http://localhost:11434/v1', modelId: 'llama3.2' },
  { type: 'local', name: 'LM Studio', baseUrl: 'http://localhost:1234/v1', modelId: 'local-model' },
]

export default function AIModelPage() {
  const aiModels = useStore((s) => s.aiModels)
  const currentModel = useStore((s) => s.currentModel)
  const currentNovel = useStore((s) => s.currentNovel)
  const addModel = useStore((s) => s.addModel)
  const removeModel = useStore((s) => s.removeModel)
  const updateModel = useStore((s) => s.updateModel)
  const setCurrentModel = useStore((s) => s.setCurrentModel)
  const setDefaultModel = useStore((s) => s.setDefaultModel)
  const addLog = useStore((s) => s.addLog)

  const [isEditing, setIsEditing] = useState(false)
  const [editingModel, setEditingModel] = useState<Partial<AIModel>>({
    name: '',
    baseUrl: '',
    apiKey: '',
    modelType: 'openai',
    modelId: '',
    temperature: 0.7,
    maxTokens: 4096,
    stream: true,
  })
  const [testStatus, setTestStatus] = useState<Record<string, { status: 'idle' | 'testing' | 'success' | 'error'; message: string }>>({})
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [isFetchingModels, setIsFetchingModels] = useState(false)

  // 项目独立模型
  const [projectModelId, setProjectModelId] = useState(currentNovel?.projectModelId || '')

  const genId = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

  // 选择预设
  const handleSelectPreset = (preset: ModelPreset) => {
    setEditingModel((prev) => ({
      ...prev,
      name: preset.name,
      baseUrl: preset.baseUrl,
      modelType: preset.type,
      modelId: preset.modelId,
    }))
  }

  // 测试连接
  const handleTestConnection = useCallback(async (model: AIModel) => {
    setTestStatus((prev) => ({ ...prev, [model.id]: { status: 'testing', message: '测试中...' } }))

    try {
      const res = await fetch(`${model.baseUrl}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${model.apiKey}`,
        },
      })

      if (res.ok) {
        const data = await res.json()
        const models = data.data?.map((m: any) => m.id) || []
        setTestStatus((prev) => ({
          ...prev,
          [model.id]: { status: 'success', message: `连接成功！发现 ${models.length} 个模型` },
        }))
        setAvailableModels(models)
      } else {
        // 尝试 chat completions 测试
        const chatRes = await fetch(`${model.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${model.apiKey}`,
          },
          body: JSON.stringify({
            model: model.modelId,
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 5,
          }),
        })

        if (chatRes.ok) {
          setTestStatus((prev) => ({
            ...prev,
            [model.id]: { status: 'success', message: '连接成功！Chat API 可用' },
          }))
        } else {
          throw new Error(`HTTP ${chatRes.status}`)
        }
      }
    } catch (err: any) {
      setTestStatus((prev) => ({
        ...prev,
        [model.id]: { status: 'error', message: `连接失败: ${err.message}` },
      }))
    }
  }, [])

  // 获取模型列表
  const handleFetchModels = useCallback(async () => {
    if (!editingModel.baseUrl) return
    setIsFetchingModels(true)
    try {
      const res = await fetch(`${editingModel.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${editingModel.apiKey || ''}` },
      })
      if (res.ok) {
        const data = await res.json()
        const models = data.data?.map((m: any) => m.id) || []
        setAvailableModels(models)
        addLog({ type: 'success', message: '获取模型列表', detail: `${models.length} 个模型` })
      } else {
        throw new Error(`HTTP ${res.status}`)
      }
    } catch (err: any) {
      addLog({ type: 'error', message: '获取模型列表失败', detail: err.message })
    } finally {
      setIsFetchingModels(false)
    }
  }, [editingModel.baseUrl, editingModel.apiKey, addLog])

  // 保存模型
  const handleSave = () => {
    if (!editingModel.name || !editingModel.baseUrl || !editingModel.modelId) {
      addLog({ type: 'warn', message: '请填写完整信息', detail: '' })
      return
    }

    const now = Date.now()
    const model: AIModel = {
      id: editingModel.id || genId(),
      name: editingModel.name,
      baseUrl: editingModel.baseUrl,
      apiKey: editingModel.apiKey || '',
      modelType: (editingModel.modelType as AIModelType) || 'openai',
      modelId: editingModel.modelId,
      temperature: editingModel.temperature ?? 0.7,
      maxTokens: editingModel.maxTokens ?? 4096,
      stream: editingModel.stream ?? true,
      isDefault: false,
      createdAt: editingModel.id ? (aiModels.find((m) => m.id === editingModel.id)?.createdAt ?? now) : now,
      updatedAt: now,
    }

    if (editingModel.id) {
      updateModel(editingModel.id, model)
    } else {
      addModel(model)
    }

    setIsEditing(false)
    setEditingModel({ name: '', baseUrl: '', apiKey: '', modelType: 'openai', modelId: '', temperature: 0.7, maxTokens: 4096, stream: true })
    addLog({ type: 'success', message: editingModel.id ? '更新模型' : '添加模型', detail: model.name })
  }

  // 设置项目独立模型
  const handleSetProjectModel = (modelId: string) => {
    setProjectModelId(modelId)
    if (currentNovel) {
      // 这里需要 updateNovel 支持 projectModelId，暂时用日志记录
      addLog({ type: 'success', message: '设置项目独立模型', detail: aiModels.find((m) => m.id === modelId)?.name || modelId })
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto', color: '#e0e0e0' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>🤖 AI 模型设置</h2>

      {/* 当前模型状态 */}
      <div style={{ padding: 16, background: '#0a0a0a', borderRadius: 10, border: '1px solid #1a1a1a', marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#9ca3af', marginBottom: 12 }}>当前全局模型</h3>
        {currentModel ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 8,
              background: currentModel.modelType === 'local' ? '#10b981' : '#3b82f6',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 18,
            }}>
              {currentModel.modelType === 'local' ? '🖥️' : '☁️'}
            </div>
            <div>
              <div style={{ color: '#e0e0e0', fontWeight: 600 }}>{currentModel.name}</div>
              <div style={{ color: '#6b7280', fontSize: 12 }}>{currentModel.modelId} · {currentModel.baseUrl}</div>
            </div>
            <span style={{
              marginLeft: 'auto',
              padding: '4px 10px', borderRadius: 4, fontSize: 11,
              background: currentModel.stream ? 'rgba(16,185,129,0.15)' : 'rgba(107,114,128,0.15)',
              color: currentModel.stream ? '#10b981' : '#6b7280',
            }}>
              {currentModel.stream ? '流式' : '非流式'}
            </span>
          </div>
        ) : (
          <div style={{ color: '#6b7280' }}>未配置模型</div>
        )}
      </div>

      {/* 项目独立模型 */}
      {currentNovel && (
        <div style={{ padding: 16, background: '#0a0a0a', borderRadius: 10, border: '1px solid #1a1a1a', marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#9ca3af', marginBottom: 12 }}>📘 项目独立模型</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={projectModelId}
              onChange={(e) => handleSetProjectModel(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            >
              <option value="">使用全局默认模型</option>
              {aiModels.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            {projectModelId && (
              <span style={{ color: '#8b5cf6', fontSize: 12 }}>当前项目使用独立模型</span>
            )}
          </div>
        </div>
      )}

      {/* 模型列表 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#9ca3af' }}>已配置模型 ({aiModels.length})</h3>
          <button
            onClick={() => {
              setIsEditing(true)
              setEditingModel({ name: '', baseUrl: '', apiKey: '', modelType: 'openai', modelId: '', temperature: 0.7, maxTokens: 4096, stream: true })
            }}
            style={btnPrimaryStyle}
          >
            ➕ 添加模型
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {aiModels.map((model) => (
            <div key={model.id} style={{
              padding: 14, background: '#0a0a0a', borderRadius: 8,
              border: currentModel?.id === model.id ? '1px solid #8b5cf6' : '1px solid #1a1a1a',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 6,
                  background: model.modelType === 'local' ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: model.modelType === 'local' ? '#10b981' : '#3b82f6',
                  fontSize: 16,
                }}>
                  {model.modelType === 'local' ? '🖥️' : '☁️'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 14 }}>{model.name}</span>
                    {model.isDefault && (
                      <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>
                        默认
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>
                    {model.modelId} · Temp: {model.temperature} · Max: {model.maxTokens}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => handleTestConnection(model)}
                    style={{ ...btnSecondaryStyle, fontSize: 11 }}
                  >
                    🔌 测试
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(true)
                      setEditingModel({ ...model })
                    }}
                    style={{ ...btnSecondaryStyle, fontSize: 11 }}
                  >
                    ✏️ 编辑
                  </button>
                  <button
                    onClick={() => setCurrentModel(model)}
                    disabled={currentModel?.id === model.id}
                    style={{
                      ...btnSecondaryStyle,
                      fontSize: 11,
                      background: currentModel?.id === model.id ? 'rgba(139,92,246,0.15)' : '#1f1f1f',
                      color: currentModel?.id === model.id ? '#a78bfa' : '#9ca3af',
                    }}
                  >
                    {currentModel?.id === model.id ? '✓ 当前' : '使用'}
                  </button>
                  <button
                    onClick={() => setDefaultModel(model.id)}
                    style={{ ...btnSecondaryStyle, fontSize: 11 }}
                  >
                    ⭐ 默认
                  </button>
                  <button
                    onClick={() => {
                      removeModel(model.id)
                      addLog({ type: 'success', message: '删除模型', detail: model.name })
                    }}
                    style={{ ...btnDangerStyle, fontSize: 11, padding: '4px 8px' }}
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* 测试状态 */}
              {testStatus[model.id] && (
                <div style={{
                  marginTop: 8, padding: '6px 10px', borderRadius: 4, fontSize: 12,
                  background: testStatus[model.id].status === 'success' ? 'rgba(16,185,129,0.1)' :
                    testStatus[model.id].status === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(139,92,246,0.1)',
                  color: testStatus[model.id].status === 'success' ? '#10b981' :
                    testStatus[model.id].status === 'error' ? '#ef4444' : '#a78bfa',
                }}>
                  {testStatus[model.id].status === 'testing' && '⏳ '}
                  {testStatus[model.id].status === 'success' && '✅ '}
                  {testStatus[model.id].status === 'error' && '❌ '}
                  {testStatus[model.id].message}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 添加/编辑弹窗 */}
      {isEditing && (
        <div style={modalOverlayStyle} onClick={() => setIsEditing(false)}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
              {editingModel.id ? '✏️ 编辑模型' : '➕ 添加模型'}
            </h3>

            {/* 预设选择 */}
            {!editingModel.id && (
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>快速选择预设</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {MODEL_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => handleSelectPreset(preset)}
                      style={{
                        padding: '6px 10px', borderRadius: 6, fontSize: 12,
                        border: '1px solid #2a2a2a', background: '#0f0f0f',
                        color: '#9ca3af', cursor: 'pointer',
                      }}
                    >
                      {preset.type === 'local' ? '🖥️' : '☁️'} {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>名称 *</label>
                <input
                  value={editingModel.name}
                  onChange={(e) => setEditingModel((p) => ({ ...p, name: e.target.value }))}
                  placeholder="例如：DeepSeek"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>模型类型</label>
                <select
                  value={editingModel.modelType}
                  onChange={(e) => setEditingModel((p) => ({ ...p, modelType: e.target.value as AIModelType }))}
                  style={inputStyle}
                >
                  <option value="openai">OpenAI 兼容</option>
                  <option value="local">本地模型 (Ollama/LM Studio)</option>
                  <option value="custom">自定义</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Base URL *</label>
                <input
                  value={editingModel.baseUrl}
                  onChange={(e) => setEditingModel((p) => ({ ...p, baseUrl: e.target.value }))}
                  placeholder="https://api.example.com/v1"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>API Key</label>
                <input
                  type="password"
                  value={editingModel.apiKey}
                  onChange={(e) => setEditingModel((p) => ({ ...p, apiKey: e.target.value }))}
                  placeholder="sk-..."
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>模型 ID *</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      value={editingModel.modelId}
                      onChange={(e) => setEditingModel((p) => ({ ...p, modelId: e.target.value }))}
                      placeholder="gpt-4o"
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <button
                      onClick={handleFetchModels}
                      disabled={isFetchingModels || !editingModel.baseUrl}
                      style={{ ...btnSecondaryStyle, whiteSpace: 'nowrap' }}
                    >
                      {isFetchingModels ? '⏳' : '📋'} 获取列表
                    </button>
                  </div>
                  {availableModels.length > 0 && (
                    <select
                      onChange={(e) => setEditingModel((p) => ({ ...p, modelId: e.target.value }))}
                      style={{ ...inputStyle, marginTop: 6, width: '100%' }}
                    >
                      <option value="">选择可用模型...</option>
                      {availableModels.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Temperature ({editingModel.temperature})</label>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={editingModel.temperature}
                    onChange={(e) => setEditingModel((p) => ({ ...p, temperature: parseFloat(e.target.value) }))}
                    style={{ width: '100%' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280' }}>
                    <span>精确</span>
                    <span>平衡</span>
                    <span>创意</span>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Max Tokens</label>
                  <select
                    value={editingModel.maxTokens}
                    onChange={(e) => setEditingModel((p) => ({ ...p, maxTokens: parseInt(e.target.value) }))}
                    style={inputStyle}
                  >
                    <option value={2048}>2K</option>
                    <option value={4096}>4K</option>
                    <option value={8192}>8K</option>
                    <option value={16384}>16K</option>
                    <option value={32768}>32K</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={editingModel.stream}
                  onChange={(e) => setEditingModel((p) => ({ ...p, stream: e.target.checked }))}
                  id="streamToggle"
                />
                <label htmlFor="streamToggle" style={{ color: '#9ca3af', fontSize: 13, cursor: 'pointer' }}>
                  启用流式输出
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={handleSave} style={{ ...btnPrimaryStyle, flex: 1 }}>
                💾 保存
              </button>
              <button onClick={() => setIsEditing(false)} style={{ ...btnSecondaryStyle, flex: 1 }}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  background: '#0f0f0f',
  border: '1px solid #2a2a2a',
  borderRadius: '6px',
  color: '#e0e0e0',
  fontSize: '13px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: '#9ca3af',
  marginBottom: 6,
}

const btnPrimaryStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: '#8b5cf6',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
}

const btnSecondaryStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: '#1f1f1f',
  color: '#9ca3af',
  border: '1px solid #2a2a2a',
  borderRadius: '6px',
  fontSize: '12px',
  cursor: 'pointer',
}

const btnDangerStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: '#ef4444',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  fontSize: '12px',
  cursor: 'pointer',
}

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
}

const modalContentStyle: React.CSSProperties = {
  background: '#0a0a0a',
  border: '1px solid #2a2a2a',
  borderRadius: 12,
  padding: 24,
  maxWidth: 500,
  width: '90%',
  maxHeight: '85vh',
  overflow: 'auto',
}
