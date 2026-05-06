// src/renderer/store/index.ts

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Message } from '@/config/types'
import { callAI } from '@/services/aiService'

interface StoreState {
  loading: boolean
  messages: Message[]
  result: string
  error?: string

  sendMessage: (text: string) => Promise<void>
  clear: () => void
}

const MAX_HISTORY = 20

export const useAppStore = create<StoreState>()(
  persist(
    (set, get) => ({
      loading: false,
      messages: [],
      result: '',

      async sendMessage(text: string) {
        const newMsg: Message = {
          id: Date.now().toString(),
          role: 'user',
          content: text,
          createdAt: Date.now(),
        }

        const history = [...get().messages, newMsg].slice(-MAX_HISTORY)

        set({ messages: history, loading: true, error: undefined })

        const prompt = history.map(m => m.content).join('\n')

        const res = await callAI({ prompt })

        if (res.success) {
          const aiMsg: Message = {
            id: Date.now().toString() + '_ai',
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
          set({
            loading: false,
            error: res.error,
          })
        }
      },

      clear() {
        set({ messages: [], result: '' })
      },
    }),
    {
      name: 'app-storage',
    }
  )
)