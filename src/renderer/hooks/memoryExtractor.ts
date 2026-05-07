/**
 * 从 AI 回复中提取记忆片段
 */
import type { MemoryItem } from './useMemory'

export function extractMemory(text: string, addMemory: (item: Omit<MemoryItem, 'id'>) => void) {
  // 简单启发式：超过 20 字且包含关键字的句子视为可能有价值
  const lines = text.split(/[。！？\n]/).map((s) => s.trim()).filter((s) => s.length > 20)

  for (const line of lines.slice(0, 3)) {
    const lower = line.toLowerCase()
    if (lower.includes('角色') || lower.includes('人物')) {
      addMemory({ type: 'character', content: line })
    } else if (lower.includes('世界') || lower.includes('设定') || lower.includes('背景')) {
      addMemory({ type: 'world', content: line })
    } else if (lower.includes('剧情') || lower.includes('情节') || lower.includes('故事')) {
      addMemory({ type: 'plot', content: line })
    }
  }
}
