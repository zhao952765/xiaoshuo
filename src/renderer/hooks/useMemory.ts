import { useState, useCallback } from 'react'

export interface MemoryItem {
  id: string
  type: 'character' | 'world' | 'plot'
  content: string
}

const MAX_MEMORY = 50

export function useMemory() {
  const [memory, setMemory] = useState<MemoryItem[]>([])

  const addMemory = useCallback((item: Omit<MemoryItem, 'id'>) => {
    const newItem: MemoryItem = { ...item, id: Date.now().toString(36) }
    setMemory(prev => [...prev, newItem].slice(-MAX_MEMORY))
  }, [])

  const buildMemoryPrompt = useCallback(() => {
    const grouped: Record<string, string[]> = { character: [], world: [], plot: [] }
    memory.forEach(m => { grouped[m.type]?.push(m.content) })
    return [
      `【角色设定】\n${grouped.character.join('\n') || '无'}`,
      `【世界观】\n${grouped.world.join('\n') || '无'}`,
      `【剧情进展】\n${grouped.plot.join('\n') || '无'}`,
    ].join('\n')
  }, [memory])

  return { memory, addMemory, buildMemoryPrompt }
}
