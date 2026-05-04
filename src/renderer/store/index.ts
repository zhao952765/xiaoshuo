import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Novel,
  Character,
  WorldSetting,
  Chapter,
  PlotLine,
  Tag,
  Memory,
  AIModel,
  Log,
  OneClickResult,
  Volume,
  PolishResult,
  Conversation,
} from '../../config/types'

interface StoreState {
  // ========== 核心数据 ==========
  currentNovel: Novel | null
  characters: Character[]
  worldSettings: WorldSetting[]
  chapters: Chapter[]
  volumes: Volume[]
  plotLines: PlotLine[]
  tags: Tag[]
  memories: Memory[]
  aiModels: AIModel[]
  currentModel: AIModel | null
  logs: Log[]
  conversations: Conversation[]

  // ========== 推导结果衍生数据 ==========
  emotionEvents: Array<{ id: string; title: string; description: string; type: 'emotion' | 'adult'; characterIds: string[]; order: number }>
  outlineNodes: Array<{ id: string; title: string; content: string; order: number }>

  // ========== UI 状态 ==========
  isLoading: boolean
  adultMode: boolean
  selectedTagIds: string[]

  // ========== 应用设置 ==========
  fontSize: 'small' | 'medium' | 'large'
  autoSaveInterval: number
  autoBackup: boolean
  defaultTemperature: number
  defaultMaxTokens: number
  apiTimeout: number
}

interface StoreActions {
  // ========== 小说项目 ==========
  setNovel: (novel: Novel | null) => void
  updateNovel: (partial: Partial<Novel>) => void

  // ========== 角色 CRUD ==========
  addCharacter: (character: Character) => void
  updateCharacter: (id: string, partial: Partial<Character>) => void
  removeCharacter: (id: string) => void

  // ========== 世界观 CRUD ==========
  addWorldSetting: (ws: WorldSetting) => void
  updateWorldSetting: (id: string, partial: Partial<WorldSetting>) => void
  removeWorldSetting: (id: string) => void

  // ========== 章节 CRUD ==========
  addChapter: (chapter: Chapter) => void
  updateChapter: (id: string, partial: Partial<Chapter>) => void
  removeChapter: (id: string) => void
  reorderChapters: (ids: string[]) => void

  // ========== 卷 CRUD ==========
  addVolume: (volume: Volume) => void
  updateVolume: (id: string, partial: Partial<Volume>) => void
  removeVolume: (id: string) => void

  // ========== 剧情线 ==========
  addPlotLine: (line: PlotLine) => void
  updatePlotLine: (id: string, partial: Partial<PlotLine>) => void
  removePlotLine: (id: string) => void

  // ========== 标签 ==========
  addTag: (tag: Tag) => void
  updateTag: (id: string, partial: Partial<Tag>) => void
  removeTag: (id: string) => void
  toggleTagSelection: (id: string) => void
  toggleTagFavorite: (id: string) => void
  clearSelection: () => void

  // ========== 记忆 ==========
  addMemory: (memory: Memory) => void
  updateMemory: (id: string, partial: Partial<Memory>) => void
  removeMemory: (id: string) => void
  clearMemories: () => void

  // ========== AI 模型 ==========
  setCurrentModel: (model: AIModel | null) => void
  addModel: (model: AIModel) => void
  removeModel: (id: string) => void
  updateModel: (id: string, partial: Partial<AIModel>) => void
  setDefaultModel: (id: string) => void
  validateCurrentModel: () => void

  // ========== 日志 ==========
  addLog: (log: Omit<Log, 'id' | 'timestamp'>) => void
  clearLogs: () => void

  // ========== 对话 ==========
  addConversation: (conversation: Conversation) => void
  updateConversation: (id: string, partial: Partial<Conversation>) => void
  removeConversation: (id: string) => void
  clearConversations: () => void

  // ========== 全局状态 ==========
  setLoading: (loading: boolean) => void
  toggleAdultMode: () => void

  // ========== 应用设置 ==========
  setFontSize: (size: 'small' | 'medium' | 'large') => void
  setAutoSaveInterval: (interval: number) => void
  setAutoBackup: (enabled: boolean) => void
  setDefaultTemperature: (temp: number) => void
  setDefaultMaxTokens: (tokens: number) => void
  setApiTimeout: (timeout: number) => void

  // ========== 数据导入导出 ==========
  importFromDeduce: (result: OneClickResult) => void
  importFromLongPlan: (volumes: Volume[], chapters: Chapter[]) => void
  applyPolishResult: (chapterId: string, result: PolishResult) => void

  exportProject: () => Record<string, unknown>
  loadProject: (data: Record<string, unknown>) => void
  resetAll: () => void
}

const genId = (): string =>
  `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

const initialState: StoreState = {
  currentNovel: null,
  characters: [],
  worldSettings: [],
  chapters: [],
  volumes: [],
  plotLines: [],
  tags: [],
  memories: [],
  aiModels: [],
  currentModel: null,
  logs: [],
  conversations: [],
  isLoading: false,
  adultMode: false,
  selectedTagIds: [],
  emotionEvents: [],
  outlineNodes: [],
  fontSize: 'medium',
  autoSaveInterval: 5,
  autoBackup: false,
  defaultTemperature: 0.7,
  defaultMaxTokens: 4096,
  apiTimeout: 60,
}

export const useAppStore = create<StoreState & StoreActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ----- 小说项目 -----
      setNovel: (novel) => set({ currentNovel: novel }),
      updateNovel: (partial) =>
        set((state) => ({
          currentNovel: state.currentNovel
            ? { ...state.currentNovel, ...partial, updatedAt: Date.now() }
            : null,
        })),

      // ----- 角色 -----
      addCharacter: (character) =>
        set((state) => {
          const list = [...state.characters, character]
          if (state.currentNovel) {
            return {
              characters: list,
              currentNovel: {
                ...state.currentNovel,
                characters: [...state.currentNovel.characters, character.id],
                updatedAt: Date.now(),
              },
            }
          }
          return { characters: list }
        }),
      updateCharacter: (id, partial) =>
        set((state) => ({
          characters: state.characters.map((c) =>
            c.id === id ? { ...c, ...partial, updatedAt: Date.now() } : c
          ),
        })),
      removeCharacter: (id) =>
        set((state) => {
          const list = state.characters.filter((c) => c.id !== id)
          if (state.currentNovel) {
            return {
              characters: list,
              currentNovel: {
                ...state.currentNovel,
                characters: state.currentNovel.characters.filter((cid) => cid !== id),
                updatedAt: Date.now(),
              },
            }
          }
          return { characters: list }
        }),

      // ----- 世界观 -----
      addWorldSetting: (ws) =>
        set((state) => {
          const list = [...state.worldSettings, ws]
          if (state.currentNovel) {
            return {
              worldSettings: list,
              currentNovel: {
                ...state.currentNovel,
                worldSettings: [...state.currentNovel.worldSettings, ws.id],
                updatedAt: Date.now(),
              },
            }
          }
          return { worldSettings: list }
        }),
      updateWorldSetting: (id, partial) =>
        set((state) => ({
          worldSettings: state.worldSettings.map((w) =>
            w.id === id ? { ...w, ...partial, updatedAt: Date.now() } : w
          ),
        })),
      removeWorldSetting: (id) =>
        set((state) => {
          const list = state.worldSettings.filter((w) => w.id !== id)
          if (state.currentNovel) {
            return {
              worldSettings: list,
              currentNovel: {
                ...state.currentNovel,
                worldSettings: state.currentNovel.worldSettings.filter(
                  (wid) => wid !== id
                ),
                updatedAt: Date.now(),
              },
            }
          }
          return { worldSettings: list }
        }),

      // ----- 章节 -----
      addChapter: (chapter) =>
        set((state) => {
          const list = [...state.chapters, chapter]
          if (state.currentNovel) {
            return {
              chapters: list,
              currentNovel: {
                ...state.currentNovel,
                chapters: [...state.currentNovel.chapters, chapter.id],
                updatedAt: Date.now(),
              },
            }
          }
          return { chapters: list }
        }),
      updateChapter: (id, partial) =>
        set((state) => ({
          chapters: state.chapters.map((c) =>
            c.id === id ? { ...c, ...partial, updatedAt: Date.now() } : c
          ),
        })),
      removeChapter: (id) =>
        set((state) => {
          const list = state.chapters.filter((c) => c.id !== id)
          if (state.currentNovel) {
            return {
              chapters: list,
              currentNovel: {
                ...state.currentNovel,
                chapters: state.currentNovel.chapters.filter((cid) => cid !== id),
                updatedAt: Date.now(),
              },
            }
          }
          return { chapters: list }
        }),
      reorderChapters: (ids) =>
        set((state) => ({
          chapters: ids
            .map((id) => state.chapters.find((c) => c.id === id))
            .filter((c): c is Chapter => c !== undefined)
            .map((c, index) => ({ ...c, order: index })),
        })),

      // ----- 卷 -----
      addVolume: (volume) =>
        set((state) => ({
          volumes: [...state.volumes, volume],
        })),
      updateVolume: (id, partial) =>
        set((state) => ({
          volumes: state.volumes.map((v) =>
            v.id === id ? { ...v, ...partial, updatedAt: Date.now() } : v
          ),
        })),
      removeVolume: (id) =>
        set((state) => ({
          volumes: state.volumes.filter((v) => v.id !== id),
          chapters: state.chapters.filter((c) => c.volumeId !== id),
        })),

      // ----- 剧情线 -----
      addPlotLine: (line) =>
        set((state) => ({
          plotLines: [...state.plotLines, line],
        })),
      updatePlotLine: (id, partial) =>
        set((state) => ({
          plotLines: state.plotLines.map((p) =>
            p.id === id ? { ...p, ...partial, updatedAt: Date.now() } : p
          ),
        })),
      removePlotLine: (id) =>
        set((state) => ({
          plotLines: state.plotLines.filter((p) => p.id !== id),
        })),

      // ----- 标签 -----
      addTag: (tag) =>
        set((state) => ({
          tags: [...state.tags, tag],
        })),
      updateTag: (id, partial) =>
        set((state) => ({
          tags: state.tags.map((t) =>
            t.id === id ? { ...t, ...partial } : t
          ),
        })),
      removeTag: (id) =>
        set((state) => ({
          tags: state.tags.filter((t) => t.id !== id),
          selectedTagIds: state.selectedTagIds.filter((i) => i !== id),
        })),
      toggleTagSelection: (id) =>
        set((state) => ({
          selectedTagIds: state.selectedTagIds.includes(id)
            ? state.selectedTagIds.filter((i) => i !== id)
            : [...state.selectedTagIds, id],
        })),
      toggleTagFavorite: (id) =>
        set((state) => ({
          tags: state.tags.map((t) =>
            t.id === id ? { ...t, isFavorite: !t.isFavorite } : t
          ),
        })),
      clearSelection: () => set({ selectedTagIds: [] }),

      // ----- 记忆 -----
      addMemory: (memory) =>
        set((state) => ({
          memories: [memory, ...state.memories],
        })),
      updateMemory: (id, partial) =>
        set((state) => ({
          memories: state.memories.map((m) =>
            m.id === id ? { ...m, ...partial } : m
          ),
        })),
      removeMemory: (id) =>
        set((state) => ({
          memories: state.memories.filter((m) => m.id !== id),
        })),
      clearMemories: () => set({ memories: [] }),

      // ----- AI 模型 -----
      setCurrentModel: (model) => set({ currentModel: model }),
      addModel: (model) =>
        set((state) => {
          const list = [...state.aiModels, model]
          return {
            aiModels: list,
            currentModel: state.currentModel ?? model,
          }
        }),
      removeModel: (id) =>
        set((state) => {
          const list = state.aiModels.filter((m) => m.id !== id)
          return {
            aiModels: list,
            currentModel:
              state.currentModel?.id === id
                ? list[0] ?? null
                : state.currentModel,
          }
        }),
      updateModel: (id, partial) =>
        set((state) => ({
          aiModels: state.aiModels.map((m) =>
            m.id === id ? { ...m, ...partial, updatedAt: Date.now() } : m
          ),
        })),
      setDefaultModel: (id) =>
        set((state) => ({
          aiModels: state.aiModels.map((m) => ({ ...m, isDefault: m.id === id })),
          currentModel: state.aiModels.find((m) => m.id === id) ?? state.currentModel,
        })),
      validateCurrentModel: () => {
        const state = get()
        if (state.currentModel && !state.aiModels.some((m) => m.id === state.currentModel!.id)) {
          set({ currentModel: state.aiModels[0] ?? null })
        }
        if (!state.currentModel && state.aiModels.length > 0) {
          set({ currentModel: state.aiModels[0] })
        }
      },

      // ----- 日志 -----
      addLog: (log) =>
        set((state) => ({
          logs: [
            {
              id: genId(),
              timestamp: Date.now(),
              ...log,
            },
            ...state.logs,
          ].slice(0, 500),
        })),
      clearLogs: () => set({ logs: [] }),

      // ----- 对话 -----
      addConversation: (conversation) =>
        set((state) => ({
          conversations: [conversation, ...state.conversations],
        })),
      updateConversation: (id, partial) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, ...partial, updatedAt: Date.now() } : c
          ),
        })),
      removeConversation: (id) =>
        set((state) => ({
          conversations: state.conversations.filter((c) => c.id !== id),
        })),
      clearConversations: () => set({ conversations: [] }),

      // ----- 全局状态 -----
      setLoading: (loading) => set({ isLoading: loading }),
      toggleAdultMode: () =>
        set((state) => ({
          adultMode: !state.adultMode,
        })),

      // ----- 应用设置 -----
      setFontSize: (size) => set({ fontSize: size }),
      setAutoSaveInterval: (interval) => set({ autoSaveInterval: interval }),
      setAutoBackup: (enabled) => set({ autoBackup: enabled }),
      setDefaultTemperature: (temp) => set({ defaultTemperature: temp }),
      setDefaultMaxTokens: (tokens) => set({ defaultMaxTokens: tokens }),
      setApiTimeout: (timeout) => set({ apiTimeout: timeout }),

      // ----- 一键推导结果导入 -----
      importFromDeduce: (result) =>
        set((state) => {
          // 安全降级
          const safeResult = {
            title: result.title || '未命名项目',
            summary: result.summary || '',
            protagonist: result.protagonist || { id: genId(), name: '主角', roleType: 'protagonist' as const, avatar: '', basicInfo: { age: '', gender: '', occupation: '' }, appearance: '', personality: [], background: '', abilities: '', relationships: [], voice: '', innerWorld: '', arc: '', tags: [], createdAt: Date.now(), updatedAt: Date.now() },
            supporting: result.supporting || [],
            worldSetting: result.worldSetting || { id: genId(), name: '默认世界观', worldType: 'custom' as const, description: '', overview: '', rules: [], locations: [], timeline: [], society: '', culture: '', economy: '', createdAt: Date.now(), updatedAt: Date.now() },
            plotLine: result.plotLine || { id: genId(), type: 'main' as const, name: '主线', description: '', events: [], relatedCharacters: [], createdAt: Date.now(), updatedAt: Date.now() },
            chapters: result.chapters?.length > 0 ? result.chapters : [
              { title: '第一章 开端', summary: '故事开始...' },
              { title: '第二章 发展', summary: '冲突升级...' },
              { title: '第三章 转折', summary: '意外发现...' },
              { title: '第四章 高潮', summary: '最终对决...' },
              { title: '第五章 结局', summary: '尘埃落定...' },
            ],
            firstChapter: result.firstChapter || '',
          }

          const allChars = [safeResult.protagonist, ...safeResult.supporting]
          const charIds = allChars.map((c) => c.id)

          const newChapters = safeResult.chapters.map((ch: any, index: number) => ({
            id: genId(),
            title: ch.title,
            summary: ch.summary,
            content: '',
            order: index,
            status: 'draft' as const,
            volumeId: null,
            wordCount: 0,
            mood: '',
            characters: charIds,
            hooks: '',
            tags: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }))

          // 生成感情线事件
          const plotEvents = safeResult.plotLine.events || []
          const emotionEvents = [
            ...plotEvents.slice(0, 3).map((e: any, idx: number) => ({
              id: genId(),
              title: e.title || `感情事件 ${idx + 1}`,
              description: e.description || '',
              type: (safeResult.plotLine.type === 'erotic' ? 'adult' : 'emotion') as 'emotion' | 'adult',
              characterIds: charIds.slice(0, 2),
              order: idx,
            })),
            ...Array.from({ length: Math.max(0, 3 - plotEvents.length) }, (_, i) => ({
              id: genId(),
              title: `感情发展 ${plotEvents.length + i + 1}`,
              description: '待补充感情线描述...',
              type: 'emotion' as const,
              characterIds: charIds.slice(0, 2),
              order: plotEvents.length + i,
            })),
          ]

          // 生成剧情大纲节点
          const outlineNodes = newChapters.slice(0, 5).map((ch: any, idx: number) => ({
            id: genId(),
            title: ch.title,
            content: ch.summary,
            order: idx,
          }))

          const novel: Novel = {
            id: genId(),
            title: safeResult.title,
            summary: safeResult.summary,
            adultMode: state.adultMode,
            tags: [],
            targetWords: '30000',
            characters: charIds,
            worldSettings: [safeResult.worldSetting.id],
            chapters: newChapters.map((c) => c.id),
            plotLines: [safeResult.plotLine.id],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }

          return {
            currentNovel: novel,
            characters: [...state.characters, ...allChars],
            worldSettings: [...state.worldSettings, safeResult.worldSetting],
            plotLines: [...state.plotLines, safeResult.plotLine],
            chapters: [...state.chapters, ...newChapters],
            emotionEvents,
            outlineNodes,
          }
        }),

      // ----- 长篇规划结果导入 -----
      importFromLongPlan: (volumes, chapters) =>
        set((state) => ({
          volumes: [...state.volumes, ...volumes],
          chapters: [...state.chapters, ...chapters],
          currentNovel: state.currentNovel
            ? {
                ...state.currentNovel,
                chapters: [
                  ...state.currentNovel.chapters,
                  ...chapters.map((c) => c.id),
                ],
                updatedAt: Date.now(),
              }
            : null,
        })),

      // ----- 润色结果应用 -----
      applyPolishResult: (chapterId, result) =>
        set((state) => ({
          chapters: state.chapters.map((c) =>
            c.id === chapterId
              ? {
                  ...c,
                  content: result.polished,
                  status: 'polished' as const,
                  updatedAt: Date.now(),
                }
              : c
          ),
        })),

      // ----- 项目导出 -----
      exportProject: () => {
        const state = get()
        return {
          version: '1.0.0',
          exportedAt: Date.now(),
          currentNovel: state.currentNovel,
          characters: state.characters,
          worldSettings: state.worldSettings,
          chapters: state.chapters,
          volumes: state.volumes,
          plotLines: state.plotLines,
          tags: state.tags,
          aiModels: state.aiModels,
          currentModelId: state.currentModel?.id ?? null,
          adultMode: state.adultMode,
          conversations: state.conversations,
        }
      },

      // ----- 项目加载 -----
      loadProject: (data) => {
        if (!data || typeof data !== 'object') return
        const d = data as Record<string, unknown>

        // 兼容旧数据：补充新字段默认值
        const novel = (d.currentNovel as any) || null
        if (novel) {
          if (!novel.emotionEvents) novel.emotionEvents = []
          if (!novel.outlineNodes) novel.outlineNodes = []
        }

        const currentModelId = d.currentModelId as string | null

        const loadedModels = (d.aiModels as AIModel[] | undefined) ?? []
        const loadedCurrentModel = currentModelId
          ? loadedModels.find((m) => m.id === currentModelId) ?? null
          : null

        set({
          currentNovel: novel as Novel | null,
          characters: (d.characters as Character[] | undefined) ?? [],
          worldSettings:
            (d.worldSettings as WorldSetting[] | undefined) ?? [],
          chapters: (d.chapters as Chapter[] | undefined) ?? [],
          volumes: (d.volumes as Volume[] | undefined) ?? [],
          plotLines: (d.plotLines as PlotLine[] | undefined) ?? [],
          tags: (d.tags as Tag[] | undefined) ?? [],
          aiModels: loadedModels,
          currentModel: loadedCurrentModel ?? loadedModels[0] ?? null,
          adultMode: (d.adultMode as boolean | undefined) ?? false,
          conversations: (d.conversations as Conversation[] | undefined) ?? [],
          emotionEvents: (d as any).emotionEvents || [],
          outlineNodes: (d as any).outlineNodes || [],
        })
      },

      // ----- 重置全部 -----
      resetAll: () => set({ ...initialState }),
    }),
    {
      name: 'private-novel-studio-pro-storage',
      partialize: (state) => ({
        currentNovel: state.currentNovel,
        characters: state.characters,
        worldSettings: state.worldSettings,
        chapters: state.chapters,
        volumes: state.volumes,
        plotLines: state.plotLines,
        tags: state.tags,
        memories: state.memories,
        aiModels: state.aiModels,
        currentModel: state.currentModel,
        adultMode: state.adultMode,
        conversations: state.conversations,
        emotionEvents: state.emotionEvents,
        outlineNodes: state.outlineNodes,
        fontSize: state.fontSize,
        autoSaveInterval: state.autoSaveInterval,
        autoBackup: state.autoBackup,
        defaultTemperature: state.defaultTemperature,
        defaultMaxTokens: state.defaultMaxTokens,
        apiTimeout: state.apiTimeout,
      }),
    }
  )
)

// 统一导出，兼容 useStore 和 useAppStore 两种导入
export { useAppStore as useStore }
export default useAppStore
