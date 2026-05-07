import type { AIResponse } from '@/types/types'

const MAX_INPUT_LENGTH = 2000

export interface DeduceResult {
  outline: string
  details: string
}

function sanitizeInput(input: string): string {
  if (!input) return ''

  return input
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_INPUT_LENGTH)
}

function buildPrompt(input: string): string {
  return `
你是一个小说剧情推导助手。

请基于以下内容进行推导：

【输入】
${input}

【要求】
1. 给出剧情大纲（简洁）
2. 给出详细展开（丰富细节）

【输出格式】
大纲：
...

详细：
...
`
}

function parseResult(text: string): DeduceResult {
  if (!text) {
    return {
      outline: '',
      details: '',
    }
  }

  const outlineMatch = text.match(/大纲[:：]\s*([\s\S]*?)详细[:：]/)
  const detailMatch = text.match(/详细[:：]\s*([\s\S]*)/)

  return {
    outline: outlineMatch?.[1]?.trim() || '',
    details: detailMatch?.[1]?.trim() || text,
  }
}

export function deduceTransformer(
  input: string
): {
  prompt: string
  parse: (res: AIResponse<string>) => DeduceResult
} {
  const clean = sanitizeInput(input)

  if (!clean) {
    return {
      prompt: '',
      parse: () => ({
        outline: '',
        details: '',
      }),
    }
  }

  const prompt = buildPrompt(clean)

  return {
    prompt,

    parse(res) {
      if (!res.success || !res.data) {
        return {
          outline: '',
          details: res.error || '推导失败',
        }
      }

      return parseResult(res.data)
    },
  }
}