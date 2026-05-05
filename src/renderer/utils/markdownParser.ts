/**
 * 从 markdown 格式的角色文本中提取结构化字段
 * 支持格式:
 *   - **字段名**：内容
 *   - - 字段名：内容（列表格式）
 *   - 字段名：内容（纯文本格式，含缩进）
 *   - 段落文本无字段名（如纯外貌描写段落）
 *
 * 修复：AI 实际输出格式多样，需兼容缩进键值对、markdown 标题、纯段落
 */
export function parseMarkdownFields(text: string): Record<string, string> {
  const fields: Record<string, string> = {};

  const knownFields = [
    '姓名', '名字', '名称',
    '性别', '年龄', '职业', '身份', '穿着', '穿着风格',
    '外貌', '外貌特征', '形象', '长相', '外表',
    '性格', '性格特点', '性格核心', '个性', '性情',
    '背景', '背景经历', '身世', '经历', '来历',
    '能力', '特长', '技能', '异能', '法术', '武功', '实力',
    '目标', '核心动机', '动机', '人物弧线', '弧线', '追求', '梦想',
    '与主角关系', '关系', '人物关系', '角色关系',
    '性偏好', '敏感点', '情欲动态', '潜在情欲',
    '内心', '内心世界', '内心独白',
    '声音', '语言风格', '口头禅',
  ];

  // ── 策略1: 匹配 **字段名**：内容（markdown 加粗格式）──
  const mdRegex = /\*\*([^*]+?)\*\*[：:\s]*\n?([\s\S]*?)(?=(?:\n\s*\*\*[^*]+?\*\*[：:\s])|$)/g;
  let match;
  while ((match = mdRegex.exec(text)) !== null) {
    const key = match[1].trim();
    let value = match[2].trim().replace(/\*\*/g, '').trim();
    if (key && value) {
      fields[key] = value;
    }
  }

  // ── 策略2: 按行扫描，匹配各种字段格式 ──
  // 修复核心：兼容 "  性别：男"（缩进）、"- 姓名：xxx"（列表）、"性格：xxx"（纯文本）
  const lines = text.split('\n');
  let currentKey: string | null = null;
  let currentValue: string[] = [];

  const flushField = () => {
    if (currentKey && currentValue.length > 0) {
      const value = currentValue.join('\n').trim().replace(/\*\*/g, '').trim();
      if (value && (!fields[currentKey] || fields[currentKey].length < value.length)) {
        fields[currentKey] = value;
      }
    }
    currentKey = null;
    currentValue = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // 匹配字段行：可选前导空格/列表标记 + 字段名 + 分隔符
    // 示例："  性别：男"、"- 姓名：林默"、"性格：温和"
    const fieldMatch = line.match(/^(?:\s*[-•·]\s+|\s*\*\*)?\s*([^*：:\n]{1,10})[：:\s]+(.*)$/);
    if (fieldMatch) {
      const possibleKey = fieldMatch[1].trim();
      const rest = fieldMatch[2].trim();

      if (knownFields.includes(possibleKey)) {
        flushField();
        currentKey = possibleKey;
        if (rest) currentValue.push(rest);
        continue;
      }
    }

    // 不是字段行，如果正在收集某个字段的内容，追加
    if (currentKey !== null) {
      if (line.trim() === '') {
        if (currentValue.length > 0 && currentValue[currentValue.length - 1].trim() === '') {
          flushField();
        } else {
          currentValue.push(line);
        }
      } else {
        currentValue.push(line);
      }
    }
  }
  flushField();

  return fields;
}

/**
 * 从主角文本中智能提取各字段（兼容纯段落无字段名前缀的格式）
 * AI 输出常见格式：先是一段外貌描写，然后是"性格：xxx"、"背景：xxx"
 * 前面的纯段落需要智能归类为"外貌"或"背景"
 */
export function parseProtagonistFields(text: string): Record<string, string> {
  const fields = parseMarkdownFields(text);

  // 如果外貌为空，尝试将文本开头的前几行纯段落归为外貌
  if (!fields['外貌'] && !fields['外貌特征'] && !fields['形象']) {
    const lines = text.split('\n');
    const paragraphs: string[] = [];
    let inField = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // 检测到已知字段行，停止收集
      const isField = /^(?:\s*[-•·]\s+)?\s*(?:外貌|性格|背景|能力|目标|姓名|性别|年龄|性偏好)[：:\s]/.test(line);
      if (isField) {
        inField = true;
        break;
      }
      // 跳过 markdown 标题和数字序号
      if (/^#{1,4}\s/.test(trimmed) || /^\d+[\.、．]/.test(trimmed)) continue;
      paragraphs.push(trimmed);
    }
    if (paragraphs.length > 0 && !inField) {
      // 如果整段都没有字段名，全部作为外貌
      fields['外貌'] = paragraphs.join('\n');
    } else if (paragraphs.length > 0) {
      // 有字段名但前面有纯段落，归为外貌
      fields['外貌'] = paragraphs.join('\n');
    }
  }

  return fields;
}

/**
 * 清理 markdown 标记
 */
export function cleanMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*\*/g, '')           // 去掉粗体标记
    .replace(/^\s*[-•·]\s*/gm, '')  // 去掉列表标记
    .replace(/^\s*\d+[\.、．]\s*/gm, '') // 去掉数字序号
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
