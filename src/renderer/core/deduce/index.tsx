import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store'
import PageWrapper from '../../components/PageWrapper'
import { loadPrompt } from '../../utils/promptLoader'
import type { AIModel, OneClickResult } from '../../../config/types'

const genId = (): string => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

async function callAIModelStream(model: AIModel, systemPrompt: string, userPrompt: string, onChunk: (text: string) => void): Promise<string> {
  const url = model.baseUrl.replace(/\/+$/, '') + '/chat/completions'
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${model.apiKey}` },
    body: JSON.stringify({ model: model.modelId, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], temperature: model.temperature, max_tokens: model.maxTokens, stream: true }),
  })
  if (!res.ok) { const e = await res.text().catch(() => ''); throw new Error(`AI 请求失败 (${res.status}): ${e || res.statusText}`) }
  const reader = res.body?.getReader(); const decoder = new TextDecoder(); let fullText = ''
  if (!reader) throw new Error('响应流不可用')
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    for (const line of chunk.split('\n')) {
      const t = line.trim()
      if (!t.startsWith('data: ')) continue
      const data = t.slice(6)
      if (data === '[DONE]') continue
      try { const p = JSON.parse(data); const c = p.choices?.[0]?.delta?.content; if (typeof c === 'string') { fullText += c; onChunk(fullText) } } catch { }
    }
  }
  return fullText
}

function extractSection(text: string, titles: string[]): string {
  for (const t of titles) {
    const m0 = text.match(new RegExp(`${t}[：:]([^\\n]+)`, 'i'))
    if (m0) { const v = m0[1].trim(); if (v && v.length < 50) return v }
  }
  for (const t of titles) { const m = text.match(new RegExp(`【${t}】([\\s\\S]*?)(?=【|$)`)); if (m) return m[1].trim() }
  for (const t of titles) { const m = text.match(new RegExp(`\\*\\*${t}\\*\\*([\\s\\S]*?)(?=\\d+\\.\\s*\\*\\*|\\*\\*[^*]+\\*\\*|$)`)); if (m) return m[1].trim() }
  for (const t of titles) { const m = text.match(new RegExp(`###\\s*${t}[\\s\\S]*?(?=###|$)`)); if (m) return m[0].replace(/###\s*/, '').trim() }
  for (const t of titles) { const m = text.match(new RegExp(`\\d+\\.\\s*${t}[\\s\\S]*?(?=\\d+\\.\\s|$)`)); if (m) return m[0].replace(/\d+\.\s*/, '').trim() }
  for (const t of titles) { const m = text.match(new RegExp(`\\*\\*${t}\\*\\*[：:]([^\\n]+)`, 'i')); if (m) { const v = m[1].trim(); if (v && v.length < 50) return v } }
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (titles.some((t) => lines[i].includes(t))) {
      const end = lines.findIndex((l, idx) => idx > i && (l.startsWith('【') || /^\d+\.\s*\*\*/.test(l) || l.startsWith('###') || l.startsWith('**')))
      const e = lines.slice(i + 1, end === -1 ? undefined : end).join('\n').trim()
      if (e) return e
    }
  }
  return ''
}

function extractField(text: string, keys: string[]): string {
  for (const key of keys) {
    let m = text.match(new RegExp(`${key}[:：]\\s*(.+)`))
    if (m) return m[1].trim()
    m = text.match(new RegExp(`【${key}】[：:]?\\s*(.+)`))
    if (m) return m[1].trim()
  }
  return ''
}

function parseProtagonist(text: string): any {
  return {
    id: genId(), name: extractField(text, ['姓名', '名字']) || '主角',
    roleType: 'protagonist' as const, avatar: '', basicInfo: { age: extractField(text, ['年龄']) || '', gender: extractField(text, ['性别']) || '', occupation: extractField(text, ['职业', '身份']) || '' },
    appearance: extractField(text, ['外貌', '身材']) || text.slice(0, 200), personality: (extractField(text, ['性格']) || '').split(/[,，、]/).map(s => s.trim()).filter(s => s).slice(0, 5),
    background: extractField(text, ['背景', '经历']) || '', abilities: extractField(text, ['能力', '技能']) || '', relationships: [], voice: '', innerWorld: '', arc: '', tags: [],
    createdAt: Date.now(), updatedAt: Date.now(),
  }
}

function parseWorld(text: string): any {
  return { id: genId(), name: '世界观设定', worldType: 'custom' as const, description: text.slice(0, 200), overview: text.slice(0, 600), rules: [], locations: [], timeline: [], society: '', culture: '', economy: '', createdAt: Date.now(), updatedAt: Date.now() }
}

function parseDeduceResult(raw: string): OneClickResult {
  const firstLine = raw.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))[0] || ''
  const extractedTitle = extractSection(raw, ['小说标题', '标题']).split('\n')[0].trim()
  const title = extractedTitle || firstLine.slice(0, 30) || '未命名小说'
  const summary = extractSection(raw, ['小说简介', '简介']).slice(0, 1000) || ''
  const protagonist = parseProtagonist(extractSection(raw, ['主角设定', '主角', '主人公设定']))
  const worldSetting = parseWorld(extractSection(raw, ['世界观', '世界设定']))
  const chapterText = extractSection(raw, ['章节目录', '目录', '章节规划'])
  const chapters = (chapterText.split('\n').filter(l => l.trim()).map((l) => {
    const m = l.match(/(?:第\s*(\d+)\s*章|(\d+)[.、\)])\s*[:：]?\s*(.+)/)
    return m ? { title: m[3].trim(), summary: '' } : null
  }).filter(Boolean) as { title: string; summary: string }[]) || [{ title: '第一章', summary: '开篇' }]
  const firstChapter = extractSection(raw, ['第一章正文', '第一章', '正文']).slice(0, 12000) || ''
  return { title, summary, protagonist, supporting: [], worldSetting, plotLine: { id: genId(), type: 'main' as const, name: '主线', description: '', events: [], relatedCharacters: [], createdAt: Date.now(), updatedAt: Date.now() }, chapters, firstChapter }
}

export default function DeducePage() {
  const navigate = useNavigate()
  const store = useAppStore()
  const deduceTask = store.deduceTask
  const currentModel = store.currentModel
  const currentNovel = store.currentNovel
  const resetAll = store.resetAll
  const importFromDeduce = store.importFromDeduce
  const addLog = store.addLog

  const [theme, setTheme] = useState(deduceTask?.theme || '')
  const [maleCount, setMaleCount] = useState(deduceTask?.maleCount || 1)
  const [femaleCount, setFemaleCount] = useState(deduceTask?.femaleCount || 2)
  const [targetLength, setTargetLength] = useState(deduceTask?.targetLength || '30000')
  const isGenerating = deduceTask?.isRunning || false
  const deduceResult = deduceTask?.result || null
  const deduceError = deduceTask?.error || null
  const isSubmitting = useRef(false)

  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!isGenerating || !deduceTask?.startTime) return
    setElapsed(Math.floor((Date.now() - deduceTask.startTime) / 1000))
    const timer = setInterval(() => setElapsed((p) => p + 1), 1000)
    return () => clearInterval(timer)
  }, [isGenerating, deduceTask?.startTime])

  const handleReDeduce = () => {
    if (!confirm('重新推导会清空当前所有数据，确定吗？')) return
    resetAll()
    store.clearDeduceTask()
    setTheme(''); setMaleCount(1); setFemaleCount(2); setTargetLength('30000')
  }

  const handleGenerate = async () => {
    if (!theme.trim() || isSubmitting.current) return
    isSubmitting.current = true
    const model = currentModel
    if (!model) { store.failDeduceTask('请先配置并选择一个 AI 模型'); isSubmitting.current = false; return }
    store.startDeduceTask({ theme, maleCount, femaleCount, targetLength })
    try {
      const rawPrompt = loadPrompt('prompts')
      if (!rawPrompt) throw new Error('提示词文件加载失败')
      const adultMode = store.adultMode
      const sys = rawPrompt.match(adultMode ? /## 系统提示词：成人情色小说专用（强烈推荐固定使用）\s*([\s\S]*?)(?=\n\s*---|\n\s*## |$)/ : /## 系统提示词：通用小说创作大师\s*([\s\S]*?)(?=\n\s*---|\n\s*## |$)/)
      const systemPrompt = sys?.[1].trim() || (adultMode ? '你是一位成人情色文学作家。' : '你是一位小说创作大师。')
      const userPtn = adultMode ? /## 成人情色小说 - 一键推导生成用户提示词模板\s*([\s\S]*?)(?=\n\s*---|$)/ : /## 一键推导生成 - 用户提示词模板\s*([\s\S]*?)(?=\n\s*---|$)/
      const userMatch = rawPrompt.match(userPtn)
      let template = userMatch?.[1].trim() || ''
      if (!template) throw new Error('未能从提示词提取用户模板')
      const labels: Record<string, string> = { '3000': '3,000字', '30000': '3万字', '100000': '10万字', '500000': '50万字', '1000000': '100万字' }
      const chCnt: Record<string, string> = { '3000': '5-8章', '30000': '15-25章', '100000': '30-50章', '500000': '80-120章', '1000000': '150-300章' }
      const vars: Record<string, string> = { theme: theme.trim(), length: labels[targetLength] || '3万字', wordCount: targetLength, maleCount: String(maleCount), femaleCount: String(femaleCount), chapterCount: chCnt[targetLength] || '15-25章', characterCount: String(maleCount + femaleCount), modelName: model.name, selectedTags: '无', tagsSection: '' }
      let userPrompt = template
      for (const [k, v] of Object.entries(vars)) userPrompt = userPrompt.split(`{${k}}`).join(v)

      const fullResult = await callAIModelStream(model, systemPrompt, userPrompt, () => {})
      const result = parseDeduceResult(fullResult)
      store.completeDeduceTask(result)
    } catch (err: any) {
      store.failDeduceTask(err.message || '生成失败')
    } finally { isSubmitting.current = false }
  }

  const handleSave = () => {
    if (!deduceResult) return
    importFromDeduce(deduceResult)
    const state = useAppStore.getState()
    const firstCh = state.chapters.slice().sort((a: any, b: any) => a.order - b.order)[0]
    if (firstCh && deduceResult.firstChapter) store.updateChapter(firstCh.id, { content: deduceResult.firstChapter })
    store.clearDeduceTask()
    addLog({ type: 'success', message: `推导完成：${deduceResult.title}`, detail: '' })
  }

  const handleSaveAndView = () => { handleSave(); setTimeout(() => navigate('/plotview'), 100) }
  const handleDiscard = () => { store.clearDeduceTask(); setTheme(''); setMaleCount(1); setFemaleCount(2); setTargetLength('30000') }

  return (
    <PageWrapper
      title="一键推导"
      subtitle={currentNovel ? `当前项目：${currentNovel.title}` : '输入主题，AI 自动生成完整小说结构'}
    >
      {currentNovel && !isGenerating && (
        <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#818cf8', fontSize: '14px' }}>⚠️ 已有项目数据，重新推导将覆盖现有内容</span>
          <button onClick={handleReDeduce} style={{ padding: '6px 16px', background: '#ef4444', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>🔄 重新推导</button>
        </div>
      )}

      <div style={{ opacity: isGenerating ? 0.6 : 1, pointerEvents: isGenerating ? 'none' : 'auto' } as React.CSSProperties}>
        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '6px' }}>主题 / 关键词</div>
            <input value={theme} onChange={e => setTheme(e.target.value)} placeholder="例如：都市异能、穿越修仙..." style={{ width: '100%', padding: '10px 14px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
            <div>
              <div style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '6px' }}>男角色</div>
              <input type="number" value={maleCount} onChange={e => setMaleCount(Math.max(0, Math.min(10, Number(e.target.value))))} style={{ width: '100%', padding: '10px 14px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '6px' }}>女角色</div>
              <input type="number" value={femaleCount} onChange={e => setFemaleCount(Math.max(0, Math.min(10, Number(e.target.value))))} style={{ width: '100%', padding: '10px 14px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ display: 'block', color: '#888', fontSize: '13px', marginBottom: '6px' }}>目标字数</div>
              <select value={targetLength} onChange={e => setTargetLength(e.target.value)} style={{ width: '100%', padding: '10px 14px', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}>
                <option value="30000">短篇（3万字）</option>
                <option value="100000">中篇（10万字）</option>
                <option value="500000">长篇（50万字）</option>
                <option value="1000000">超长篇（100万字）</option>
              </select>
            </div>
          </div>
          <button onClick={handleGenerate} disabled={isGenerating || !theme.trim()} style={{ width: '100%', padding: '12px', background: isGenerating ? '#333' : '#6366f1', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '15px', cursor: isGenerating ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
            {isGenerating ? '⏳ 生成中...' : '⚡ 一键推导'}
          </button>
        </div>
      </div>

      {isGenerating && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '40px', textAlign: 'center', marginTop: '20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <div style={{ color: '#888', fontSize: '16px' }}>正在推导：{deduceTask?.theme}</div>
          <div style={{ color: '#666', fontSize: '13px', marginTop: '8px' }}>已用时 {elapsed} 秒</div>
          <div style={{ color: '#555', fontSize: '12px', marginTop: '12px' }}>您可以切换到其他页面，推导完成后会自动保存结果</div>
        </div>
      )}

      {deduceError && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '16px', marginTop: '20px' }}>
          <div style={{ color: '#ef4444', fontSize: '14px' }}>❌ {deduceError}</div>
          <button onClick={() => store.clearDeduceTask()} style={{ marginTop: '12px', padding: '6px 16px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#888', fontSize: '13px', cursor: 'pointer' }}>清除错误</button>
        </div>
      )}

      {deduceResult && !isGenerating && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '20px', marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#fff' }}>✅ 推导完成：{deduceResult.title}</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleDiscard} style={{ padding: '6px 14px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#888', fontSize: '13px', cursor: 'pointer' }}>🗑 放弃</button>
              <button onClick={handleSave} style={{ padding: '6px 14px', background: '#1a1a1a', border: '1px solid #6366f1', borderRadius: '6px', color: '#6366f1', fontSize: '13px', cursor: 'pointer' }}>💾 保存</button>
              <button onClick={handleSaveAndView} style={{ padding: '6px 14px', background: '#6366f1', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>✓ 保存并查看</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
            <div style={{ padding: '12px', background: '#0f0f0f', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#6366f1' }}>{1 + (deduceResult.supporting?.length || 0)}</div>
              <div style={{ fontSize: '12px', color: '#888' }}>角色</div>
            </div>
            <div style={{ padding: '12px', background: '#0f0f0f', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#22c55e' }}>{deduceResult.chapters?.length || 0}</div>
              <div style={{ fontSize: '12px', color: '#888' }}>章节</div>
            </div>
            <div style={{ padding: '12px', background: '#0f0f0f', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#f59e0b' }}>{deduceResult.plotLine?.events?.length || 0}</div>
              <div style={{ fontSize: '12px', color: '#888' }}>事件</div>
            </div>
            <div style={{ padding: '12px', background: '#0f0f0f', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ec4899' }}>{deduceResult.firstChapter ? '✓' : '✗'}</div>
              <div style={{ fontSize: '12px', color: '#888' }}>首章</div>
            </div>
          </div>
          <div style={{ padding: '12px', background: '#0f0f0f', borderRadius: '8px' }}>
            <div style={{ fontSize: '12px', color: '#6366f1', marginBottom: '4px' }}>简介</div>
            <div style={{ fontSize: '13px', color: '#ccc', lineHeight: 1.6 }}>{deduceResult.summary}</div>
          </div>
        </div>
      )}
    </PageWrapper>
  )
}
