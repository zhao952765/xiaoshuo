/**
 * NSFW 角色卡编辑表单
 * SRS v2.3 中优先级：角色管理页增加 NSFW 档案编辑入口
 * 
 * 字段：体型 / 敏感带 / 性特质 / 癖好标签 / 经验等级
 */

import React, { useState } from 'react'
import { useStore } from '../../store'
import type { Character } from '../../../config/types'

interface NSFWFormData {
  bodyType: string
  sensitiveZones: string[]
  sexualTraits: string[]
  fetishTags: string[]
  experienceLevel: string
}

const PRESET_ZONES = ['颈部', '耳垂', '锁骨', '胸口', '腰侧', '大腿内侧', '脚踝', '手腕', '后背', '臀部']
const PRESET_TRAITS = ['敏感体质', '冷淡', '主动', '被动', '易湿', '耐操', '娇喘', '闷哼', 'dirty talk', '羞耻play']
const PRESET_FETISH = ['制服', '黑丝', '捆绑', '角色扮演', '野外', '办公室', '浴室', '车内', '公开', '主从']
const PRESET_EXPERIENCE = ['处子', '生疏', '熟练', '老练', '专家']

export default function NSFWEditor({ character, onSave }: { character: Character; onSave: (data: NSFWFormData) => void }) {
  const [data, setData] = useState<NSFWFormData>({
    bodyType: character.nsfwProfile?.bodyType || '',
    sensitiveZones: character.nsfwProfile?.sensitiveZones || [],
    sexualTraits: character.nsfwProfile?.sexualTraits || [],
    fetishTags: character.nsfwProfile?.fetishTags || [],
    experienceLevel: character.nsfwProfile?.experienceLevel || '',
  })

  const toggleItem = (field: keyof NSFWFormData, item: string) => {
    setData((prev) => {
      const arr = prev[field] as string[]
      return {
        ...prev,
        [field]: arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item],
      }
    })
  }

  return (
    <div style={{ padding: 20, color: '#e0e0e0' }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#a855f7', marginBottom: 16 }}>
        🔞 {character.name} 的 NSFW 档案
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 体型 */}
        <div>
          <label style={labelStyle}>体型描述</label>
          <input
            value={data.bodyType}
            onChange={(e) => setData((p) => ({ ...p, bodyType: e.target.value }))}
            placeholder="例如：纤细高挑，腰臀比0.7..."
            style={inputStyle}
          />
        </div>

        {/* 敏感带 */}
        <div>
          <label style={labelStyle}>敏感带 ({data.sensitiveZones.length})</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {PRESET_ZONES.map((zone) => (
              <button
                key={zone}
                onClick={() => toggleItem('sensitiveZones', zone)}
                style={{
                  padding: '4px 10px', borderRadius: 12, fontSize: 12,
                  background: data.sensitiveZones.includes(zone) ? 'rgba(168,85,247,0.2)' : '#0f0f0f',
                  color: data.sensitiveZones.includes(zone) ? '#c4b5fd' : '#6b7280',
                  border: `1px solid ${data.sensitiveZones.includes(zone) ? '#a855f7' : '#2a2a2a'}`,
                  cursor: 'pointer',
                }}
              >
                {zone}
              </button>
            ))}
          </div>
        </div>

        {/* 性特质 */}
        <div>
          <label style={labelStyle}>性特质 ({data.sexualTraits.length})</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {PRESET_TRAITS.map((trait) => (
              <button
                key={trait}
                onClick={() => toggleItem('sexualTraits', trait)}
                style={{
                  padding: '4px 10px', borderRadius: 12, fontSize: 12,
                  background: data.sexualTraits.includes(trait) ? 'rgba(236,72,153,0.2)' : '#0f0f0f',
                  color: data.sexualTraits.includes(trait) ? '#fbcfe8' : '#6b7280',
                  border: `1px solid ${data.sexualTraits.includes(trait) ? '#ec4899' : '#2a2a2a'}`,
                  cursor: 'pointer',
                }}
              >
                {trait}
              </button>
            ))}
          </div>
        </div>

        {/* 癖好标签 */}
        <div>
          <label style={labelStyle}>癖好标签 ({data.fetishTags.length})</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {PRESET_FETISH.map((fetish) => (
              <button
                key={fetish}
                onClick={() => toggleItem('fetishTags', fetish)}
                style={{
                  padding: '4px 10px', borderRadius: 12, fontSize: 12,
                  background: data.fetishTags.includes(fetish) ? 'rgba(239,68,68,0.2)' : '#0f0f0f',
                  color: data.fetishTags.includes(fetish) ? '#fca5a5' : '#6b7280',
                  border: `1px solid ${data.fetishTags.includes(fetish) ? '#ef4444' : '#2a2a2a'}`,
                  cursor: 'pointer',
                }}
              >
                {fetish}
              </button>
            ))}
          </div>
        </div>

        {/* 经验等级 */}
        <div>
          <label style={labelStyle}>经验等级</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {PRESET_EXPERIENCE.map((level) => (
              <button
                key={level}
                onClick={() => setData((p) => ({ ...p, experienceLevel: level }))}
                style={{
                  flex: 1, padding: '6px 0', borderRadius: 6,
                  background: data.experienceLevel === level ? 'rgba(139,92,246,0.2)' : '#0f0f0f',
                  color: data.experienceLevel === level ? '#d8b4fe' : '#6b7280',
                  border: `1px solid ${data.experienceLevel === level ? '#a855f7' : '#2a2a2a'}`,
                  cursor: 'pointer', fontSize: 12,
                }}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => onSave(data)}
          style={{
            padding: '10px 20px', background: '#a855f7', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
            cursor: 'pointer', marginTop: 8,
          }}
        >
          💾 保存 NSFW 档案
        </button>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', background: '#0f0f0f', border: '1px solid #2a2a2a',
  borderRadius: '6px', color: '#e0e0e0', fontSize: '13px', outline: 'none', width: '100%',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 500, color: '#9ca3af', marginBottom: 8,
}
