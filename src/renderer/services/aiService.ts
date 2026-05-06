import { AIRequest, AIResponse } from '@/config/types'

/**
 * 统一 AI 请求服务
 * 所有 AI 调用必须通过此函数，禁止直接编写 fetch 请求
 */
export async function callAI(
  req: AIRequest
): Promise<AIResponse<string>> {
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req),
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    const data = await res.json()

    return {
      success: true,
      data: data?.result ?? '',
    }
  } catch (e: any) {
    console.error('AI ERROR:', e)

    return {
      success: false,
      error: e.message || 'AI request failed',
    }
  }
}
