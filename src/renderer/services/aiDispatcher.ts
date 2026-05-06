import { callAI } from './aiService'

export type AITaskType =
  | 'write'
  | 'chat'
  | 'deduce'
  | 'polish'

interface DispatchOptions {
  type: AITaskType
  input: string
  context?: string
  memory?: string
  mode?: string
}

// ======== 限流（防止狂点炸接口） ========
let lastCall = 0

function throttle(ms = 1000) {
  const now = Date.now()
  if (now - lastCall < ms) {
    throw new Error('请求过快')
  }
  lastCall = now
}

// ======== 重试机制 ========
async function retry(fn: () => Promise<any>, times = 2) {
  for (let i = 0; i < times; i++) {
    try {
      return await fn()
    } catch (e) {
      if (i === times - 1) throw e
    }
  }
}

// ======== Prompt 构建 ========
function buildPrompt(
  type: AITaskType,
  input: string,
  context: string,
  memory: string,
  mode?: string,
) {
  const base = `
你是一个专业小说AI助手。

${memory ? `【长期记忆】\n${memory}` : ''}
${context ? `【上下文】\n${context}` : ''}
`

  const prompts = {
    write: `
${base}
【任务】写作

要求：
- 保持剧情连贯
- 风格统一
- 输出自然段

【输入】
${input}
`,

    chat: `
${base}
【任务】对话

要求：
- 保持角色一致
- 逻辑合理

用户说：
${input}
`,

    deduce: `
${base}
【任务】剧情推导

请给出：
1. 大纲
2. 详细展开

输入：
${input}
`,

    polish: `
${base}
【任务】文本润色（${mode || '标准'}）

要求：
- 不改变剧情
- 优化表达

原文：
${input}
`,
  }

  return prompts[type]
}

export async function dispatchAI(options: DispatchOptions) {
  try {
    throttle()

    const prompt = buildPrompt(
      options.type,
      options.input,
      options.context || '',
      options.memory || '',
      options.mode,
    )

    const res = await retry(() => callAI({ prompt }))

    return res
  } catch (e: any) {
    return {
      success: false,
      error: e.message,
    }
  }
}
