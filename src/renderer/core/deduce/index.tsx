import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store'
import PageWrapper from '../../components/PageWrapper'
import { loadPrompt } from '../../utils/promptLoader'
import { PRESET_TAG_GROUPS } from '../../constants/tagPrompts'
import type { AIModel } from '../../../config/types'

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

function extractBlock(text: string, keywords: string[]): string {
  const escaped = keywords.map(k =>
    k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  const pattern = `(?:^|\\n)(?:#{1,4}\\s*|\\*{0,2}${escaped.join('|')}\\s*[：:]?\\s*\\n*)([\\s\\S]*?)(?=\\n(?:#{1,4}\\s|\\*{2}|第\\s*[0-9一二三四五六七八九十百千]+[章节卷]|【|配角|世界观|设定|规则|\\n$)|$)`;
  const regex = new RegExp(pattern, 'im');
  return text.match(regex)?.[1]?.trim() || '';
}

function parseDeduceResult(aiText: string) {
  const result = {
    title: '',
    summary: '',
    firstChapter: '',
    chapters: [] as { title: string; summary: string }[],
    supporting: [] as any[],
    protagonist: null as any,
    worldSetting: { id: '', name: '', worldType: 'custom' as const, description: '', overview: '', rules: [] as any[], locations: [] as any[], timeline: [] as any[], society: '', culture: '', economy: '', createdAt: 0, updatedAt: 0 },
    plotLine: { id: '', type: 'main' as const, name: '主线', description: '', events: [] as any[], relatedCharacters: [] as string[], createdAt: 0, updatedAt: 0 },
  };

  // 1. 标题（多模式匹配）
  const titleMatch = aiText.match(/(?:^|\n)#{1,4}\s*(.+?)(?:\n|$)/);
  const bracketTitle = aiText.match(/【(.+?)】/);
  result.title = titleMatch?.[1] || bracketTitle?.[1] || '未命名故事';

  // 2. 摘要
  const summaryMatch = aiText.match(/摘要[：:]\s*(.+)/);
  result.summary = summaryMatch?.[1] || '';

  // 3. 章节分割与解析
  const chapterPattern = /(?:^|\n)(?:#{1,4}\s*)?(第\s*[0-9一二三四五六七八九十百千]+[章节卷]\s*[^\n]*)/g;
  let match;
  const chapterStarts: { index: number; title: string }[] = [];
  while ((match = chapterPattern.exec(aiText)) !== null) {
    chapterStarts.push({ index: match.index, title: match[1].replace(/^#+\s*/, '') });
  }
  for (let i = 0; i < chapterStarts.length; i++) {
    const start = aiText.indexOf(chapterStarts[i].title, chapterStarts[i].index);
    const end = i + 1 < chapterStarts.length ? chapterStarts[i + 1].index : aiText.length;
    const content = aiText.slice(start + chapterStarts[i].title.length, end).trim().replace(/^[\r\n]+/, '');
    result.chapters.push({
      title: chapterStarts[i].title,
      summary: content.slice(0, 100),
    });
  }
  if (result.chapters.length === 0) {
    result.chapters.push({ title: '第一章', summary: '开篇' });
  }
  
  // 提取第一章内容
  const firstChapterBlock = extractBlock(aiText, ['第一章', '第1章', '开篇', '开头']);
  result.firstChapter = firstChapterBlock || aiText.slice(0, 2000); // 如果没有明确的章节块，取前2000字符作为第一章

  // 4. 配角解析
  const supBlock = extractBlock(aiText, ['配角设定', '配角', '角色列表']);
  if (supBlock) {
    const lines = supBlock.split('\n');
    for (const line of lines) {
      const l = line.trim();
      if (!l) continue;
      const m = l.match(/^(?:-\s*)?(?:\*{0,2}(.+?)\*{0,2})\s*[：:]\s*(.+)/);
      if (m) {
        result.supporting.push({ id: `sup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name: m[1].trim(), roleType: 'supporting', basicInfo: { age: '', gender: '', occupation: '' }, appearance: '', personality: [], background: m[2].trim(), abilities: '', relationships: [], voice: '', innerWorld: '', arc: '', tags: [], avatar: '', createdAt: Date.now(), updatedAt: Date.now() });
      } else if (l.startsWith('-') || l.startsWith('*')) {
        const name = l.replace(/^[-*]\s*/, '').split(/[：:]/)[0];
        if (name) result.supporting.push({ id: `sup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name, roleType: 'supporting', basicInfo: { age: '', gender: '', occupation: '' }, appearance: '', personality: [], background: '', abilities: '', relationships: [], voice: '', innerWorld: '', arc: '', tags: [], avatar: '', createdAt: Date.now(), updatedAt: Date.now() });
      }
    }
  }

  // 5. 世界观解析
  const worldNameMatch = aiText.match(/世界观[：:]\s*(.+)/);
  const wName = worldNameMatch?.[1] || '';
  const descMatch = aiText.match(/世界观描述[：:](.+)/);
  const wDesc = descMatch?.[1] || '';
  const rulesBlock = extractBlock(aiText, ['世界规则', '规则', '世界观规则']);
  const locBlock = extractBlock(aiText, ['地点', '场景', '主要地点']);
  const timeBlock = extractBlock(aiText, ['时间线', '年代', '历史']);
  result.worldSetting = {
    id: `world_${Date.now()}`,
    name: wName || '世界观设定',
    worldType: 'custom' as const,
    description: wDesc || aiText.slice(0, 200),
    overview: aiText.slice(0, 600),
    rules: rulesBlock ? rulesBlock.split('\n').map(l => ({ name: l.replace(/^[-\d.]+\s*/, '').trim(), description: '', scope: '', limit: '' })).filter(r => r.name) : [],
    locations: locBlock ? locBlock.split('\n').map(l => ({ name: l.replace(/^-\s*/, '').trim(), type: '', description: '', atmosphere: '', scenes: [] })).filter(l => l.name) : [],
    timeline: timeBlock ? timeBlock.split('\n').map(l => ({ era: '', title: l.replace(/^-\s*/, '').trim(), description: '', impact: '' })).filter(t => t.title) : [],
    society: '', culture: '', economy: '',
    createdAt: Date.now(), updatedAt: Date.now(),
  };

  // 6. 主角（从第一章或标题区域提取占位）
  result.protagonist = {
    id: `prot_${Date.now()}`,
    name: result.title.slice(0, 10) || '主角',
    roleType: 'protagonist' as const,
    avatar: '', basicInfo: { age: '', gender: '', occupation: '' },
    appearance: '', personality: [], background: result.summary.slice(0, 200), abilities: '',
    relationships: [], voice: '', innerWorld: '', arc: '', tags: [],
    createdAt: Date.now(), updatedAt: Date.now(),
  };

  // 7. 剧情线 events（从AI响应中提取感情线和剧情事件）
  const emotionBlock = extractBlock(aiText, ['感情线', '感情发展', '感情事件', '情感线']);
  const plotEvents: any[] = [];
  
  // 从感情线块解析事件
  if (emotionBlock) {
    const lines = emotionBlock.split('\n');
    let order = 0;
    for (const line of lines) {
      const l = line.trim();
      if (!l || !l.match(/^\d+[\.\)、]/)) continue;
      const content = l.replace(/^\d+[\.\)、]\s*/, '');
      const titleMatch = content.match(/^(.+?)[：:]/);
      if (titleMatch) {
        plotEvents.push({
          id: `evt_${Date.now()}_${order}`,
          title: titleMatch[1].trim(),
          description: content.replace(titleMatch[0], '').trim(),
          order: order++,
          chapterId: null,
        });
      }
    }
  }
  
  // 如果没有找到感情线，从章节生成基本事件
  if (plotEvents.length === 0) {
    result.chapters.forEach((ch, idx) => {
      plotEvents.push({
        id: `evt_${Date.now()}_${idx}`,
        title: ch.title,
        description: ch.summary,
        order: idx,
        chapterId: null,
      });
    });
  }

  result.plotLine = {
    id: `plot_${Date.now()}`,
    type: 'main' as const,
    name: '主线',
    description: result.summary.slice(0, 200),
    events: plotEvents,
    relatedCharacters: [],
    createdAt: Date.now(), updatedAt: Date.now(),
  };

  return result;
}

export default function DeducePage() {
  const navigate = useNavigate()
  const store = useAppStore()
  const deduceTask = store.deduceTask
  const currentModel = store.currentModel
  const currentNovel = store.currentNovel
  const importFromDeduce = store.importFromDeduce
  const addLog = store.addLog

  const [theme, setTheme] = useState(deduceTask?.theme || '')
  const [maleCount, setMaleCount] = useState(deduceTask?.maleCount || 1)
  const [femaleCount, setFemaleCount] = useState(deduceTask?.femaleCount || 2)
  const [targetLength, setTargetLength] = useState(deduceTask?.targetLength || '30000')
  const [showTagSelector, setShowTagSelector] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  // 从 store 获取标签数据
  const allTags = store.tags || []
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
    if (!confirm('重新推导会覆盖当前项目的所有内容，确定吗？')) return
    // 清空推导任务状态（包括 result/error 等所有子字段）
    store.clearDeduceTask()
    // 重置表单
    setTheme('')
    setMaleCount(1)
    setFemaleCount(2)
    setTargetLength('30000')
    setSelectedTags([])
    setShowTagSelector(false)
  }

  const toggleTag = (tagName: string) => {
    setSelectedTags(prev =>
      prev.includes(tagName)
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    )
  }

  const applyPresetTags = (preset: { name: string; tags: string[] }) => {
    setSelectedTags(preset.tags)
    setShowTagSelector(false)
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
      // 使用本地选择的标签
      const selectedTagNames = selectedTags
      const tagsSection = selectedTagNames.length > 0
        ? `\n使用的标签（请围绕这些标签创作）：${selectedTagNames.join('、')}\n请确保故事中用到以下标签元素：\n${selectedTagNames.map(t => `- ${t}`).join('\n')}`
        : ''
      const vars: Record<string, string> = {
        theme: theme.trim(), length: labels[targetLength] || '3万字', wordCount: targetLength,
        maleCount: String(maleCount), femaleCount: String(femaleCount),
        chapterCount: chCnt[targetLength] || '15-25章', characterCount: String(maleCount + femaleCount),
        modelName: model.name,
        selectedTags: selectedTagNames.length > 0 ? selectedTagNames.join('、') : '无',
        tagsSection,
      }
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

  // 是否缺少模型
  const noModel = !currentModel
  // 渲染提示：告诉用户到底为什么按钮不可点击
  const disabledReason = !theme.trim()
    ? '请先输入主题'
    : noModel
      ? '请先去「AI模型」页面配置并选择一个模型'
      : isGenerating
        ? '正在生成中'
        : ''

  const btnStyle: React.CSSProperties = {
    width: '100%', padding: '13px',
    background: isGenerating ? '#333' : noModel ? '#555' : '#6366f1',
    border: 'none', borderRadius: '10px',
    color: '#fff', fontSize: '15px',
    cursor: (isGenerating || !theme.trim()) ? 'not-allowed' : 'pointer',
    fontWeight: 700, letterSpacing: '1px',
  }

  return (
    <PageWrapper
      title="一键推导"
      subtitle={currentNovel ? `当前项目：${currentNovel.title}` : '输入主题，AI 自动生成完整小说结构'}
    >
      {/* === 顶部警告：已有项目时显示 === */}
      {currentNovel && !isGenerating && (
        <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(239,68,68,0.05))', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ color: '#facc15', fontSize: '14px' }}>⚠️ 已有项目数据，重新推导将覆盖现有内容</span>
          <button onClick={handleReDeduce} style={{ padding: '7px 18px', background: '#ef4444', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>🔄 重新推导</button>
        </div>
      )}

      {/* === 参数表单 === */}
      <div style={{ opacity: isGenerating ? 0.5 : 1, pointerEvents: isGenerating ? 'none' : 'auto' } as React.CSSProperties}>
        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '14px', padding: '24px' }}>

          {/* 主题输入 */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ color: '#aaa', fontSize: '13px', marginBottom: '8px', fontWeight: 500 }}>📝 主题 / 关键词</div>
            <input
              value={theme}
              onChange={e => setTheme(e.target.value)}
              placeholder="例如：都市异能、穿越修仙、校园恋爱..."
              style={{ width: '100%', padding: '12px 16px', background: '#0f0f0f', border: '1px solid #333', borderRadius: '10px', color: '#e0e0e0', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* 角色字数三列 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '18px' }}>
            <div>
              <div style={{ color: '#aaa', fontSize: '13px', marginBottom: '6px', fontWeight: 500 }}>♂ 男角色</div>
              <input type="number" min={0} max={10} value={maleCount} onChange={e => setMaleCount(Math.max(0, Math.min(10, Number(e.target.value))))} style={{ width: '100%', padding: '11px 14px', background: '#0f0f0f', border: '1px solid #333', borderRadius: '10px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ color: '#aaa', fontSize: '13px', marginBottom: '6px', fontWeight: 500 }}>♀ 女角色</div>
              <input type="number" min={0} max={10} value={femaleCount} onChange={e => setFemaleCount(Math.max(0, Math.min(10, Number(e.target.value))))} style={{ width: '100%', padding: '11px 14px', background: '#0f0f0f', border: '1px solid #333', borderRadius: '10px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ color: '#aaa', fontSize: '13px', marginBottom: '6px', fontWeight: 500 }}>📏 目标字数</div>
              <select value={targetLength} onChange={e => setTargetLength(e.target.value)} style={{ width: '100%', padding: '11px 14px', background: '#0f0f0f', border: '1px solid #333', borderRadius: '10px', color: '#e0e0e0', fontSize: '14px', outline: 'none', boxSizing: 'border-box', cursor: 'pointer' }}>
                <option value="30000">短篇（3万字）</option>
                <option value="100000">中篇（10万字）</option>
                <option value="500000">长篇（50万字）</option>
                <option value="1000000">超长篇（100万字）</option>
              </select>
            </div>
          </div>

          {/* 标签选择区域 */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ color: '#aaa', fontSize: '13px', fontWeight: 500 }}>🏷️ 故事标签（可选）</div>
              <button
                onClick={() => setShowTagSelector(!showTagSelector)}
                style={{ padding: '5px 12px', background: '#333', border: '1px solid #555', borderRadius: '6px', color: '#ccc', fontSize: '12px', cursor: 'pointer' }}
              >
                {showTagSelector ? '▲ 收起' : '▼ 选择标签'}
              </button>
            </div>

            {selectedTags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                {selectedTags.map(tag => (
                  <span key={tag} style={{ padding: '5px 10px', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', borderRadius: '20px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {tag}
                    <button onClick={() => toggleTag(tag)} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>
                  </span>
                ))}
              </div>
            )}

            {showTagSelector && (
              <div style={{ background: '#0f0f0f', border: '1px solid #333', borderRadius: '10px', padding: '14px', marginTop: '8px' }}>
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '6px' }}>推荐组合：</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {PRESET_TAG_GROUPS.slice(0, 4).map((preset: { name: string; tags: string[] }) => (
                      <button key={preset.name} onClick={() => applyPresetTags(preset)} style={{ padding: '5px 10px', background: '#2a2a2a', border: '1px solid #444', borderRadius: '6px', color: '#ccc', fontSize: '12px', cursor: 'pointer' }}>
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
                  <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '6px' }}>已有标签（最多显示50个）：</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '6px' }}>
                    {allTags.slice(0, 50).map(tag => (
                      <button
                        key={tag.id}
                        onClick={() => toggleTag(tag.name)}
                        style={{
                          padding: '5px 8px',
                          background: selectedTags.includes(tag.name) ? 'rgba(99,102,241,0.2)' : '#2a2a2a',
                          border: `1px solid ${selectedTags.includes(tag.name) ? 'rgba(99,102,241,0.4)' : '#444'}`,
                          borderRadius: '6px',
                          color: selectedTags.includes(tag.name) ? '#818cf8' : '#aaa',
                          fontSize: '12px', cursor: 'pointer',
                          textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 按钮行 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button onClick={handleGenerate} disabled={isGenerating || !theme.trim()} title={disabledReason} style={btnStyle}>
              {isGenerating ? '⏳ 生成中...' : noModel ? '⚠️ 请先配置 AI 模型' : '⚡ 一键推导'}
            </button>
            {noModel && !isGenerating && (
              <div style={{ textAlign: 'center', color: '#f97316', fontSize: '12px', marginTop: '4px' }}>
                提示：点击右上角「AI模型」页面添加并选择一个模型
              </div>
            )}
          </div>
        </div>
      </div>

      {/* === 生成中动画 === */}
      {isGenerating && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '14px', padding: '36px', textAlign: 'center', marginTop: '20px' }}>
          <div style={{ fontSize: '40px', marginBottom: '14px', animation: 'pulse 1.5s ease-in-out infinite' as any }}>⏳</div>
          <div style={{ color: '#e0e0e0', fontSize: '16px', marginBottom: '6px', fontWeight: 600 }}>正在推导：{deduceTask?.theme}</div>
          <div style={{ color: '#888', fontSize: '14px', marginBottom: '18px' }}>已用时 <span style={{ color: '#6366f1', fontWeight: 700 }}>{elapsed}</span> 秒</div>
          <div style={{ width: '100%', maxWidth: '400px', height: '8px', background: '#333', borderRadius: '4px', margin: '0 auto 18px', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(90, (elapsed / 60) * 100)}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #6366f1, #a78bfa, #6366f1)',
              backgroundSize: '200% 100%',
              borderRadius: '4px',
              transition: 'width 1s ease',
              animation: 'shimmer 2s linear infinite' as any,
            }} />
          </div>
          <div style={{ color: '#666', fontSize: '13px', lineHeight: 1.6 }}>
            AI 正在分析主题、构建世界观、设计角色、规划情节...<br />
            您可以切换到其他页面，推导完成后会自动保存
          </div>
        </div>
      )}

      {/* === 错误面板 === */}
      {deduceError && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '14px', padding: '20px', marginTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <span style={{ fontSize: '24px' }}>❌</span>
            <div>
              <div style={{ color: '#f87171', fontSize: '14px', fontWeight: 600 }}>推导失败</div>
              <div style={{ color: '#ccc', fontSize: '13px', marginTop: '4px' }}>{deduceError}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginLeft: '34px' }}>
            <button onClick={() => store.clearDeduceTask()} style={{ padding: '7px 16px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', color: '#aaa', fontSize: '13px', cursor: 'pointer' }}>
              关闭
            </button>
            <button onClick={() => { store.clearDeduceTask(); setTimeout(() => handleGenerate(), 100) }} style={{ padding: '7px 16px', background: '#ef4444', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>
              🔄 重试
            </button>
          </div>
        </div>
      )}

      {/* === 结果面板 === */}
      {deduceResult && !isGenerating && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '14px', padding: '24px', marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>✅ {deduceResult.title}</div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>推导完成，可保存到项目或放弃</div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleDiscard} style={{ padding: '7px 14px', background: '#1a1a1a', border: '1px solid #444', borderRadius: '8px', color: '#aaa', fontSize: '13px', cursor: 'pointer' }}>
                🗑 放弃
              </button>
              <button onClick={handleSave} style={{ padding: '7px 14px', background: '#1a1a1a', border: '1px solid #6366f1', borderRadius: '8px', color: '#818cf8', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>
                💾 保存
              </button>
              <button onClick={handleSaveAndView} style={{ padding: '7px 16px', background: '#6366f1', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>
                ✓ 保存并查看
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
            <div style={{ padding: '14px', background: '#0f0f0f', borderRadius: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#818cf8' }}>{1 + (deduceResult.supporting?.length || 0)}</div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>角色</div>
            </div>
            <div style={{ padding: '14px', background: '#0f0f0f', borderRadius: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#4ade80' }}>{deduceResult.chapters?.length || 0}</div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>章节</div>
            </div>
            <div style={{ padding: '14px', background: '#0f0f0f', borderRadius: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#facc15' }}>{deduceResult.plotLine?.events?.length || 0}</div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>事件</div>
            </div>
            <div style={{ padding: '14px', background: '#0f0f0f', borderRadius: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#f472b6' }}>{deduceResult.firstChapter || deduceResult.chapters?.[0]?.summary ? '✓' : '✗'}</div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>首章内容</div>
            </div>
          </div>

          {deduceResult.summary && (
            <div style={{ padding: '14px', background: '#0f0f0f', borderRadius: '10px' }}>
              <div style={{ fontSize: '12px', color: '#818cf8', fontWeight: 600, marginBottom: '6px' }}>📖 故事简介</div>
              <div style={{ fontSize: '13px', color: '#bbb', lineHeight: 1.7 }}>{deduceResult.summary}</div>
            </div>
          )}
        </div>
      )}
    </PageWrapper>
  )
}
