/**
 * 提示词加载工具
 * 编译时自动导入 prompts/ 目录下所有 .md 提示词文件
 * 100% 原样使用，不做任何修改
 */

// Vite 编译时 glob 导入：所有 .md 文件以原始字符串形式加载
const rawModules = import.meta.glob('@prompts/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const promptMap = new Map<string, string>()

Object.entries(rawModules).forEach(([filePath, content]) => {
  const match = /\/([^/]+)\.md$/.exec(filePath)
  const name = match ? match[1] : filePath
  promptMap.set(name, content)
})

/**
 * 原样加载指定提示词文件内容
 * @param filename 文件名，可含或不含 .md 扩展名，如 "prompts" 或 "prompts.md"
 * @returns 提示词原文；文件不存在时返回空字符串并在控制台记录警告
 */
export function loadPrompt(filename: string): string {
  const name = filename.replace(/\.md$/i, '')
  const content = promptMap.get(name)

  if (content === undefined) {
    console.warn(`[promptLoader] 提示词文件不存在: ${filename}`)
    return ''
  }

  return content
}

/**
 * 加载提示词并替换变量占位符
 * 基于 loadPrompt 返回的副本进行替换，绝不修改原始模板
 * @param filename 文件名
 * @param vars 变量映射表，如 { theme: '都市', length: '3万字', maleCount: '2' }
 * @returns 替换后的提示词内容；文件不存在时返回空字符串
 */
export function loadPromptWithVars(
  filename: string,
  vars: Record<string, string>
): string {
  let content = loadPrompt(filename)
  if (!content) return ''

  Object.entries(vars).forEach(([key, value]) => {
    content = content.split(`{${key}}`).join(value)
  })

  return content
}

/**
 * 列出所有可用的提示词文件名
 * @returns 文件名数组（不含路径和 .md 扩展名）
 */
export function listPrompts(): string[] {
  return Array.from(promptMap.keys())
}
