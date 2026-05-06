import { useState } from 'react'

export interface MemoryItem {
  id: string
  type: 'character' | 'world' | 'plot'
  content: string
}

const MAX_MEMORY = 50

export function useMemory() {
  const [memory, setMemory] = useState<MemoryItem[]>([])

  const addMemory = (item: Omit<MemoryItem, 'id'>) => {
    const newItem = {
      ...item,
      id: Date.now().toString(),
    }

    setMemory(prev =>
      [...prev, newItem].slice(-MAX_MEMORY)
    )
  }

  const buildMemoryPrompt = () => {
    const grouped = {
      character: [],
      world: [],
      plot: [],
    } as Record<string, string[]>

    memory.forEach(m => {
      grouped[m.type].push(m.content)
    })

    return `
【角色设定】
${grouped.character.join('\n') || '无'}

【世界观】
${grouped.world.join('\n') || '无'}

【剧情进展】
${grouped.plot.join('\n') || '无'}
`
  }

  return {
    memory,
    addMemory,
    buildMemoryPrompt,
  }
}
