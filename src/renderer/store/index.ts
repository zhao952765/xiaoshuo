/**
 * ============================================
 * 全局状态管理 - Private Novel Studio Pro
 * 统一 Zustand Store + 持久化 + 自动备份 + 数据完整性
 * ============================================
 *
 * 架构说明：
 * - 使用 Zustand persist 中间件持久化到 localStorage
 * - 导出 useStore（主 store）+ useAppStore（兼容别名）
 * - 版本号控制，支持数据迁移
 * - 自动定期备份到 backup-* 键
 * - 加载时校验数据完整性
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  Novel,
  Character,
  WorldSetting,
  Chapter,
  PlotLine,
  Tag,
  TagCategory,
  Memory,
  MemoryType,
  Log,
  LogType,
  AIModel,
  Conversation,
  EmotionArc,
  EmotionArcEvent,
  LustArc,
  OutlineNode,
  Volume,
  OneClickResult,
  Message,
  RoleType,
  ChapterStatus,
  NovelLength,
  StyleType,
  PolishLevel,
} from '@cfg/types'
import { callAI } from '@/services/aiService'

// ==========================================
// 常量
// ==========================================
const STORAGE_KEY = 'private-novel-studio-pro-storage'
const BACKUP_KEY_PREFIX = 'private-novel-studio-pro-backup'
const STORE_VERSION = 2
const MAX_RECENT_NOVELS = 10
const MAX_MEMORIES = 500
const MAX_LOGS = 1000
const MAX_MESSAGES = 50

// ==========================================
// Store 状态接口
// ==========================================
export interface StoreState {
  // ── 元数据 ──
  _version: number

  // ── 项目数据 ──
  currentNovel: Novel | null
  characters: Character[]
  worldSettings: WorldSetting[]
  chapters: Chapter[]
  volumes: Volume[]
  plotLines: PlotLine[]
  tags: Tag[]
  selectedTagIds: string[]
  outlineNodes: OutlineNode[]

  // ── SRS v2.3 感情线 & 肉欲线 ──
  emotionArc: EmotionArc | null
  emotionEvents: EmotionArcEvent[]
  lustArc: LustArc | null

  // ── 对话 & 记忆 & 日志 ──
  messages: Message[]
  conversations: Conversation[]
  memories: Memory[]
  logs: Log[]
  deduceTask: { isRunning: boolean; phase: string; progress: number } | null

  // ── AI 模型 ──
  aiModels: AIModel[]
  currentModel: AIModel | null

  // ── 设置项 ──
  adultMode: boolean
  eroticMode: boolean
  fontSize: 'small' | 'medium' | 'large'
  autoSaveInterval: number
  autoBackup: boolean
  defaultTemperature: number
  defaultMaxTokens: number
  apiTimeout: number
  isLoading: boolean
  theme: 'dark' | 'light'
  accentColor: string
  sidebarCollapsed: boolean
  autoSave: boolean
  streamOutput: boolean
  currentProjectId: string | null
  currentModelId: string | null

  // ── UI 临时状态（不持久化） ──
  loading: boolean
  result: string
  error: string | null

  // ==========================================
  // Actions
  // ==========================================

  // 对话
  sendMessage: (text: string) => Promise<void>
  clearMessages: () => void

  // 项目
  setCurrentNovel: (novel: Novel | null) => void
  updateNovel: (data: Partial<Novel>) => void

  // 角色
  addCharacter: (character: Character) => void
  updateCharacter: (id: string, data: Partial<Character>) => void
  removeCharacter: (id: string) => void

  // 世界观
  addWorldSetting: (ws: WorldSetting) => void
  updateWorldSetting: (id: string, data: Partial<WorldSetting>) => void
  removeWorldSetting: (id: string) => void

  // 章节
  addChapter: (chapter: Chapter) => void
  updateChapter: (id: string, data: Partial<Chapter>) => void
  removeChapter: (id: string) => void
  deleteChapter: (id: string) => void

  // 卷
  addVolume: (volume: Volume) => void
  updateVolume: (id: string, data: Partial<Volume>) => void
  deleteVolume: (id: string) => void

  // 剧情线
  addPlotLine: (pl: PlotLine) => void
  updatePlotLine: (id: string, data: Partial<PlotLine>) => void

  // 大纲节点
  updateOutlineNodes: (nodes: OutlineNode[]) => void

  // 感情线 & 肉欲线
  updateEmotionArc: (arc: EmotionArc | null) => void
  updateEmotionEvents: (events: EmotionArcEvent[]) => void
  updateLustArc: (arc: LustArc | null) => void

  // 标签
  addTag: (tag: Tag) => void
  removeTag: (id: string) => void
  removeTagsBatch: (ids: string[]) => void
  updateTag: (id: string, data: Partial<Tag>) => void
  toggleTagSelection: (id: string) => void
  clearSelection: () => void

  // AI 模型
  addModel: (model: AIModel) => void
  removeModel: (id: string) => void
  updateModel: (id: string, data: Partial<AIModel>) => void
  setCurrentModel: (model: AIModel | null) => void
  setDefaultModel: (id: string) => void

  // 记忆
  addMemory: (memory: Memory) => void
  removeMemory: (id: string) => void
  clearMemories: () => void

  // 日志
  addLog: (log: Omit<Log, 'id' | 'timestamp'>) => void
  clearLogs: () => void

  // 推导
  importFromDeduce: (result: OneClickResult) => void
  updateDeduceTask: (task: { isRunning: boolean; phase: string; progress: number } | null) => void
  validateCurrentModel: () => void
  failDeduceTask: (reason: string) => void

  // 设置
  toggleAdultMode: () => void
  setEroticMode: (val: boolean) => void
  setFontSize: (size: 'small' | 'medium' | 'large') => void
  setAutoSaveInterval: (sec: number) => void
  setAutoBackup: (enabled: boolean) => void
  setDefaultTemperature: (temp: number) => void
  setDefaultMaxTokens: (tokens: number) => void
  setApiTimeout: (sec: number) => void
  setIsLoading: (val: boolean) => void
  setAutoSave: (val: boolean) => void
  setStreamOutput: (val: boolean) => void
  setTheme: (theme: 'dark' | 'light') => void
  setAccentColor: (color: string) => void
  setSidebarCollapsed: (val: boolean) => void

  // 危险操作
  clearAllData: () => void
  resetAll: () => void
  importData: (data: Partial<StoreState>) => void
  exportData: () => Partial<StoreState>
}

// ==========================================
// 初始化状态
// ==========================================
const getInitialState = (): StoreState => ({
  _version: STORE_VERSION,

  currentNovel: null,
  characters: [],
  worldSettings: [],
  chapters: [],
  volumes: [],
  plotLines: [],
  tags: [],
  selectedTagIds: [],
  outlineNodes: [],

  emotionArc: null,
  emotionEvents: [],
  lustArc: null,

  messages: [],
  conversations: [],
  memories: [],
  logs: [],
  deduceTask: null,

  aiModels: [],
  currentModel: null,

  adultMode: false,
  eroticMode: false,
  fontSize: 'medium',
  autoSaveInterval: 30,
  autoBackup: true,
  defaultTemperature: 0.8,
  defaultMaxTokens: 4096,
  apiTimeout: 60,
  isLoading: false,
  theme: 'dark',
  accentColor: '#6366f1',
  sidebarCollapsed: false,
  autoSave: true,
  streamOutput: true,
  currentProjectId: null,
  currentModelId: null,

  loading: false,
  result: '',
  error: null,

  // actions - 占位符，create 时会被覆盖
  sendMessage: async () => {},
  clearMessages: () => {},
  setCurrentNovel: () => {},
  updateNovel: () => {},
  addCharacter: () => {},
  updateCharacter: () => {},
  removeCharacter: () => {},
  addWorldSetting: () => {},
  updateWorldSetting: () => {},
  removeWorldSetting: () => {},
  addChapter: () => {},
  updateChapter: () => {},
  removeChapter: () => {},
  deleteChapter: () => {},
  addVolume: () => {},
  updateVolume: () => {},
  deleteVolume: () => {},
  addPlotLine: () => {},
  updatePlotLine: () => {},
  updateOutlineNodes: () => {},
  updateEmotionArc: () => {},
  updateEmotionEvents: () => {},
  updateLustArc: () => {},
  addTag: () => {},
  removeTag: () => {},
  removeTagsBatch: () => {},
  updateTag: () => {},
  toggleTagSelection: () => {},
  clearSelection: () => {},
  addModel: () => {},
  removeModel: () => {},
  updateModel: () => {},
  setCurrentModel: () => {},
  setDefaultModel: () => {},
  addMemory: () => {},
  removeMemory: () => {},
  clearMemories: () => {},
  addLog: () => {},
  clearLogs: () => {},
  importFromDeduce: () => {},
  updateDeduceTask: () => {},
  validateCurrentModel: () => {},
  failDeduceTask: () => {},
  toggleAdultMode: () => {},
  setEroticMode: () => {},
  setFontSize: () => {},
  setAutoSaveInterval: () => {},
  setAutoBackup: () => {},
  setDefaultTemperature: () => {},
  setDefaultMaxTokens: () => {},
  setApiTimeout: () => {},
  setIsLoading: () => {},
  setAutoSave: () => {},
  setStreamOutput: () => {},
  setTheme: () => {},
  setAccentColor: () => {},
  setSidebarCollapsed: () => {},
  clearAllData: () => {},
  resetAll: () => {},
  importData: () => {},
  exportData: () => ({}),
})

// ==========================================
// 数据完整性校验
// ==========================================
function validateDataIntegrity(data: Partial<StoreState>): Partial<StoreState> {
  const fixed = { ...data }

  // 确保数组存在
  if (!Array.isArray(fixed.characters)) fixed.characters = []
  if (!Array.isArray(fixed.worldSettings)) fixed.worldSettings = []
  if (!Array.isArray(fixed.chapters)) fixed.chapters = []
  if (!Array.isArray(fixed.volumes)) fixed.volumes = []
  if (!Array.isArray(fixed.plotLines)) fixed.plotLines = []
  if (!Array.isArray(fixed.tags)) fixed.tags = []
  if (!Array.isArray(fixed.selectedTagIds)) fixed.selectedTagIds = []
  if (!Array.isArray(fixed.outlineNodes)) fixed.outlineNodes = []
  if (!Array.isArray(fixed.messages)) fixed.messages = []
  if (!Array.isArray(fixed.conversations)) fixed.conversations = []
  if (!Array.isArray(fixed.memories)) fixed.memories = []
  if (!Array.isArray(fixed.logs)) fixed.logs = []
  if (!Array.isArray(fixed.aiModels)) fixed.aiModels = []
  if (!Array.isArray(fixed.emotionEvents)) fixed.emotionEvents = []

  // 修复 Novel 空值
  if (!fixed.currentNovel || typeof fixed.currentNovel !== 'object') {
    fixed.currentNovel = null
  }

  // 修复 EmotionArc / LustArc 空值
  if (fixed.emotionArc && typeof fixed.emotionArc === 'object') {
    if (!Array.isArray(fixed.emotionArc.nodes)) fixed.emotionArc.nodes = []
    if (!Array.isArray(fixed.emotionArc.edges)) fixed.emotionArc.edges = []
    if (!Array.isArray(fixed.emotionArc.timeline)) fixed.emotionArc.timeline = []
  }
  if (fixed.lustArc && typeof fixed.lustArc === 'object') {
    if (!Array.isArray(fixed.lustArc.intensityCurve)) fixed.lustArc.intensityCurve = []
    if (!Array.isArray(fixed.lustArc.climaxPoints)) fixed.lustArc.climaxPoints = []
  }

  // 修复 deduceTask
  if (fixed.deduceTask && typeof fixed.deduceTask === 'object') {
    if (typeof fixed.deduceTask.isRunning !== 'boolean') fixed.deduceTask.isRunning = false
    if (typeof fixed.deduceTask.progress !== 'number') fixed.deduceTask.progress = 0
  }

  // 确保类型正确
  if (typeof fixed.adultMode !== 'boolean') fixed.adultMode = false
  if (typeof fixed.autoBackup !== 'boolean') fixed.autoBackup = true

  return fixed
}

// ==========================================
// 备份管理
// ==========================================
function createBackup(state: Partial<StoreState>) {
  try {
    const backupsJson = localStorage.getItem(`${BACKUP_KEY_PREFIX}-index`)
    const backups: string[] = backupsJson ? JSON.parse(backupsJson) : []
    const timestamp = Date.now()
    const key = `${BACKUP_KEY_PREFIX}-${timestamp}`
    localStorage.setItem(key, JSON.stringify({ timestamp, state }))
    backups.push(key)
    // 只保留最近 10 个备份
    while (backups.length > 10) {
      const old = backups.shift()!
      localStorage.removeItem(old)
    }
    localStorage.setItem(`${BACKUP_KEY_PREFIX}-index`, JSON.stringify(backups))
  } catch (e) {
    console.warn('[Backup] 创建备份失败:', e)
  }
}

// ==========================================
// Store 创建
// ==========================================
export const useStore = create<StoreState>()(
  persist(
    (set, get) => {
      // 自动保存定时器
      let autoSaveTimer: ReturnType<typeof setInterval> | null = null

      return {
        ...getInitialState(),

        // ── 对话 ──
        sendMessage: async (text: string) => {
          const state = get()
          if (!text.trim()) return

          const newMsg: Message = {
            id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            role: 'user',
            content: text,
            createdAt: Date.now(),
          }

          const history = [...state.messages, newMsg].slice(-MAX_MESSAGES)
          set({ messages: history, loading: true, error: null })

          const prompt = history.map(m => m.content).join('\n')
          const res = await callAI({ prompt })

          if (res.success) {
            const aiMsg: Message = {
              id: `msg_${Date.now().toString(36)}_ai_${Math.random().toString(36).slice(2, 6)}`,
              role: 'assistant',
              content: res.data || '',
              createdAt: Date.now(),
            }
            set({
              messages: [...history, aiMsg],
              result: res.data || '',
              loading: false,
            })
          } else {
            set({ loading: false, error: res.error || 'AI 响应失败' })
          }
        },

        clearMessages: () => set({ messages: [], result: '' }),

        // ── 项目 ──
        setCurrentNovel: (novel) => {
          if (!novel) {
            // 清除所有项目数据
            set({
              currentNovel: null,
              characters: [],
              worldSettings: [],
              chapters: [],
              volumes: [],
              plotLines: [],
              tags: [],
              selectedTagIds: [],
              outlineNodes: [],
              emotionArc: null,
              emotionEvents: [],
              lustArc: null,
              deduceTask: null,
            })
          } else {
            // 切换到新项目，保留匹配的关联数据
            set((s) => ({
              currentNovel: novel,
              characters: s.characters.filter((c) => novel.characters.includes(c.id)),
              worldSettings: s.worldSettings.filter((w) => novel.worldSettings.includes(w.id)),
              chapters: s.chapters.filter((ch) => novel.chapters.includes(ch.id)),
              plotLines: s.plotLines.filter((pl) => novel.plotLines.includes(pl.id)),
              // 感情线/肉欲线按 novel 的引用过滤
              emotionArc: s.emotionArc?.novelId === novel.id ? s.emotionArc : null,
              lustArc: s.lustArc?.novelId === novel.id ? s.lustArc : null,
            }))
          }
        },
        updateNovel: (data) => set((s) => ({
          currentNovel: s.currentNovel ? { ...s.currentNovel, ...data, updatedAt: Date.now() } : null,
        })),

        // ── 角色 ──
        addCharacter: (character) => set((s) => {
          const novel = s.currentNovel
          if (novel) {
            const updatedNovel = { ...novel, characters: [...novel.characters, character.id], updatedAt: Date.now() }
            return { characters: [...s.characters, character], currentNovel: updatedNovel }
          }
          return { characters: [...s.characters, character] }
        }),

        updateCharacter: (id, data) => set((s) => ({
          characters: s.characters.map((c) =>
            c.id === id ? { ...c, ...data, updatedAt: Date.now() } : c
          ),
        })),

        removeCharacter: (id) => set((s) => {
          // 清理其他角色的 relationships 中对该角色的引用
          const cleanedCharacters = s.characters.map((c) => ({
            ...c,
            relationships: c.relationships.filter((r) => r.targetId !== id),
          }))
          // 从章节的 characters 数组中移除
          const cleanedChapters = s.chapters.map((ch) => ({
            ...ch,
            characters: ch.characters.filter((cId) => cId !== id),
          }))
          // 从 currentNovel 的 characters 列表中移除
          const novel = s.currentNovel
          const updatedNovel = novel
            ? { ...novel, characters: novel.characters.filter((cId) => cId !== id), updatedAt: Date.now() }
            : null
          return {
            characters: cleanedCharacters.filter((c) => c.id !== id),
            chapters: cleanedChapters,
            currentNovel: updatedNovel,
          }
        }),

        // ── 世界观 ──
        addWorldSetting: (ws) => set((s) => {
          const novel = s.currentNovel
          if (novel) {
            return {
              worldSettings: [...s.worldSettings, ws],
              currentNovel: { ...novel, worldSettings: [...novel.worldSettings, ws.id], updatedAt: Date.now() },
            }
          }
          return { worldSettings: [...s.worldSettings, ws] }
        }),

        updateWorldSetting: (id, data) => set((s) => ({
          worldSettings: s.worldSettings.map((w) =>
            w.id === id ? { ...w, ...data, updatedAt: Date.now() } : w
          ),
        })),

        removeWorldSetting: (id) => set((s) => {
          const novel = s.currentNovel
          const updatedNovel = novel
            ? { ...novel, worldSettings: novel.worldSettings.filter((wId) => wId !== id), updatedAt: Date.now() }
            : null
          return {
            worldSettings: s.worldSettings.filter((w) => w.id !== id),
            currentNovel: updatedNovel,
          }
        }),

        // ── 章节 ──
        addChapter: (chapter) => set((s) => {
          const novel = s.currentNovel
          if (novel) {
            return {
              chapters: [...s.chapters, chapter],
              currentNovel: { ...novel, chapters: [...novel.chapters, chapter.id], updatedAt: Date.now() },
            }
          }
          return { chapters: [...s.chapters, chapter] }
        }),

        updateChapter: (id, data) => set((s) => ({
          chapters: s.chapters.map((ch) => {
            if (ch.id !== id) return ch
            const updated = { ...ch, ...data, updatedAt: Date.now() }
            if (data.content !== undefined) updated.wordCount = data.content.length
            return updated
          }),
        })),

        removeChapter: (id) => set((s) => {
          const novel = s.currentNovel
          const updatedNovel = novel
            ? { ...novel, chapters: novel.chapters.filter((chId) => chId !== id), updatedAt: Date.now() }
            : null
          return {
            chapters: s.chapters.filter((ch) => ch.id !== id),
            currentNovel: updatedNovel,
          }
        }),

        deleteChapter: (id) => get().removeChapter(id),

        // ── 卷 ──
        addVolume: (volume) => set((s) => ({
          volumes: [...s.volumes, volume],
        })),

        updateVolume: (id, data) => set((s) => ({
          volumes: s.volumes.map((v) =>
            v.id === id ? { ...v, ...data, updatedAt: Date.now() } : v
          ),
        })),

        deleteVolume: (id) => set((s) => ({
          volumes: s.volumes.filter((v) => v.id !== id),
        })),

        // ── 剧情线 ──
        addPlotLine: (pl) => set((s) => ({
          plotLines: [...s.plotLines, pl],
        })),

        updatePlotLine: (id, data) => set((s) => ({
          plotLines: s.plotLines.map((p) =>
            p.id === id ? { ...p, ...data, updatedAt: Date.now() } : p
          ),
        })),

        // ── 大纲节点 ──
        updateOutlineNodes: (nodes) => set({ outlineNodes: nodes }),

        // ── 感情线 & 肉欲线 ──
        updateEmotionArc: (arc) => set((s) => {
          const novel = s.currentNovel
          const updatedNovel = novel && arc
            ? { ...novel, emotionArcId: arc.id, updatedAt: Date.now() }
            : novel
          return { emotionArc: arc, currentNovel: updatedNovel }
        }),

        updateEmotionEvents: (events) => set({ emotionEvents: events }),

        updateLustArc: (arc) => set((s) => {
          const novel = s.currentNovel
          const updatedNovel = novel && arc
            ? { ...novel, lustArcId: arc.id, updatedAt: Date.now() }
            : novel
          return { lustArc: arc, currentNovel: updatedNovel }
        }),

        // ── 标签 ──
        addTag: (tag) => set((s) => ({
          tags: [...s.tags, tag],
        })),

        removeTag: (id) => set((s) => ({
          tags: s.tags.filter((t) => t.id !== id),
          selectedTagIds: s.selectedTagIds.filter((tId) => tId !== id),
        })),

        removeTagsBatch: (ids) => set((s) => ({
          tags: s.tags.filter((t) => !ids.includes(t.id)),
          selectedTagIds: s.selectedTagIds.filter((tId) => !ids.includes(tId)),
        })),

        updateTag: (id, data) => set((s) => ({
          tags: s.tags.map((t) => (t.id === id ? { ...t, ...data } : t)),
        })),

        toggleTagSelection: (id) => set((s) => ({
          selectedTagIds: s.selectedTagIds.includes(id)
            ? s.selectedTagIds.filter((tId) => tId !== id)
            : [...s.selectedTagIds, id],
        })),

        clearSelection: () => set({ selectedTagIds: [] }),

        // ── AI 模型 ──
        addModel: (model) => set((s) => ({
          aiModels: [...s.aiModels, model],
          currentModel: s.aiModels.length === 0 ? model : s.currentModel,
        })),

        removeModel: (id) => set((s) => ({
          aiModels: s.aiModels.filter((m) => m.id !== id),
          currentModel: s.currentModel?.id === id
            ? (s.aiModels.find((m) => m.id !== id) || null)
            : s.currentModel,
        })),

        updateModel: (id, data) => set((s) => ({
          aiModels: s.aiModels.map((m) =>
            m.id === id ? { ...m, ...data, updatedAt: Date.now() } : m
          ),
        })),

        setCurrentModel: (model) => set({ currentModel: model }),

        setDefaultModel: (id) => set((s) => ({
          aiModels: s.aiModels.map((m) => ({
            ...m,
            isDefault: m.id === id,
          })),
          currentModel: s.aiModels.find((m) => m.id === id) || s.currentModel,
        })),

        // ── 记忆 ──
        addMemory: (memory) => set((s) => ({
          memories: [...s.memories, memory].slice(-MAX_MEMORIES),
        })),

        removeMemory: (id) => set((s) => ({
          memories: s.memories.filter((m) => m.id !== id),
        })),

        clearMemories: () => set({ memories: [] }),

        // ── 日志 ──
        addLog: (log) => set((s) => {
          const entry: Log = {
            id: `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            ...log,
            timestamp: Date.now(),
          }
          return { logs: [...s.logs, entry].slice(-MAX_LOGS) }
        }),

        clearLogs: () => set({ logs: [] }),

        // ── 推导 ──
        importFromDeduce: (result: OneClickResult) => {
          const state = get()
          const now = Date.now()
          const novel = state.currentNovel
          if (!novel) return

          // 1. 导入主角
          if (result.protagonist && result.protagonist.name) {
            const existingIdx = state.characters.findIndex(
              (c) => c.name === result.protagonist.name && c.roleType === 'protagonist'
            )
            if (existingIdx >= 0) {
              // 更新已有主角
              get().updateCharacter(state.characters[existingIdx].id, result.protagonist)
            } else {
              get().addCharacter(result.protagonist)
            }
          }

          // 2. 导入配角
          if (result.supporting && result.supporting.length > 0) {
            for (const sc of result.supporting) {
              if (!sc.name) continue
              const existing = state.characters.find((c) => c.name === sc.name)
              if (!existing) {
                get().addCharacter(sc)
              }
            }
          }

          // 3. 导入世界观
          if (result.worldSetting && result.worldSetting.name) {
            const existing = state.worldSettings.find(
              (w) => w.name === result.worldSetting.name
            )
            if (!existing) {
              get().addWorldSetting(result.worldSetting)
            } else {
              get().updateWorldSetting(existing.id, result.worldSetting)
            }
          }

          // 4. 导入剧情线
          if (result.plotLine && result.plotLine.name) {
            const existing = state.plotLines.find(
              (p) => p.name === result.plotLine.name
            )
            if (!existing) {
              get().addPlotLine(result.plotLine)
            } else {
              get().updatePlotLine(existing.id, result.plotLine)
            }
          }

          // 5. 导入章节列表
          if (result.chapters && result.chapters.length > 0) {
            const sorted = [...state.chapters].sort((a, b) => a.order - b.order)
            const startOrder = sorted.length > 0 ? sorted[sorted.length - 1].order + 1 : 0
            result.chapters.forEach((ch, i) => {
              const existing = state.chapters.find(
                (c) => c.title === ch.title
              )
              if (!existing) {
                const newChapter: Chapter = {
                  id: `ch_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
                  title: ch.title,
                  summary: ch.summary || '',
                  content: '',
                  order: startOrder + i,
                  status: 'draft',
                  volumeId: null,
                  wordCount: 0,
                  mood: '',
                  characters: [],
                  hooks: '',
                  tags: [],
                  createdAt: now,
                  updatedAt: now,
                }
                // 第一章导入正文
                if (i === 0 && result.firstChapter) {
                  newChapter.content = result.firstChapter
                  newChapter.wordCount = result.firstChapter.length
                }
                get().addChapter(newChapter)
              }
            })
          }

          // 6. 导入感情线
          if (result.emotionArc) {
            get().updateEmotionArc(result.emotionArc)
          }

          // 7. 导入肉欲线
          if (result.lustArc) {
            get().updateLustArc(result.lustArc)
          }

          // 8. 导入标签
          if (result.tags && result.tags.length > 0) {
            for (const tag of result.tags) {
              if (!tag.name) continue
              const existing = state.tags.find((t) => t.name === tag.name)
              if (!existing) {
                get().addTag(tag)
              }
            }
          }

          // 9. 更新小说标题/简介
          if (result.title || result.summary) {
            get().updateNovel({
              title: result.title || novel.title,
              summary: result.summary || novel.summary,
            })
          }

          get().addLog({
            type: 'success',
            message: '推导结果已导入项目',
            detail: `角色 ${(result.protagonist ? 1 : 0) + (result.supporting?.length || 0)} 个，世界观 ${result.worldSetting ? 1 : 0} 个，章节 ${result.chapters?.length || 0} 章`,
          })
        },

        updateDeduceTask: (task) => set({ deduceTask: task }),

        validateCurrentModel: () => {
          const state = get()
          if (state.currentModel) return
          // 如果当前没有模型但有模型列表，自动选择第一个
          if (state.aiModels.length > 0) {
            const defaultModel = state.aiModels.find((m) => m.isDefault) || state.aiModels[0]
            set({ currentModel: defaultModel })
          }
        },

        failDeduceTask: (reason) => set({
          deduceTask: get().deduceTask
            ? { ...get().deduceTask!, isRunning: false }
            : null,
        }),

        // ── 设置 ──
        toggleAdultMode: () => set((s) => ({ adultMode: !s.adultMode })),
        setEroticMode: (val) => set({ eroticMode: val }),
        setFontSize: (size) => set({ fontSize: size }),
        setAutoSaveInterval: (sec) => {
          set({ autoSaveInterval: sec })
          // 重置定时器
          const s = get()
          if (autoSaveTimer) clearInterval(autoSaveTimer)
          if (sec > 0) {
            autoSaveTimer = setInterval(() => {
              const current = get()
              localStorage.setItem(STORAGE_KEY, JSON.stringify({
                state: current,
                version: STORE_VERSION,
              }))
            }, sec * 1000)
          }
        },
        setAutoBackup: (enabled) => {
          set({ autoBackup: enabled })
          if (enabled) {
            createBackup(get())
          }
        },
        setDefaultTemperature: (temp) => set({ defaultTemperature: temp }),
        setDefaultMaxTokens: (tokens) => set({ defaultMaxTokens: tokens }),
        setApiTimeout: (sec) => set({ apiTimeout: sec }),
        setIsLoading: (val) => set({ isLoading: val }),
        setAutoSave: (val) => {
          set({ autoSave: val })
          if (val) {
            const s = get()
            if (s.autoSaveInterval > 0) {
              get().setAutoSaveInterval(s.autoSaveInterval)
            }
          } else {
            if (autoSaveTimer) {
              clearInterval(autoSaveTimer)
              autoSaveTimer = null
            }
          }
        },
        setStreamOutput: (val) => set({ streamOutput: val }),
        setTheme: (theme) => set({ theme }),
        setAccentColor: (color) => set({ accentColor: color }),
        setSidebarCollapsed: (val) => set({ sidebarCollapsed: val }),

        // ── 危险操作 ──
        clearAllData: () => {
          if (autoSaveTimer) clearInterval(autoSaveTimer)
          set({
            ...getInitialState(),
            aiModels: get().aiModels, // 保留 AI 模型设置
            currentModel: get().currentModel,
            theme: get().theme,
            accentColor: get().accentColor,
            fontSize: get().fontSize,
            autoSaveInterval: get().autoSaveInterval,
            autoBackup: get().autoBackup,
            defaultTemperature: get().defaultTemperature,
            defaultMaxTokens: get().defaultMaxTokens,
            apiTimeout: get().apiTimeout,
            adultMode: get().adultMode,
            autoSave: get().autoSave,
            streamOutput: get().streamOutput,
          })
          localStorage.removeItem(STORAGE_KEY)
        },

        resetAll: () => {
          if (autoSaveTimer) clearInterval(autoSaveTimer)
          set({
            ...getInitialState(),
            aiModels: get().aiModels, // 保留 AI 模型
            currentModel: get().currentModel,
          })
        },

        importData: (data) => {
          const validated = validateDataIntegrity(data)
          set((s) => ({
            ...s,
            ...validated,
            _version: STORE_VERSION,
            loading: false,
            error: null,
          }))
        },

        exportData: () => {
          const state = get()
          const { loading, error, ...exportable } = state
          // 排除函数
          const cleaned: Record<string, unknown> = {}
          for (const [key, val] of Object.entries(exportable)) {
            if (typeof val !== 'function') {
              cleaned[key] = val
            }
          }
          return cleaned as Partial<StoreState>
        },
      }
    },
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: STORE_VERSION,
      // 部分持久化 - 只持久化数据，不持久化方法
      partialize: (state) => {
        const { loading, error, ...rest } = state
        const data: Record<string, unknown> = {}
        for (const [key, val] of Object.entries(rest)) {
          if (typeof val !== 'function') {
            data[key] = val
          }
        }
        return data as Partial<StoreState>
      },
      // 迁移处理
      migrate: (persisted: unknown, version: number): Partial<StoreState> => {
        const data = persisted as Record<string, unknown>

        // v0 → v1: 旧版 beforeunload 使用 private-novel-studio-pro-storage 键
        // 这个格式在 App.tsx 中定义
        if (version === 0) {
          // 尝试从旧键恢复
          try {
            const oldData = localStorage.getItem('private-novel-studio-pro-storage')
            if (oldData) {
              const parsed = JSON.parse(oldData)
              if (parsed.state) {
                return validateDataIntegrity(parsed.state)
              }
            }
          } catch { /* 忽略 */ }
          return validateDataIntegrity(data as Partial<StoreState>)
        }

        // v1 → v2: 新增 emotionEvents, volumes 字段
        if (version === 1) {
          const d = data as Partial<StoreState>
          if (!Array.isArray(d.emotionEvents)) d.emotionEvents = []
          if (!Array.isArray(d.volumes)) d.volumes = []
          return validateDataIntegrity(d)
        }

        return validateDataIntegrity(data as Partial<StoreState>)
      },
      // 反序列化后处理
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error) {
            console.warn('[Store] 数据反序列化失败:', error)
            return
          }
          if (!state) return

          // 修复 deduceTask 状态（上次推导中断）
          if (state.deduceTask?.isRunning) {
            state.deduceTask = { ...state.deduceTask, isRunning: false }
          }

          // 数据完整性修复
          const fixed = validateDataIntegrity(state)
          Object.assign(state, fixed)

          // 启动自动保存定时器
          if (state.autoSave && state.autoSaveInterval > 0) {
            setInterval(() => {
              const current = useStore.getState()
              localStorage.setItem(STORAGE_KEY, JSON.stringify({
                state: current,
                version: STORE_VERSION,
              }))
              // 自动备份
              if (current.autoBackup) {
                createBackup(current)
              }
            }, state.autoSaveInterval * 1000)
          }

          console.log('[Store] 数据加载完成，版本:', STORE_VERSION)
        }
      },
    }
  )
)

// ==========================================
// 兼容导出（旧代码用 useAppStore）
// ==========================================
export const useAppStore = useStore

// ==========================================
// 工具函数：手动触发保存
// ==========================================
export function saveNow(): void {
  const state = useStore.getState()
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    state,
    version: STORE_VERSION,
  }))
  if (state.autoBackup) {
    createBackup(state)
  }
}

// ==========================================
// 工具函数：列出可用备份
// ==========================================
export function listBackups(): Array<{ key: string; timestamp: number }> {
  try {
    const index = localStorage.getItem(`${BACKUP_KEY_PREFIX}-index`)
    if (!index) return []
    const keys: string[] = JSON.parse(index)
    return keys.map((key) => {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      return { key, timestamp: parsed.timestamp }
    }).filter(Boolean) as Array<{ key: string; timestamp: number }>
  } catch {
    return []
  }
}

// ==========================================
// 工具函数：从备份恢复
// ==========================================
export function restoreFromBackup(backupKey: string): boolean {
  try {
    const raw = localStorage.getItem(backupKey)
    if (!raw) return false
    const parsed = JSON.parse(raw)
    const state = useStore.getState()
    state.importData(parsed.state)
    return true
  } catch {
    return false
  }
}
