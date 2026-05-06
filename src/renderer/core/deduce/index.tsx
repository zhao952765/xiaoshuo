/**
 * 一键推导页面
 * SRS v2.3 统一整合版修复
 *
 * 修复点：
 * 1. 推导结果通过 transformDeduceToAppData 转换为完整数据结构
 * 2. 导入 store 时包含 emotionArc / lustArc / tags / prompts
 * 3. 支持流式生成 + 分块重生成
 * 4. 输出结构与 SRS v2.3 project/ 目录对应
 */

import React, { useState, useRef, useCallback } from 'react'
import { useStore } from '../../store'
import { transformDeduceToAppData, mapOldResultToCurrent } from '../../utils/deduceTransformer'
import { parseGenerationResult } from '../../utils/deduceParser'
import type { OneClickResult } from '../../../config/types'

// ==================== 推导参数配置 ====================
interface DeduceParams {
  title: string
  theme: string
  type: string
  scaleLevel: 1 | 2 | 3 | 4
  targetWords: string
  maleCount: number
  femaleCount: number
  themeTags: string[]
  blacklist: string[]
  customPrompt: string
  modelId: string
  adultMode: boolean
}

const SCALE_LEVELS = [
  { value: 1 as const, label: '轻度（暗示）', color: '#10b981' },
  { value: 2 as const, label: '中度（描写）', color: '#f59e0b' },
  { value: 3 as const, label: '重度（详细）', color: '#ef4444' },
  { value: 4 as const, label: '极端（硬核）', color: '#7c3aed' },
]

const TYPE_OPTIONS = [
  '都市言情', '玄幻修仙', '科幻未来', '历史架空',
  '悬疑推理', '末世生存', '武侠江湖', '校园青春', '自定义',
]

// ==================== 主组件 ====================
export default function DeducePage() {
  const [params, setParams] = useState<DeduceParams>({
    title: '',
    theme: '',
    type: '都市言情',
    scaleLevel: 2,
    targetWords: '30000',
    maleCount: 1,
    femaleCount: 2,
    themeTags: [],
    blacklist: [],
    customPrompt: '',
    modelId: '',
    adultMode: false,
  })

  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState('')
  const [streamText, setStreamText] = useState('')
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const currentModel = useStore((s) => s.currentModel)
  const importFromDeduce = useStore((s) => s.importFromDeduce)
  const startDeduceTask = useStore((s) => s.startDeduceTask)
  const completeDeduceTask = useStore((s) => s.completeDeduceTask)
  const failDeduceTask = useStore((s) => s.failDeduceTask)
  const addLog = useStore((s) => s.addLog)
  const adultMode = useStore((s) => s.adultMode)

  // ==================== AI 调用 ====================
  const callAIModelStream = useCallback(async (prompt: string, onChunk: (text: string) => void) => {
    if (!currentModel) throw new Error('未配置 AI 模型')

    const controller = new AbortController()
    abortRef.current = controller

    const res = await fetch(`${currentModel.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentModel.apiKey}`,
      },
      body: JSON.stringify({
        model: currentModel.modelId,
        messages: [
          { role: 'system', content: buildSystemPrompt(params) },
          { role: 'user', content: prompt },
        ],
        temperature: currentModel.temperature,
        max_tokens: currentModel.maxTokens,
        stream: true,
      }),
      signal: controller.signal,
    })

    if (!res.ok) throw new Error(`AI 请求失败: ${res.status}`)

    const reader = res.body?.getReader()
    if (!reader) throw new Error('无法读取响应流')

    const decoder = new TextDecoder()
    let fullText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n').filter(l => l.trim())
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content || ''
            fullText += content
            onChunk(fullText)
          } catch {
            // ignore parse error
          }
        }
      }
    }

    return fullText
  }, [currentModel, params])

  // ==================== 构建系统 Prompt ====================
  const buildSystemPrompt = (p: DeduceParams): string => {
    const scaleDesc = SCALE_LEVELS.find(s => s.value === p.scaleLevel)?.label || '中度'
    return `你是一位专业的小说架构师。请根据用户要求生成完整的小说推导结果。

【输出格式要求】必须严格按以下区块输出，每个区块用 ## 标题开头：

## 小说标题
（1行）

## 小说简介
（2-4段）

## 主角设定
**姓名**：
**性别**：
**年龄**：
**外貌**：
**性格**：
**背景**：
**能力**：
**目标**：

## 配角设定
**配角1姓名**：
**性别**：
**与主角关系**：
**外貌**：
**性格**：
（继续列出所有配角）

## 世界观与氛围
（规则、地点、时间线、社会、文化、经济）

## 感情/肉欲发展线
（按时间顺序列出感情事件，标注类型：感情/冲突/高潮/肉欲）

## 章节目录
第一章 标题
第二章 标题
（继续）

## 第一章正文
（2000-5000字）

【尺度要求】${scaleDesc}
【类型】${p.type}
【目标字数】${p.targetWords}
${p.adultMode ? '【成人模式】开启，需包含感情线与肉欲线双轨设计' : ''}
${p.customPrompt ? '【自定义要求】' + p.customPrompt : ''}
${p.blacklist.length > 0 ? '【黑名单】禁止出现：' + p.blacklist.join('、') : ''}`
  }

  // ==================== 一键推导主流程 ====================
  const handleDeduce = useCallback(async () => {
    if (!params.theme.trim()) {
      setError('请输入主题/关键词')
      return
    }
    if (!currentModel) {
      setError('请先配置 AI 模型')
      return
    }

    setIsGenerating(true)
    setError('')
    setStreamText('')
    setProgress('正在生成小说架构...')

    startDeduceTask({
      theme: params.theme,
      maleCount: params.maleCount,
      femaleCount: params.femaleCount,
      targetLength: params.targetWords,
    })

    try {
      const prompt = `请为以下主题生成完整小说架构：\n\n主题：${params.theme}\n类型：${params.type}\n主角性别偏好：${params.maleCount}男${params.femaleCount}女\n标签：${params.themeTags.join('、') || '无'}\n`

      const fullText = await callAIModelStream(prompt, (text) => {
        setStreamText(text)
        // 根据文本长度估算进度
        const estProgress = Math.min(95, Math.round((text.length / 8000) * 100))
        setProgress(`生成中... ${estProgress}%`)
      })

      setProgress('解析推导结果...')

      // SRS v2.3: 使用 mapOldResultToCurrent + transformDeduceToAppData 完整转换
      const deduceInput = mapOldResultToCurrent(fullText)
      const appData = transformDeduceToAppData(deduceInput, {
        firstChapterContent: deduceInput.firstChapter,
        adultMode: params.adultMode || adultMode,
      })

      // 构建 OneClickResult 供 importFromDeduce 使用
      const result: OneClickResult = {
        title: deduceInput.title,
        summary: deduceInput.summary,
        protagonist: appData.characters.find(c => c.roleType === 'protagonist') || deduceInput.protagonist,
        supporting: appData.characters.filter(c => c.roleType !== 'protagonist'),
        worldSetting: appData.worldSetting,
        plotLine: appData.plotLine,
        chapters: deduceInput.chapters,
        firstChapter: deduceInput.firstChapter || '',
        // SRS v2.3 新增字段
        emotionArc: appData.emotionArc,
        lustArc: appData.lustArc,
        tags: appData.tags,
        prompts: appData.prompts,
      }

      // 导入到 Store（包含 emotionArc / lustArc）
      importFromDeduce(result, deduceInput.firstChapter)

      completeDeduceTask(result)
      addLog({
        type: 'success',
        message: `一键推导完成：${result.title}`,
        detail: `生成 ${appData.characters.length} 个角色，${appData.chapters.length} 个章节，感情线 ${appData.emotionArc.nodes.length} 节点，肉欲线 ${appData.lustArc.intensityCurve.length} 强度点`,
      })

      setProgress('完成！')
      setStreamText('')
    } catch (err: any) {
      const msg = err.message || '推导失败'
      setError(msg)
      failDeduceTask(msg)
      addLog({ type: 'error', message: '一键推导失败', detail: msg })
    } finally {
      setIsGenerating(false)
      abortRef.current = null
    }
  }, [params, currentModel, adultMode, callAIModelStream, importFromDeduce, startDeduceTask, completeDeduceTask, failDeduceTask, addLog])

  // ==================== 取消推导 ====================
  const handleCancel = useCallback(() => {
    abortRef.current?.abort()
    setIsGenerating(false)
    setProgress('已取消')
    addLog({ type: 'warn', message: '一键推导已取消', detail: '' })
  }, [addLog])

  // ==================== 重新推导 ====================
  const handleReDeduce = useCallback(() => {
    // 仅清除项目数据，保留 AI 模型等全局配置
    useStore.getState().clearAllData()
    setStreamText('')
    setError('')
    setProgress('')
    addLog({ type: 'info', message: '已重置项目数据，可重新推导', detail: '' })
  }, [addLog])

  // ==================== UI 渲染 ====================
  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto', color: '#e0e0e0' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: '#e0e0e0' }}>
        🎯 一键推导
      </h2>

      {/* 输入表单 */}
      <div style={{ display: 'grid', gap: 16, marginBottom: 24 }}>
        {/* 标题 */}
        <div>
          <label style={labelStyle}>标题（可选）</label>
          <input
            value={params.title}
            onChange={(e) => setParams(p => ({ ...p, title: e.target.value }))}
            placeholder="留空则由 AI 生成"
            style={inputStyle}
          />
        </div>

        {/* 主题 */}
        <div>
          <label style={labelStyle}>主题 / 关键词 *</label>
          <input
            value={params.theme}
            onChange={(e) => setParams(p => ({ ...p, theme: e.target.value }))}
            placeholder="例如：都市异能、穿越修仙、办公室恋情、末世求生..."
            style={inputStyle}
          />
        </div>

        {/* 类型 + 尺度 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>类型</label>
            <select
              value={params.type}
              onChange={(e) => setParams(p => ({ ...p, type: e.target.value }))}
              style={inputStyle}
            >
              {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>尺度等级</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {SCALE_LEVELS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setParams(p => ({ ...p, scaleLevel: s.value }))}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    borderRadius: 6,
                    border: '1px solid #2a2a2a',
                    background: params.scaleLevel === s.value ? s.color + '30' : '#0f0f0f',
                    color: params.scaleLevel === s.value ? s.color : '#9ca3af',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontWeight: params.scaleLevel === s.value ? 600 : 400,
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 角色数量 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>男角色数</label>
            <input
              type="number"
              min={0} max={10}
              value={params.maleCount}
              onChange={(e) => setParams(p => ({ ...p, maleCount: Math.max(0, Math.min(10, Number(e.target.value))) }))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>女角色数</label>
            <input
              type="number"
              min={0} max={10}
              value={params.femaleCount}
              onChange={(e) => setParams(p => ({ ...p, femaleCount: Math.max(0, Math.min(10, Number(e.target.value))) }))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>目标字数</label>
            <select
              value={params.targetWords}
              onChange={(e) => setParams(p => ({ ...p, targetWords: e.target.value }))}
              style={inputStyle}
            >
              <option value="3000">短篇（3千）</option>
              <option value="30000">中篇（3万）</option>
              <option value="100000">长篇（10万）</option>
              <option value="500000">巨著（50万）</option>
              <option value="1000000">史诗（100万）</option>
            </select>
          </div>
        </div>

        {/* 自定义 Prompt */}
        <div>
          <label style={labelStyle}>自定义 Prompt（可选）</label>
          <textarea
            value={params.customPrompt}
            onChange={(e) => setParams(p => ({ ...p, customPrompt: e.target.value }))}
            placeholder="输入额外的创作要求..."
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        {/* 成人模式开关 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={params.adultMode}
            onChange={(e) => setParams(p => ({ ...p, adultMode: e.target.checked }))}
            id="adultMode"
          />
          <label htmlFor="adultMode" style={{ color: '#a855f7', fontSize: 13, cursor: 'pointer' }}>
            🔞 成人模式（生成感情线 + 肉欲线双轨）
          </label>
        </div>
      </div>

      {/* 操作按钮 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button
          onClick={handleDeduce}
          disabled={isGenerating}
          style={{
            ...btnPrimaryStyle,
            opacity: isGenerating ? 0.6 : 1,
            cursor: isGenerating ? 'not-allowed' : 'pointer',
          }}
        >
          {isGenerating ? '⏳ 生成中...' : '🚀 开始推导'}
        </button>
        {isGenerating && (
          <button onClick={handleCancel} style={{ ...btnDangerStyle }}>
            ⛔ 取消
          </button>
        )}
        <button onClick={handleReDeduce} style={btnSecondaryStyle}>
          🔄 重新推导
        </button>
      </div>

      {/* 进度与错误 */}
      {progress && (
        <div style={{ padding: '10px 14px', background: '#0f0f0f', borderRadius: 6, marginBottom: 12, color: '#8b5cf6', fontSize: 13 }}>
          {progress}
        </div>
      )}
      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', borderRadius: 6, marginBottom: 12, color: '#ef4444', fontSize: 13 }}>
          ❌ {error}
        </div>
      )}

      {/* 流式输出预览 */}
      {streamText && (
        <div style={{
          padding: 16, background: '#0f0f0f', borderRadius: 8, border: '1px solid #2a2a2a',
          maxHeight: 400, overflow: 'auto', fontSize: 13, lineHeight: 1.7, color: '#9ca3af',
          whiteSpace: 'pre-wrap',
        }}>
          {streamText}
        </div>
      )}

      {/* SRS v2.3: 输出结构预览 */}
      {!isGenerating && !streamText && (
        <div style={{ marginTop: 24, padding: 16, background: '#0a0a0a', borderRadius: 8, border: '1px solid #1a1a1a' }}>
          <h4 style={{ color: '#6b7280', fontSize: 13, marginBottom: 12 }}>📦 推导输出结构（SRS v2.3）</h4>
          <pre style={{ color: '#4b5563', fontSize: 12, lineHeight: 1.6, margin: 0 }}>
{`project/
├── manifest.json
├── story_overview.md
├── world.json
├── emotion_arc.json      ← React Flow 节点+边+时间轴
├── lust_arc.json         ← 强度曲线+高潮点
├── outline.json
├── characters/
│   ├── char_1.json       ← 含 NSFW 档案
├── chapters/
│   ├── ch1.md
├── tags.json
└── prompts.json`}
          </pre>
        </div>
      )}
    </div>
  )
}

// ==================== 样式常量 ====================
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: '#9ca3af',
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: '#0f0f0f',
  border: '1px solid #2a2a2a',
  borderRadius: '8px',
  color: '#e0e0e0',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
}

const btnPrimaryStyle: React.CSSProperties = {
  padding: '10px 20px',
  background: '#8b5cf6',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
}

const btnDangerStyle: React.CSSProperties = {
  padding: '10px 20px',
  background: '#ef4444',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
}

const btnSecondaryStyle: React.CSSProperties = {
  padding: '10px 20px',
  background: '#1f1f1f',
  color: '#9ca3af',
  border: '1px solid #2a2a2a',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
}
