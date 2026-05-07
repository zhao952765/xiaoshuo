/**
 * AI 服务 - 统一流式 & 非流式调用
 * 整合分散在 5 个页面中的重复 SSE 解析代码
 */
import type { AIModel, AIRequest, AIResponse } from '@cfg/types'

// ============================================
// 非流式调用（简单请求/响应）
// ============================================
export async function callAI(req: AIRequest): Promise<AIResponse<string>> {
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return { success: true, data: data?.result ?? '' }
  } catch (e: any) {
    console.error('AI ERROR:', e)
    return { success: false, error: e.message || 'AI request failed' }
  }
}

// ============================================
// 流式调用（带 AbortController 支持）
// ============================================
export async function callAIStream(
  model: AIModel,
  systemPrompt: string,
  userPrompt: string,
  onChunk: (text: string) => void,
  options?: { signal?: AbortSignal; temperature?: number; maxTokens?: number },
): Promise<string> {
  const url = model.baseUrl.replace(/\/+$/, '') + '/chat/completions'
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${model.apiKey}`,
    },
    body: JSON.stringify({
      model: model.modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: options?.temperature ?? model.temperature,
      max_tokens: options?.maxTokens ?? model.maxTokens,
      stream: true,
    }),
    signal: options?.signal,
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`AI 请求失败 (${res.status}): ${errText || res.statusText}`)
  }

  const reader = res.body?.getReader()
  const decoder = new TextDecoder()
  let fullText = ''
  if (!reader) throw new Error('响应流不可用')

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    for (const line of chunk.split('\n')) {
      const t = line.trim()
      if (!t.startsWith('data: ')) continue
      const data = t.slice(6)
      if (data === '[DONE]') continue
      try {
        const p = JSON.parse(data)
        const c = p.choices?.[0]?.delta?.content
        if (typeof c === 'string') {
          fullText += c
          onChunk(fullText)
        }
      } catch { /* 忽略单条解析失败 */ }
    }
  }
  return fullText
}

// ============================================
// 获取可用模型列表（OpenAI 兼容接口）
// ============================================
export async function fetchAvailableModels(
  model: AIModel,
  signal?: AbortSignal,
): Promise<string[]> {
  const res = await fetch(`${model.baseUrl}/models`, {
    headers: { Authorization: `Bearer ${model.apiKey}` },
    signal,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return data.data?.map((m: any) => m.id) || []
}
