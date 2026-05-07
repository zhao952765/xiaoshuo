/**
 * 导出中心 - 设计系统版
 * 深色现代风格，主色 #FF4D94
 */
import React, { useState } from 'react'
import { useStore } from '../../store'
import { Card, Btn, Badge } from '../../components/ui'

const A = '#FF4D94'

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
  const totalStats = {
    characters: characters.length,
    chapters: chapters.length,
    worldSettings: worldSettings.length,
    tags: tags.length,
    emotionNodes: emotionArc?.nodes.length || 0,
    lustPoints: lustArc?.intensityCurve.length || 0,
  }

  const exportJSON = () => {
    const data = {
      version: '2.3.0', exportedAt: Date.now(),
      manifest: {
        projectId: currentNovel?.id || genId(), title: currentNovel?.title || '未命名', version: '2.3.0',
        files: { manifest: 'manifest.json', storyOverview: 'story_overview.md', world: 'world.json', emotionArc: 'emotion_arc.json', lustArc: 'lust_arc.json', outline: 'outline.json', characters: 'characters/', tags: 'tags.json', prompts: 'prompts.json' },
      },
      currentNovel, characters, worldSettings, chapters, plotLines, emotionArc, lustArc, tags,
    }
    downloadJSON(data, `${currentNovel?.title || 'project'}_v2.3.json`)
    addLog({ type: 'success', message: '导出 JSON 项目包', detail: '' })
  }
  const exportMarkdown = () => {
    let md = `# ${currentNovel?.title || '未命名小说'}\n\n> ${currentNovel?.summary || ''}\n\n---\n\n`
    if (characters.length > 0) {
      md += `## 角色\n\n`
      characters.forEach(c => { md += `### ${c.name}\n\n- **身份**: ${c.roleType}\n- **外貌**: ${c.appearance}\n- **性格**: ${c.personality.join('、')}\n- **背景**: ${c.background}\n\n` })
      md += `---\n\n`
    }
    chapters.sort((a, b) => a.order - b.order).forEach(ch => { md += `## ${ch.title}\n\n${ch.content || '（待写作）'}\n\n---\n\n` })
    downloadText(md, `${currentNovel?.title || 'novel'}.md`)
    addLog({ type: 'success', message: '导出 Markdown 小说', detail: '' })
  }
  const exportStructured = () => {
    setIsExporting(true)
    const files: Record<string, string> = {}
    files['manifest.json'] = JSON.stringify({ version: '2.3.0', projectId: currentNovel?.id || genId(), title: currentNovel?.title || '未命名', createdAt: Date.now(), updatedAt: Date.now(), files: { manifest: 'manifest.json', storyOverview: 'story_overview.md', world: 'world.json', emotionArc: 'emotion_arc.json', lustArc: 'lust_arc.json', outline: 'outline.json', characters: 'characters/', chapters: 'chapters/', tags: 'tags.json', prompts: 'prompts.json' } }, null, 2)
    files['story_overview.md'] = `# ${currentNovel?.title || '未命名'}\n\n${currentNovel?.summary || ''}`
    files['world.json'] = JSON.stringify(worldSettings, null, 2)
    files['emotion_arc.json'] = JSON.stringify(emotionArc, null, 2)
    files['lust_arc.json'] = JSON.stringify(lustArc, null, 2)
    files['outline.json'] = JSON.stringify(chapters.sort((a, b) => a.order - b.order).map(ch => ({ id: ch.id, title: ch.title, summary: ch.summary, order: ch.order })), null, 2)
    files['tags.json'] = JSON.stringify(tags, null, 2)
    files['prompts.json'] = JSON.stringify([{ id: 'p1', name: '续写引导', category: 'write', content: '基于上下文续写...' }], null, 2)
    characters.forEach((char, idx) => { files[`characters/char_${idx + 1}.json`] = JSON.stringify(char, null, 2) })
    chapters.sort((a, b) => a.order - b.order).forEach((ch, idx) => { files[`chapters/ch${idx + 1}.md`] = `# ${ch.title}\n\n${ch.content || ''}` })
    const structuredData = { _format: 'pns_v2.3_structured', _exportedAt: Date.now(), files }
    downloadJSON(structuredData, `${currentNovel?.title || 'project'}_structured_v2.3.json`)
    addLog({ type: 'success', message: '导出标准结构包', detail: `${Object.keys(files).length} 个文件` })
    setIsExporting(false)
  }
  const downloadJSON = (data: unknown, name: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a')
    a.href = url; a.download = name; a.click()
  }
  const downloadText = (text: string, name: string) => {
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a')
    a.href = url; a.download = name; a.click()
  }

  const handleExport = () => {
    if (!currentNovel) { addLog({ type: 'warn', message: '请先创建项目', detail: '' }); return }
    if (exportFormat === 'json') exportJSON()
    else if (exportFormat === 'markdown') exportMarkdown()
    else exportStructured()
  }

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#f0f0f0', marginBottom: '4px' }}>📤 导出中心</h2>
      <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '24px' }}>将项目数据导出为多种格式</p>

      {!currentNovel ? (
        <Card style={{ textAlign: 'center', padding: '48px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
          <div style={{ color: '#6b7280', fontSize: '14px' }}>暂无项目可导出</div>
        </Card>
      ) : (
        <>
          {/* 项目信息 */}
          <Card style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f0', marginBottom: '8px' }}>📖 {currentNovel.title}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '13px', color: '#aaa' }}>
              <div>角色: {totalStats.characters} 个</div>
              <div>章节: {totalStats.chapters} 个</div>
              <div>世界观: {totalStats.worldSettings} 个</div>
              <div>标签: {totalStats.tags} 个</div>
              <div>感情节点: {totalStats.emotionNodes}</div>
              <div>肉欲强度点: {totalStats.lustPoints}</div>
            </div>
          </Card>

          {/* 格式选择 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: '16px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#aaa' }}>选择导出格式</span>
            {[
              { id: 'json' as const, label: 'JSON 项目包', desc: '完整数据结构，可重新导入', icon: '📦' },
              { id: 'markdown' as const, label: 'Markdown 小说', desc: '纯文本格式，适合阅读', icon: '📄' },
              { id: 'structured' as const, label: 'SRS v2.3 标准结构', desc: 'project/ 目录结构多文件包', icon: '🗂️' },
            ].map((fmt) => (
              <label key={fmt.id} style={{
                padding: 14, background: '#1a1a1a', borderRadius: 8,
                border: exportFormat === fmt.id ? `1px solid ${A}` : '1px solid #2a2a2a',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                transition: 'border-color 0.15s',
              }}>
                <input type="radio" name="exportFormat" value={fmt.id}
                  checked={exportFormat === fmt.id}
                  onChange={() => setExportFormat(fmt.id)}
                  style={{ accentColor: A }} />
                <div>
                  <div style={{ color: '#f0f0f0', fontWeight: 600, fontSize: 14 }}>{fmt.icon} {fmt.label}</div>
                  <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>{fmt.desc}</div>
                </div>
              </label>
            ))}
          </div>

          {/* 导出按钮 */}
          <Btn variant="primary" size="lg" fullWidth onClick={handleExport} loading={isExporting} disabled={isExporting}>
            📥 导出项目
          </Btn>

          {/* 格式说明 */}
          <Card style={{ marginTop: '16px' }}>
            <h4 style={{ fontSize: '13px', color: '#aaa', marginBottom: 10 }}>📋 导出目录结构</h4>
            <pre style={{ color: '#4b5563', fontSize: 12, lineHeight: 1.6, margin: 0 }}>
{`project/
├── manifest.json
├── story_overview.md
├── world.json
├── emotion_arc.json
├── lust_arc.json
├── outline.json
├── characters/  (N 个角色)
├── chapters/    (N 个章节)
├── tags.json
└── prompts.json`}
            </pre>
          </Card>
        </>
      )}
    </div>
  )
}
