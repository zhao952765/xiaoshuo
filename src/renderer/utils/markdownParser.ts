/**
 * 从 markdown 格式的角色文本中提取结构化字段
 * 支持格式: **字段名**：内容 或 **字段名**: 内容
 */
export function parseMarkdownFields(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  
  // 匹配 **字段名**：内容 的模式
  // 支持多行内容，直到下一个 **字段名** 或结束
  const regex = /\*\*([^*]+?)\*\*[：:\s]*\n?([\s\S]*?)(?=(?:\*\*[^*]+?\*\*[：:\s])|$)/g;
  
  let match;
  while ((match = regex.exec(text)) !== null) {
    const key = match[1].trim();
    const value = match[2].trim();
    if (key && value) {
      fields[key] = value;
    }
  }
  
  return fields;
}

/**
 * 清理 markdown 标记
 */
export function cleanMarkdown(text: string): string {
  return text
    .replace(/\*\*/g, '')           // 去掉粗体标记
    .replace(/^\s*[-•·]\s*/gm, '')  // 去掉列表标记
    .replace(/\n\s*\n/g, '\n')      // 压缩空行
    .trim();
}

/**
 * 从文本中提取姓名（支持多种格式）
 */
export function extractNameFromText(text: string): string {
  // 尝试 **姓名**：XXX
  const mdMatch = text.match(/\*\*姓名\*\*[：:\s]*([^\n*]{2,10})/);
  if (mdMatch) return cleanMarkdown(mdMatch[1]);
  
  // 尝试 姓名：XXX
  const plainMatch = text.match(/姓名[：:\s]*([^\n,，、\s]{2,10})/);
  if (plainMatch) return plainMatch[1].trim();
  
  // 取第一个非标记的词
  const clean = cleanMarkdown(text.split('\n')[0]);
  const words = clean.split(/[，,、\s]/).filter(w => w.length >= 2 && w.length <= 6);
  return words[0] || '未命名';
}
