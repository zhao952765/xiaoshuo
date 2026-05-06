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
  EmotionArc,
  LustArc,
  OutlineNode,
} from '../../config/types'
import { transformDeduceToAppData, emotionArcToEvents } from '../../renderer/utils/deduceTransformer'

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

  // ========== SRS v2.3: 感情线 & 肉欲线（独立状态，与 novel 关联）==========
  emotionArc: EmotionArc | null
  lustArc: LustArc | null

  // ========== 兼容旧版：大纲节点 ==========
  outlineNodes: OutlineNode[]

  // ========== 推导任务状态（跨页面持久） ==========
  deduceTask: {
    isRunning: boolean
    theme: string
    maleCount: number
    femaleCount: number
    targetLength: string
    adultMode: boolean
    result: any | null
    error: string | null
    startTime: number
  } | null

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

  // ========== 上次推导结果（页面级持久） ==========
  lastDeduceResult: OneClickResult | null
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
  removeTagsBatch: (ids: string[]) => void
  clearAllTags: () => void
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

  // ========== SRS v2.3: 感情线 & 肉欲线 CRUD ==========
  setEmotionArc: (arc: EmotionArc | null) => void
  updateEmotionArc: (partial: Partial<EmotionArc>) => void
  setLustArc: (arc: LustArc | null) => void
  updateLustArc: (partial: Partial<LustArc>) => void

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

  // ========== 推导任务管理（跨页面持久） ==========
  startDeduceTask: (params: { theme: string; maleCount: number; femaleCount: number; targetLength: string }) => void
  completeDeduceTask: (result: any) => void
  failDeduceTask: (error: string) => void
  clearDeduceTask: () => void

  // ========== 数据导入导出 ==========
  importFromDeduce: (result: OneClickResult, firstChapterContent?: string) => void
  importFromLongPlan: (volumes: Volume[], chapters: Chapter[]) => void
  applyPolishResult: (chapterId: string, result: PolishResult) => void

  exportProject: () => Record<string, any>
  loadProject: (data: Record<string, any>) => void
  resetAll: () => void
  clearAllData: () => void
  setLastDeduceResult: (result: OneClickResult | null) => void

  // ========== 兼容旧版：大纲节点更新 ==========
  updateOutlineNodes: (nodes: OutlineNode[]) => void
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
  emotionArc: null,
  lustArc: null,
  outlineNodes: [],
  deduceTask: null,
  fontSize: 'medium',
  autoSaveInterval: 5,
  autoBackup: false,
  defaultTemperature: 0.7,
  defaultMaxTokens: 4096,
  apiTimeout: 60,
  lastDeduceResult: null,
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
      removeTagsBatch: (ids) =>
        set((state) => ({
          tags: state.tags.filter((t) => !ids.includes(t.id)),
          selectedTagIds: state.selectedTagIds.filter((i) => !ids.includes(i)),
        })),
      clearAllTags: () =>
        set({ tags: [], selectedTagIds: [] }),
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

      // ----- SRS v2.3: 感情线 & 肉欲线 -----
      setEmotionArc: (arc) => set({ emotionArc: arc }),
      updateEmotionArc: (partial) =>
        set((state) => ({
          emotionArc: state.emotionArc
            ? { ...state.emotionArc, ...partial, updatedAt: Date.now() }
            : null,
        })),
      setLustArc: (arc) => set({ lustArc: arc }),
      updateLustArc: (partial) =>
        set((state) => ({
          lustArc: state.lustArc
            ? { ...state.lustArc, ...partial, updatedAt: Date.now() }
            : null,
        })),

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

      // ----- 推导任务管理（跨页面持久） -----
      startDeduceTask: (params) => set({
        deduceTask: {
          isRunning: true,
          theme: params.theme,
          maleCount: params.maleCount,
          femaleCount: params.femaleCount,
          targetLength: params.targetLength,
          adultMode: get().adultMode,
          result: null,
          error: null,
          startTime: Date.now(),
        },
      }),
      completeDeduceTask: (result) => set((state) => ({
        deduceTask: state.deduceTask ? { ...state.deduceTask, isRunning: false, result } : null,
      })),
      failDeduceTask: (error) => set((state) => ({
        deduceTask: state.deduceTask ? { ...state.deduceTask, isRunning: false, error } : null,
      })),
      clearDeduceTask: () => set({ deduceTask: null }),

      // ----- 一键推导结果导入（SRS v2.3 修复） -----
      importFromDeduce: (result, firstChapterContent?: string) =>
        set((state) => {
          const mergedFirstChapter = firstChapterContent || result.firstChapter || ''
          const novelId = genId()

          const appData = transformDeduceToAppData(result, {
            firstChapterContent: mergedFirstChapter,
            adultMode: state.deduceTask?.adultMode ?? state.adultMode,
            novelId,
          })

          const novel: Novel = {
            id: novelId,
            title: result.title || '未命名项目',
            summary: result.summary || '',
            adultMode: state.deduceTask?.adultMode ?? state.adultMode,
            tags: appData.tags.map(t => t.id),
            targetWords: '30000',
            characters: appData.charIds,
            worldSettings: [appData.worldSetting.id],
            chapters: appData.chapters.map((c: Chapter) => c.id),
            plotLines: [appData.plotLine.id],
            emotionArcId: appData.emotionArc.id,
            lustArcId: appData.lustArc.id,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }

          return {
            currentNovel: novel,
            characters: appData.characters,
            worldSettings: [appData.worldSetting],
            plotLines: [appData.plotLine],
            chapters: appData.chapters,
            volumes: [],
            emotionArc: appData.emotionArc,
            lustArc: appData.lustArc,
            outlineNodes: appData.outlineNodes,
            tags: [...state.tags, ...appData.tags],
            memories: state.memories,
            aiModels: state.aiModels,
            currentModel: state.currentModel,
            conversations: state.conversations,
            logs: [
              {
                id: genId(),
                type: 'success' as const,
                message: `一键推导完成：${novel.title}`,
                detail: `生成 ${appData.characters.length} 个角色，${appData.chapters.length} 个章节，感情线节点 ${appData.emotionArc.nodes.length} 个，肉欲线强度点 ${appData.lustArc.intensityCurve.length} 个`,
                timestamp: Date.now(),
              },
              ...state.logs,
            ].slice(0, 500),
          } as any
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

      // ----- 项目导出（SRS v2.3 修复：包含 emotionArc / lustArc）-----
      exportProject: () => {
        const state = get()
        return {
          version: '2.3.0',
          exportedAt: Date.now(),
          currentNovel: state.currentNovel,
          characters: state.characters,
          worldSettings: state.worldSettings,
          chapters: state.chapters,
          volumes: state.volumes,
          plotLines: state.plotLines,
          emotionArc: state.emotionArc,
          lustArc: state.lustArc,
          outlineNodes: state.outlineNodes,
          tags: state.tags,
          aiModels: state.aiModels,
          currentModelId: state.currentModel?.id ?? null,
          adultMode: state.adultMode,
          conversations: state.conversations,
        }
      },

      // ----- 项目加载（SRS v2.3 修复：加载 emotionArc / lustArc）-----
      loadProject: (data) => {
        if (!data || typeof data !== 'object') return
        const d = data as Record<string, any>

        const novel = (d.currentNovel as unknown as Novel | null) ?? null
        const currentModelId = d.currentModelId as string | null
        const loadedModels = (d.aiModels as AIModel[] | undefined) ?? []
        const loadedCurrentModel = currentModelId
          ? loadedModels.find((m) => m.id === currentModelId) ?? null
          : null

        set({
          currentNovel: novel as Novel | null,
          characters: (d.characters as Character[] | undefined) ?? [],
          worldSettings: (d.worldSettings as WorldSetting[] | undefined) ?? [],
          chapters: (d.chapters as Chapter[] | undefined) ?? [],
          volumes: (d.volumes as Volume[] | undefined) ?? [],
          plotLines: (d.plotLines as PlotLine[] | undefined) ?? [],
          tags: (d.tags as Tag[] | undefined) ?? [],
          aiModels: loadedModels,
          currentModel: loadedCurrentModel ?? loadedModels[0] ?? null,
          adultMode: (d.adultMode as boolean | undefined) ?? false,
          conversations: (d.conversations as Conversation[] | undefined) ?? [],
          emotionArc: (d.emotionArc as EmotionArc | undefined) ?? null,
          lustArc: (d.lustArc as LustArc | undefined) ?? null,
          outlineNodes: (d.outlineNodes as OutlineNode[] | undefined) ?? [],
        })
      },

      // ----- 更新大纲节点 -----
      updateOutlineNodes: (nodes) => set({ outlineNodes: nodes }),

      // ----- 重置全部 -----
      resetAll: () => set({ ...initialState }),

      // ----- 设置上次推导结果 -----
      setLastDeduceResult: (result) => set({ lastDeduceResult: result }),

      // ----- 清除所有项目数据（保留 AI 模型和应用设置）-----
      clearAllData: () =>
        set((state) => ({
          currentNovel: null,
          characters: [],
          worldSettings: [],
          chapters: [],
          volumes: [],
          plotLines: [],
          tags: [],
          memories: [],
          logs: [],
          conversations: [],
          isLoading: false,
          selectedTagIds: [],
          emotionArc: null,
          lustArc: null,
          outlineNodes: [],
          deduceTask: null,
          lastDeduceResult: null,
          aiModels: state.aiModels,
          currentModel: state.currentModel,
          fontSize: state.fontSize,
          autoSaveInterval: state.autoSaveInterval,
          autoBackup: state.autoBackup,
          defaultTemperature: state.defaultTemperature,
          defaultMaxTokens: state.defaultMaxTokens,
          apiTimeout: state.apiTimeout,
          adultMode: state.adultMode,
        })),
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
        logs: state.logs,
        aiModels: state.aiModels,
        currentModel: state.currentModel,
        adultMode: state.adultMode,
        conversations: state.conversations,
        emotionArc: state.emotionArc,
        lustArc: state.lustArc,
        outlineNodes: state.outlineNodes,
        selectedTagIds: state.selectedTagIds,
        fontSize: state.fontSize,
        autoSaveInterval: state.autoSaveInterval,
        autoBackup: state.autoBackup,
        defaultTemperature: state.defaultTemperature,
        defaultMaxTokens: state.defaultMaxTokens,
        apiTimeout: state.apiTimeout,
        deduceTask: state.deduceTask,
        lastDeduceResult: state.lastDeduceResult,
      }),
    }
  )
)

// 统一导出，兼容 useStore 和 useAppStore 两种导入
export { useAppStore as useStore }
export default useAppStore
