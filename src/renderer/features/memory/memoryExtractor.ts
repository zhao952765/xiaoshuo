import { MemoryItem } from './useMemory'

export function extractMemory(
  text: string,
  addMemory: (item: Omit<MemoryItem, 'id'>) => void
) {
  // 简单规则版（可升级AI版）

  if (text.includes('名字')) {
    addMemory({
      type: 'character',
      content: text.slice(0, 100),
    })
  }

  if (text.includes('世界') || text.includes('大陆')) {
    addMemory({
      type: 'world',
      content: text.slice(0, 100),
    })
  }

  if (text.includes('发生') || text.includes('剧情')) {
    addMemory({
      type: 'plot',
      content: text.slice(0, 100),
    })
  }
}
