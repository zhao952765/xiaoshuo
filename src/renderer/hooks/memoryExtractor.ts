import type { MemoryItem } from './useMemory'

const RULES: Array<{ keywords: string[]; type: MemoryItem['type']; priority: number }> = [
  { keywords: ['名字', '名叫', '名为', '姓名', '人称', '角色'], type: 'character', priority: 1 },
  { keywords: ['世界', '大陆', '位面', '宇宙', '星球'], type: 'world', priority: 2 },
  { keywords: ['发生', '突然', '就在这时', '接下来', '剧情', '转折'], type: 'plot', priority: 3 },
]

export function extractMemory(
  text: string,
  addMemory: (item: Omit<MemoryItem, 'id'>) => void,
): void {
  const matched = new Set<MemoryItem['type']>()
  for (const rule of RULES) {
    if (matched.has(rule.type)) continue
    if (rule.keywords.some(kw => text.includes(kw))) {
      matched.add(rule.type)
      const lines = text.split('\n').filter(l => l.trim().length > 10)
      const bestLine = lines.find(l => rule.keywords.some(kw => l.includes(kw)))
      addMemory({
        type: rule.type,
        content: (bestLine || text).slice(0, 150),
      })
    }
  }
}
