/**
 * 导出中心（Export Center）
 * SRS v2.3 要求：项目数据包导出（JSON + Markdown 双格式）
 * 
 * 导出格式：
 * - JSON 项目包（完整数据结构）
 * - Markdown 小说（纯文本阅读）
 * - SRS v2.3 标准目录结构 ZIP
 */

import React, { useState } from 'react'
import { useStore } from '../../store'

export default function ExportPage() {
  const currentNovel = useStore((s) => s.currentNovel)
  const characters = useStore((s) => s.characters)
  const chapters = useStore((s) => s.chapters)
  const worldSettings = useStore((s) => s.worldSettings)
  const plotLines = useStore((s) => s.plotLines)
  const emotionArc = useStore((s) => s.emotionArc)
  const lustArc = useStore((s) => s.lustArc)
  const tags = useStore((s) => s.tags)
  const addLog = useStore((s) => s.addLog)

  const [exportFormat, setExportFormat] = useState<'json' | 'markdown' | 'structured'>('json')
  const [isExporting, setIsExporting] = useState(false)

  const genId = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

  // 导出 JSON 项目包
  const exportJSON = () => {
    const data = {
      version: '2.3.0',
      exportedAt: Date.now(),
      manifest: {
        projectId: currentNovel?.id || genId(),
        title: currentNovel?.title || '未命名',
        version: '2.3.0',
        files: {
          manifest: 'manifest.json',
          storyOverview: 'story_overview.md',
          world: 'world.json',
          emotionArc: 'emotion_arc.json',
          lustArc: 'lust_arc.json',
          outline: 'outline.json',
          characters: 'characters/',
          tags: 'tags.json',
          prompts: 'prompts.json',
        },
      },
      currentNovel,
      characters,
      worldSettings,
      chapters,
      plotLines,
      emotionArc,
      lustArc,
      tags,
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentNovel?.title || 'project'}_v2.3.json`
    a.click()
    addLog({ type: 'success', message: '导出 JSON 项目包', detail: `${currentNovel?.title || 'project'}.json` })
  }

  // 导出 Markdown 小说
  const exportMarkdown = () => {
    let md = `# ${currentNovel?.title || '未命名小说'}\n\n`
    md += `> ${currentNovel?.summary || ''}\n\n`
    md += `---\n\n`

    // 角色表
    if (characters.length > 0) {
      md += `## 角色\n\n`
      characters.forEach((char) => {
        md += `### ${char.name}\n\n`
        md += `- **身份**: ${char.roleType === 'protagonist' ? '主角' : char.roleType === 'antagonist' ? '反派' : '配角'}\n`
        md += `- **外貌**: ${char.appearance}\n`
        md += `- **性格**: ${char.personality.join('、')}\n`
        md += `- **背景**: ${char.background}\n\n`
      })
      md += `---\n\n`
    }

    // 章节
    chapters.sort((a, b) => a.order - b.order).forEach((ch) => {
      md += `## ${ch.title}\n\n`
      md += `${ch.content || '（待写作）'}\n\n`
      md += `---\n\n`
    })

    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentNovel?.title || 'novel'}.md`
    a.click()
    addLog({ type: 'success', message: '导出 Markdown 小说', detail: `${currentNovel?.title || 'novel'}.md` })
  }

  // 导出 SRS v2.3 标准结构（多文件 ZIP 模拟）
  const exportStructured = () => {
    setIsExporting(true)

    // 构建标准目录结构的文件列表
    const files: Record<string, string> = {}

    files['manifest.json'] = JSON.stringify({
      version: '2.3.0',
      projectId: currentNovel?.id || genId(),
      title: currentNovel?.title || '未命名',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      files: {
        manifest: 'manifest.json',
        storyOverview: 'story_overview.md',
        world: 'world.json',
        emotionArc: 'emotion_arc.json',
        lustArc: 'lust_arc.json',
        outline: 'outline.json',
        characters: 'characters/',
        chapters: 'chapters/',
        tags: 'tags.json',
        prompts: 'prompts.json',
      },
    }, null, 2)

    files['story_overview.md'] = `# ${currentNovel?.title || '未命名'}\n\n${currentNovel?.summary || ''}`

    files['world.json'] = JSON.stringify(worldSettings, null, 2)
    files['emotion_arc.json'] = JSON.stringify(emotionArc, null, 2)
    files['lust_arc.json'] = JSON.stringify(lustArc, null, 2)
    files['outline.json'] = JSON.stringify(
      chapters.sort((a, b) => a.order - b.order).map((ch) => ({
        id: ch.id,
        title: ch.title,
        summary: ch.summary,
        order: ch.order,
      })),
      null,
      2,
    )
    files['tags.json'] = JSON.stringify(tags, null, 2)
    files['prompts.json'] = JSON.stringify(
      [
        { id: 'p1', name: '续写引导', category: 'write', content: '基于上下文续写...' },
        { id: 'p2', name: '润色-文学化', category: 'polish', content: '文学化润色...' },
        { id: 'p3', name: '润色-情欲强化', category: 'polish', content: '情欲氛围强化...' },
      ],
      null,
      2,
    )

    characters.forEach((char, idx) => {
      files[`characters/char_${idx + 1}.json`] = JSON.stringify(char, null, 2)
    })

    chapters.sort((a, b) => a.order - b.order).forEach((ch, idx) => {
      files[`chapters/ch${idx + 1}.md`] = `# ${ch.title}\n\n${ch.content || ''}`
    })

    // 生成一个包含所有文件的 JSON（模拟 ZIP 结构）
    const structuredData = {
      _format: 'pns_v2.3_structured',
      _exportedAt: Date.now(),
      files,
    }

    const blob = new Blob([JSON.stringify(structuredData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentNovel?.title || 'project'}_structured_v2.3.json`
    a.click()

    addLog({ type: 'success', message: '导出标准结构包', detail: `${Object.keys(files).length} 个文件` })
    setIsExporting(false)
  }

  const handleExport = () => {
    if (!currentNovel) {
      addLog({ type: 'warn', message: '请先创建项目', detail: '' })
      return
    }
    if (exportFormat === 'json') exportJSON()
    else if (exportFormat === 'markdown') exportMarkdown()
    else exportStructured()
  }

  return (
    <div style={{ padding: '24px', maxWidth: 700, margin: '0 auto', color: '#e0e0e0' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>📤 导出中心</h2>

      {!currentNovel ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', background: '#0a0a0a', borderRadius: 10 }}>
          暂无项目可导出
        </div>
      ) : (
        <>
          {/* 项目信息 */}
          <div style={{ padding: 16, background: '#0a0a0a', borderRadius: 10, border: '1px solid #1a1a1a', marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e0e0e0', marginBottom: 8 }}>
              📖 {currentNovel.title}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13, color: '#9ca3af' }}>
              <div>角色: {characters.length} 个</div>
              <div>章节: {chapters.length} 个</div>
              <div>世界观: {worldSettings.length} 个</div>
              <div>标签: {tags.length} 个</div>
              <div>感情节点: {emotionArc?.nodes.length || 0}</div>
              <div>肉欲强度点: {lustArc?.intensityCurve.length || 0}</div>
            </div>
          </div>

          {/* 格式选择 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#9ca3af' }}>选择导出格式</h3>
            {[
              { id: 'json' as const, label: 'JSON 项目包', desc: '完整数据结构，可重新导入', icon: '📦' },
              { id: 'markdown' as const, label: 'Markdown 小说', desc: '纯文本格式，适合阅读', icon: '📄' },
              { id: 'structured' as const, label: 'SRS v2.3 标准结构', desc: 'project/ 目录结构，多文件包', icon: '🗂️' },
            ].map((fmt) => (
              <label
                key={fmt.id}
                style={{
                  padding: 14, background: '#0a0a0a', borderRadius: 8,
                  border: exportFormat === fmt.id ? '1px solid #8b5cf6' : '1px solid #1a1a1a',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                }}
              >
                <input
                  type="radio"
                  name="exportFormat"
                  value={fmt.id}
                  checked={exportFormat === fmt.id}
                  onChange={() => setExportFormat(fmt.id)}
                  style={{ accentColor: '#8b5cf6' }}
                />
                <div>
                  <div style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 14 }}>
                    {fmt.icon} {fmt.label}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>{fmt.desc}</div>
                </div>
              </label>
            ))}
          </div>

          {/* 导出按钮 */}
          <button
            onClick={handleExport}
            disabled={isExporting}
            style={{
              width: '100%', padding: 12, background: '#8b5cf6', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600,
              cursor: 'pointer', opacity: isExporting ? 0.6 : 1,
            }}
          >
            {isExporting ? '⏳ 导出中...' : '📥 导出项目'}
          </button>

          {/* 格式说明 */}
          <div style={{ marginTop: 20, padding: 16, background: '#0a0a0a', borderRadius: 8, border: '1px solid #1a1a1a' }}>
            <h4 style={{ fontSize: 13, color: '#9ca3af', marginBottom: 10 }}>📋 导出内容清单</h4>
            <pre style={{ color: '#4b5563', fontSize: 12, lineHeight: 1.6, margin: 0 }}>
{`project/
├── manifest.json           ← 项目元数据
├── story_overview.md       ← 标题+简介
├── world.json              ← 世界观设定
├── emotion_arc.json        ← 感情线 (nodes+edges+timeline)
├── lust_arc.json           ← 肉欲线 (intensity_curve+climax_points)
├── outline.json            ← 章节目录大纲
├── characters/
│   ├── char_1.json         ← 角色档案 (含 NSFW)
│   └── ...
├── chapters/
│   ├── ch1.md              ← 章节正文
│   └── ...
├── tags.json               ← 标签数据
└── prompts.json            ← Prompt 模板`}
            </pre>
          </div>
        </>
      )}
    </div>
  )
}
