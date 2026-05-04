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

// ===== 旧版解析逻辑（从 F:\\1\\old 移植，保持原有行为不变） =====

interface GenerationResult {
  title: string;
  synopsis: string;
  protagonist: string;
  supportingChars: string;
  maleSupportingChars: string;
  femaleSupportingChars: string;
  worldview: string;
  emotionalLine: string;
  chapterOutline: string;
  chapterList: string;
  firstChapter: string;
}

// 解析生成结果 —— 两遍扫描法（来自旧版 CreationCenter）
function parseGenerationResult(text: string): GenerationResult {
  const result: GenerationResult = {
    title: '', synopsis: '', protagonist: '',
    supportingChars: '', maleSupportingChars: '', femaleSupportingChars: '',
    worldview: '', emotionalLine: '',
    chapterOutline: '', chapterList: '', firstChapter: '',
  };

  // ── 步骤1：定位字段标题行 ──
  type FieldRule = { key: keyof GenerationResult; keywords: string[] };
  const RULES: FieldRule[] = [
    { key: 'title',                keywords: ['小说标题', '小说题目'] },
    { key: 'synopsis',             keywords: ['小说简介', '故事简介', '内容简介'] },
    { key: 'protagonist',          keywords: ['主角设定', '主角介绍'] },
    { key: 'maleSupportingChars',  keywords: ['男配角', '男角色', '男性配角'] },
    { key: 'femaleSupportingChars',keywords: ['女配角', '女角色', '女性配角'] },
    { key: 'supportingChars',      keywords: ['主要配角设定', '配角设定', '其他配角', '配角介绍'] },
    { key: 'worldview',            keywords: ['世界观与氛围', '世界观', '世界背景'] },
    { key: 'emotionalLine',        keywords: ['感情/肉欲发展线', '情感发展线', '主要冲突线与感情', '冲突线与感情', '冲突线与情感'] },
    { key: 'chapterOutline',       keywords: ['剧情大纲', '整体规划'] },
    { key: 'chapterList',          keywords: ['章节目录'] },
    { key: 'firstChapter',         keywords: ['第一章正文', '正文内容'] },
  ];

  // 判断一行是否是"字段标题行"（而非正文中提到关键字）
  const isTitleLine = (line: string): boolean => {
    const trimmed = line.trim();
    return (
      /^【/.test(trimmed) ||
      /^#{1,4}\s/.test(trimmed) ||
      /^\*\*/.test(trimmed) ||
      /^\d+[.、．\s]/.test(trimmed) ||
      /^第[一二三四五六七八九十\d]+[章节卷]/.test(trimmed) ||
      /^[一二三四五六七八九十]+[、.．]/.test(trimmed) ||
      trimmed.length < 25
    );
  };

  const lines = text.split('\n');
  const foundHeaders: { key: keyof GenerationResult; lineIdx: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    if (!isTitleLine(trimmedLine)) continue;

    for (const rule of RULES) {
      const matched = rule.keywords.some(kw => trimmedLine.includes(kw));
      if (!matched) continue;
      if (foundHeaders.some(h => h.key === rule.key && h.lineIdx === i)) continue;
      foundHeaders.push({ key: rule.key, lineIdx: i });
      break;
    }
  }

  // 后备扫描：firstChapter
  if (!foundHeaders.some(h => h.key === 'firstChapter')) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || foundHeaders.some(h => h.lineIdx === i)) continue;
      if (/^#{1,3}\s*第一章/.test(line) || /^\*\*第一章/.test(line) ||
          /^【第一章/.test(line) || /^第一章正文/.test(line)) {
        foundHeaders.push({ key: 'firstChapter', lineIdx: i });
        break;
      }
    }
  }

  // 后备：emotionalLine
  if (!foundHeaders.some(h => h.key === 'emotionalLine')) {
    const EMOTION_EXTRA_KW = ['情感发展', '感情线', '肉欲发展', '情欲发展', '冲突线', '主要冲突', '冲突设计'];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || !isTitleLine(line)) continue;
      if (foundHeaders.some(h => h.lineIdx === i)) continue;
      if (EMOTION_EXTRA_KW.some(kw => line.includes(kw))) {
        foundHeaders.push({ key: 'emotionalLine', lineIdx: i });
        break;
      }
    }
  }

  // 后备：chapterOutline
  if (!foundHeaders.some(h => h.key === 'chapterOutline')) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || !isTitleLine(line)) continue;
      if (foundHeaders.some(h => h.lineIdx === i)) continue;
      if (line.includes('大纲')) {
        foundHeaders.push({ key: 'chapterOutline', lineIdx: i });
        break;
      }
    }
  }

  foundHeaders.sort((a, b) => a.lineIdx - b.lineIdx);

  // ── 步骤2：按区间提取内容 ──
  for (let h = 0; h < foundHeaders.length; h++) {
    const { key, lineIdx } = foundHeaders[h];
    let endIdx = lines.length;
    for (let k = h + 1; k < foundHeaders.length; k++) {
      if (foundHeaders[k].lineIdx > lineIdx) {
        endIdx = foundHeaders[k].lineIdx;
        break;
      }
    }

    const headerLine = lines[lineIdx];
    const inlineSuffix = headerLine
      .replace(/^[\d\s#.*（）()、\-—]+/, '')
      .replace(/^【[^】]*】/, '')
      .replace(/^\*\*[^*]+\*\*\s*[：:]*/, '')
      .replace(/^[^：:]*[：:]/, '')
      .trim();

    const afterLines = lines.slice(lineIdx + 1, endIdx);
    while (afterLines.length > 0 && !afterLines[afterLines.length - 1].trim()) afterLines.pop();
    const afterContent = afterLines.join('\n').trim();

    const parts: string[] = [];
    if (inlineSuffix && inlineSuffix !== headerLine.trim()) parts.push(inlineSuffix);
    if (afterContent) parts.push(afterContent);
    const combined = parts.join('\n').trim();

    if (result[key] && combined) {
      result[key] += '\n\n' + combined;
    } else if (combined) {
      result[key] = combined;
    }
  }

  // ── 步骤3：配角设定智能分配 ──
  if (result.supportingChars && !result.maleSupportingChars && !result.femaleSupportingChars) {
    const content = result.supportingChars;
    const maleIdx = content.search(/男配角|男角色|男性/);
    const femaleIdx = content.search(/女配角|女角色|女性/);
    if (maleIdx >= 0 && femaleIdx >= 0 && maleIdx < femaleIdx) {
      result.maleSupportingChars = content.slice(0, femaleIdx).trim();
      result.femaleSupportingChars = content.slice(femaleIdx).trim();
    } else if (femaleIdx >= 0 && maleIdx < 0) {
      result.femaleSupportingChars = content;
    } else {
      result.maleSupportingChars = content;
    }
  }

  // ── 步骤4：后备处理 ──
  if (!result.chapterList) {
    const chLines = lines
      .map((l, i) => ({ line: l.trim(), idx: i }))
      .filter(({ line, idx }) => {
        if (foundHeaders.some(h => h.lineIdx === idx)) return false;
        return /第[一二三四五六七八九十百\d]+章|^\s*\d+[.、．]/.test(line);
      });
    if (chLines.length > 0) {
      result.chapterList = chLines.map(c => c.line).join('\n');
    }
  }

  if (!Object.values(result).some(v => v.length > 0)) {
    result.firstChapter = text;
  }

  if (!result.title) result.title = '';
  result.title = result.title
    .replace(/[*#【】「」《》"']/g, '')
    .replace(/^小说标题[：:]\s*/, '')
    .replace(/^小说题目[：:]\s*/, '')
    .trim();

  return result;
}

/**
 * 将旧版 GenerationResult 映射为当前系统所需的 DeduceInput 格式
 * （保持旧版解析逻辑不变，仅做字段名/结构转换）
 */
function mapOldResultToCurrent(old: GenerationResult) {
  const now = Date.now();

  // 解析章节列表
  const chapterLines = (old.chapterList || '')
    .split('\n')
    .map(l => l.replace(/^[\d\s\.\-、]+/, '').trim())
    .filter(Boolean);
  const chapters = chapterLines.length > 0
    ? chapterLines.map(title => ({ title, summary: '' }))
    : [{ title: '第一章', summary: '开篇' }];

  // 解析配角
  const allSupportingText = [old.maleSupportingChars, old.femaleSupportingChars, old.supportingChars]
    .filter(Boolean).join('、');
  const supportingNames = allSupportingText
    .split(/[,，、;\s]+/).filter(Boolean);
  const supporting = supportingNames.map(name => ({
    id: `sup_${now}_${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim(), roleType: 'supporting' as const,
    basicInfo: { age: '', gender: '', occupation: '' },
    appearance: '', personality: [], background: '', abilities: '',
    relationships: [], voice: '', innerWorld: '', arc: '', tags: [], avatar: '',
    createdAt: now, updatedAt: now,
  }));

  // 主角
  const protagonist = {
    id: `prot_${now}`,
    name: old.protagonist || old.title?.slice(0, 10) || '主角',
    roleType: 'protagonist' as const,
    avatar: '', basicInfo: { age: '', gender: '', occupation: '' },
    appearance: '', personality: [], background: '', abilities: '',
    relationships: [], voice: '', innerWorld: '', arc: '', tags: [],
    createdAt: now, updatedAt: now,
  };

  // 世界观
  const worldSetting = {
    id: `world_${now}`, name: '世界观设定', worldType: 'custom' as const,
    description: old.worldview?.slice(0, 200) || '', overview: old.worldview?.slice(0, 600) || '',
    rules: [], locations: [], timeline: [],
    society: '', culture: '', economy: '',
    createdAt: now, updatedAt: now,
  };

  // 剧情线 events
  const outlineLines = (old.chapterOutline || '').split('\n').filter(Boolean);
  const plotEvents = outlineLines.length > 0
    ? outlineLines.slice(0, 8).map((l, i) => ({
        id: `evt_${now}_${i}`, title: l.replace(/^\d+[.、）\)]\s*/, '').trim(),
        description: '', order: i, chapterId: null,
      }))
    : chapters.map((ch, i) => ({
        id: `evt_${now}_${i}`, title: ch.title, description: ch.summary, order: i, chapterId: null,
      }));

  const plotLine = {
    id: `plot_${now}`, type: 'main' as const, name: '主线',
    description: old.synopsis?.slice(0, 200) || '', events: plotEvents,
    relatedCharacters: [], createdAt: now, updatedAt: now,
  };

  return {
    title: old.title || '未命名小说',
    summary: old.synopsis || '',
    firstChapter: old.firstChapter || '',
    chapters,
    supporting,
    protagonist,
    worldSetting,
    plotLine,
  };
}

// 统一入口：使用旧版解析逻辑，映射为当前格式
function parseDeduceResult(aiText: string, maleCount = 1, femaleCount = 2) {
  const oldResult = parseGenerationResult(aiText);
  const res = mapOldResultToCurrent(oldResult);

  // 根据用户设定的男女角色数调整主角与配角
  function normGender(g: any) {
    if (!g) return null
    const s = String(g).toLowerCase()
    if (s.includes('男') || s.includes('male') || s.includes('♂')) return 'male'
    if (s.includes('女') || s.includes('female') || s.includes('♀')) return 'female'
    return null
  }

  const desiredMale = Number(maleCount || 0)
  const desiredFemale = Number(femaleCount || 0)

  // 确定主角性别
  let remMale = desiredMale
  let remFemale = desiredFemale
  const protG = normGender(res.protagonist?.basicInfo?.gender)
  if (protG === 'male') remMale = Math.max(0, remMale - 1)
  else if (protG === 'female') remFemale = Math.max(0, remFemale - 1)
  else {
    if (remMale >= remFemale && remMale > 0) { res.protagonist.basicInfo = { ...res.protagonist.basicInfo, gender: '男' }; remMale = Math.max(0, remMale - 1) }
    else if (remFemale > 0) { res.protagonist.basicInfo = { ...res.protagonist.basicInfo, gender: '女' }; remFemale = Math.max(0, remFemale - 1) }
  }

  // 分组已有配角
  const males: any[] = []
  const females: any[] = []
  let unknownChars: any[] = []
  (res.supporting || []).forEach((s: any) => {
    const g = normGender(s.basicInfo?.gender)
    if (g === 'male') males.push(s)
    else if (g === 'female') females.push(s)
    else unknownChars.push(s)
  })

  const keepMales = males.slice(0, remMale)
  remMale = Math.max(0, remMale - keepMales.length)
  const keepFemales = females.slice(0, remFemale)
  remFemale = Math.max(0, remFemale - keepFemales.length)

  while ((remMale > 0 || remFemale > 0) && unknownChars.length > 0) {
    const u = unknownChars.shift() as any
    if (remMale > 0) { u.basicInfo = { ...u.basicInfo, gender: '男' }; keepMales.push(u); remMale-- }
    else if (remFemale > 0) { u.basicInfo = { ...u.basicInfo, gender: '女' }; keepFemales.push(u); remFemale-- }
  }

  function makeChar(g: '男' | '女', i: number) {
    const now2 = Date.now()
    return {
      id: `sup_${now2}_${Math.random().toString(36).slice(2,6)}`,
      name: `${g}配角${now2.toString().slice(-4)}_${i}`,
      roleType: 'supporting' as const,
      basicInfo: { age: '', gender: g, occupation: '' },
      appearance: '', personality: [], background: '', abilities: '',
      relationships: [], voice: '', innerWorld: '', arc: '', tags: [], avatar: '',
      createdAt: now2, updatedAt: now2,
    }
  }
  let idx = 1
  while (remMale > 0) { keepMales.push(makeChar('男', idx++)); remMale-- }
  while (remFemale > 0) { keepFemales.push(makeChar('女', idx++)); remFemale-- }

  res.supporting = [...keepMales, ...keepFemales]

  return res
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
  const [showFullResult, setShowFullResult] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  // 从 store 获取标签数据
  const allTags = store.tags || []
  const storeSelectedIds = store.selectedTagIds || []
  const isGenerating = deduceTask?.isRunning || false

  // 初始化时将智能标签页的已选标签同步到本地状态
  useEffect(() => {
    if (storeSelectedIds.length > 0 && selectedTags.length === 0) {
      const initialTags = allTags.filter(t => storeSelectedIds.includes(t.id)).map(t => t.name)
      if (initialTags.length > 0) {
        setSelectedTags(initialTags)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
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
      const result = parseDeduceResult(fullResult, maleCount, femaleCount)
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
        <div style={{
          background: '#1a1a1a',
          border: '1px solid #2a2a2a',
          borderRadius: '14px',
          padding: '24px',
          marginTop: '20px',
          maxHeight: '90vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          minHeight: 0,
        }}>

          {/* --- 顶部：标题 + 操作按钮 --- */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>✅ {deduceResult.title}</div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>推导完成，可保存到项目或放弃</div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleDiscard}  style={{ padding: '7px 14px', background: '#1a1a1a', border: '1px solid #444', borderRadius: '8px', color: '#aaa', fontSize: '13px', cursor: 'pointer' }}>🗑 放弃</button>
              <button onClick={handleSave}    style={{ padding: '7px 14px', background: '#1a1a1a', border: '1px solid #6366f1', borderRadius: '8px', color: '#818cf8', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>💾 保存</button>
              <button onClick={handleSaveAndView} style={{ padding: '7px 16px', background: '#6366f1', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>✓ 保存并查看</button>
            </div>
          </div>

          {/* --- 4 个统计卡片 --- */}
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

          {/* --- 故事简介 --- */}
          {deduceResult.summary && (
            <div style={{ padding: '14px', background: '#0f0f0f', borderRadius: '10px', marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', color: '#818cf8', fontWeight: 600, marginBottom: '6px' }}>📖 故事简介</div>
              <div style={{ fontSize: '13px', color: '#bbb', lineHeight: 1.7, wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{deduceResult.summary}</div>
            </div>
          )}

          {/* --- 查看全部结果按钮 + 展开面板 --- */}
          <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: '14px', marginTop: '4px' }}>
            <button onClick={() => setShowFullResult(!showFullResult)}
              style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #444', borderRadius: '8px', color: '#aaa', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{showFullResult ? '▼' : '▶'}</span>
              {showFullResult ? '收起全部推导结果' : '查看全部推导结果'}
            </button>

            {showFullResult && (
              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '14px', overflow: 'visible', height: 'auto' }}>

                {/* 章节列表 */}
                {deduceResult.chapters?.length > 0 && (
                  <div style={{ background: '#0f0f0f', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ fontSize: '12px', color: '#4ade80', fontWeight: 600, marginBottom: '8px' }}>📄 章节列表（共 {deduceResult.chapters.length} 章）</div>
                    {deduceResult.chapters.map((ch: any, idx: number) => (
                      <div key={idx} style={{ padding: '8px 12px', background: '#1a1a1a', borderRadius: '6px', marginBottom: '6px' }}>
                        <div style={{ fontSize: '13px', color: '#e0e0e0', fontWeight: 500 }}>{ch.title}</div>
                        <div style={{ fontSize: '12px', color: '#888', marginTop: '2px', lineHeight: 1.5, wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{ch.summary}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 配角列表 */}
                {deduceResult.supporting?.length > 0 && (
                  <div style={{ background: '#0f0f0f', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ fontSize: '12px', color: '#818cf8', fontWeight: 600, marginBottom: '8px' }}>👥 配角列表（共 {deduceResult.supporting.length} 个）</div>
                    {deduceResult.supporting.map((s: any, idx: number) => (
                      <div key={idx} style={{ padding: '10px 12px', background: '#1a1a1a', borderRadius: '6px', marginBottom: '6px' }}>
                        <div style={{ fontSize: '13px', color: '#e0e0e0', fontWeight: 500 }}>{idx + 1}. {s.name}</div>
                        <div style={{ fontSize: '12px', color: '#888', marginTop: '3px', lineHeight: 1.5, wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                          {s.background || '暂无描述'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#666', marginTop: '3px' }}>
                          {s.basicInfo?.gender && `性别：${s.basicInfo.gender}`}
                          {s.basicInfo?.age && ` · 年龄：${s.basicInfo.age}`}
                          {s.basicInfo?.occupation && ` · 职业：${s.basicInfo.occupation}`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 世界观 */}
                {deduceResult.worldSetting && (
                  <div style={{ background: '#0f0f0f', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ fontSize: '12px', color: '#facc15', fontWeight: 600, marginBottom: '8px' }}>🌍 世界观</div>
                    <div style={{ fontSize: '12px', color: '#bbb', lineHeight: 1.6, wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap', marginBottom: '10px' }}>
                      {deduceResult.worldSetting.description || deduceResult.worldSetting.overview || '暂无描述'}
                    </div>
                    {deduceResult.worldSetting.rules?.length > 0 && (
                      <>
                        <div style={{ fontSize: '11px', color: '#6366f1', fontWeight: 600, marginBottom: '4px' }}>📋 规则（{deduceResult.worldSetting.rules.length} 条）</div>
                        {deduceResult.worldSetting.rules.map((r: any, idx: number) => (
                        <div key={idx} style={{ padding: '6px 10px', background: '#1a1a1a', borderRadius: '4px', marginBottom: '4px', fontSize: '12px', color: '#aaa', lineHeight: 1.4, wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                            <span style={{ color: '#6366f1', fontWeight: 500 }}>{r.name}</span>
                            {r.description && <span>：{r.description}</span>}
                          </div>
                        ))}
                      </>
                    )}
                    {deduceResult.worldSetting.locations?.length > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 600, marginBottom: '4px' }}>📍 地点（{deduceResult.worldSetting.locations.length} 个）</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {deduceResult.worldSetting.locations.map((loc: any, idx: number) => (
                            <span key={idx} style={{ padding: '4px 10px', background: 'rgba(16,185,129,0.1)', color: '#34d399', borderRadius: '6px', fontSize: '12px' }}>{loc.name}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {deduceResult.worldSetting.timeline?.length > 0 && (
                      <div>
                        <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600, marginBottom: '4px' }}>📅 时间线（{deduceResult.worldSetting.timeline.length} 条）</div>
                        {deduceResult.worldSetting.timeline.map((t: any, idx: number) => (
                        <div key={idx} style={{ padding: '6px 10px', background: '#1a1a1a', borderRadius: '4px', marginBottom: '4px', fontSize: '12px', color: '#aaa', lineHeight: 1.4, wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                            {t.title || t.name}
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
                      {deduceResult.worldSetting.society && <span style={{ fontSize: '11px', color: '#888' }}>🏛️ 社会：{deduceResult.worldSetting.society}</span>}
                      {deduceResult.worldSetting.culture && <span style={{ fontSize: '11px', color: '#888' }}>🎭 文化：{deduceResult.worldSetting.culture}</span>}
                      {deduceResult.worldSetting.economy && <span style={{ fontSize: '11px', color: '#888' }}>💰 经济：{deduceResult.worldSetting.economy}</span>}
                    </div>
                  </div>
                )}

                {/* 剧情事件 */}
                {deduceResult.plotLine?.events?.length > 0 && (
                  <div style={{ background: '#0f0f0f', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ fontSize: '12px', color: '#f472b6', fontWeight: 600, marginBottom: '8px' }}>📈 剧情事件（共 {deduceResult.plotLine.events.length} 个）</div>
                    {deduceResult.plotLine.events.map((evt: any, idx: number) => (
                    <div style={{ padding: '6px 10px', background: '#1a1a1a', borderRadius: '4px', marginBottom: '4px', fontSize: '12px', color: '#ccc', lineHeight: 1.4, wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                        <span style={{ color: '#f472b6', fontWeight: 600 }}>#{idx + 1}</span> {evt.title}
                        {evt.description && <span style={{ color: '#888' }}> — {evt.description}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* 主角信息 */}
                {deduceResult.protagonist && (
                  <div style={{ background: '#0f0f0f', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ fontSize: '12px', color: '#818cf8', fontWeight: 600, marginBottom: '8px' }}>⭐ 主角</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', padding: '4px 8px', background: '#1a1a1a', borderRadius: '4px', color: '#ccc' }}>姓名：{deduceResult.protagonist.name}</span>
                      {deduceResult.protagonist.basicInfo?.gender && <span style={{ fontSize: '12px', padding: '4px 8px', background: '#1a1a1a', borderRadius: '4px', color: '#ccc' }}>性别：{deduceResult.protagonist.basicInfo.gender}</span>}
                      {deduceResult.protagonist.basicInfo?.age && <span style={{ fontSize: '12px', padding: '4px 8px', background: '#1a1a1a', borderRadius: '4px', color: '#ccc' }}>年龄：{deduceResult.protagonist.basicInfo.age}</span>}
                      {deduceResult.protagonist.basicInfo?.occupation && <span style={{ fontSize: '12px', padding: '4px 8px', background: '#1a1a1a', borderRadius: '4px', color: '#ccc' }}>职业：{deduceResult.protagonist.basicInfo.occupation}</span>}
                    </div>
                    {deduceResult.protagonist.personality?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                        {deduceResult.protagonist.personality.map((p: string, idx: number) => (
                          <span key={idx} style={{ fontSize: '11px', padding: '2px 8px', background: 'rgba(139,92,246,0.1)', color: '#a78bfa', borderRadius: '4px' }}>{p}</span>
                        ))}
                      </div>
                    )}
                    {deduceResult.protagonist.appearance && (
                      <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '4px', lineHeight: 1.5, wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                        <span style={{ color: '#888' }}>外貌：</span>{deduceResult.protagonist.appearance}
                      </div>
                    )}
                    {deduceResult.protagonist.background && (
                      <div style={{ fontSize: '12px', color: '#888', lineHeight: 1.6, wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                        <span style={{ color: '#888' }}>背景：</span>{deduceResult.protagonist.background}
                      </div>
                    )}
                    {deduceResult.protagonist.abilities && (
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px', lineHeight: 1.5, wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                        <span style={{ color: '#888' }}>能力：</span>{deduceResult.protagonist.abilities}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </PageWrapper>
  )
}
