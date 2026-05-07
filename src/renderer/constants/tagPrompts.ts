import type { TagCategory } from '@cfg/types'

export const TAG_CATEGORY_CONFIG: Record<TagCategory, { label: string; color: string; icon: string; description: string; isHighlight?: boolean }> = {
  character: { label: '人物类型', color: '#8b5cf6', icon: '👤', description: '角色类型、性格、外貌特征' },
  profession: { label: '职业身份', color: '#3b82f6', icon: '💼', description: '职业、技能、职场身份' },
  scene: { label: '场景地点', color: '#14b8a6', icon: '🏠', description: '地点、环境、场所' },
  plot: { label: '关系剧情', color: '#f97316', icon: '📖', description: '情节类型、禁忌关系、叙事模式' },
  fetish: { label: '性癖玩法', color: '#ec4899', icon: '🔥', description: '感官刺激、性癖元素、玩法类型', isHighlight: true },
  costume: { label: '恋物制服', color: '#dc2626', icon: '👗', description: '服装、制服、恋物元素' },
  fantasy: { label: '特殊幻想', color: '#a855f7', icon: '✨', description: '超自然、特殊设定、幻想元素' },
}

// 分类优先级
export const CATEGORY_PRIORITY: TagCategory[] = [
  'fetish', 'costume', 'fantasy', 'plot', 'profession', 'scene', 'character'
]

export const PRESET_TAG_GROUPS = [
  { name: '高H御姐组合', tags: ['冷艳御姐', '高冷女总裁', '办公室', '高H', '黑丝', '强制高潮'], description: '经典御姐情节，高肉戏浓度' },
  { name: '人妻NTR组合', tags: ['骚浪人妻', '成熟少妇', '人妻NTR', '偷情', '酒店套房'], description: '人妻出轨情节，禁忌刺激' },
  { name: '办公室黑丝组合', tags: ['女秘书', '职场OL', '强势女上司', '办公室', '黑丝', 'OL制服'], description: '职场办公室情节，OL诱惑' },
  { name: '病娇百合组合', tags: ['病娇腹黑双胞胎', '百合', '强制', '囚禁', '调教'], description: '病娇百合情节，强制爱' },
  { name: '校园师生组合', tags: ['大学校园', '女教师', '师生恋', '教室', '图书馆'], description: '校园师生禁忌恋' },
  { name: '情趣酒店组合', tags: ['情趣酒店', '浴室', '厨房', '高跟鞋', '蕾丝内衣', '媚药'], description: '酒店情趣场景，多重玩法' },
  { name: '特殊幻想组合', tags: ['时停', '催眠', '梦境', '触手', '露出play'], description: '特殊幻想元素，超自然刺激' },
  { name: '女警制服组合', tags: ['女警', '女仆装', '高跟鞋', '强制高潮', '后入'], description: '制服诱惑+强制情节' },
]

// ==================== 权重推荐系统 ====================
export const TAG_WEIGHT_RECOMMENDATIONS: Record<string, number> = {
  '人妻NTR': 1.55, '骚浪人妻': 1.48, '成熟少妇': 1.45, '强制': 1.48,
  '时停': 1.58, '时间停止': 1.55, '催眠': 1.55, '深度催眠': 1.50,
  '强制高潮': 1.52, '连续高潮': 1.50, '潮吹': 1.48, '羞辱': 1.45,
  '意识操控': 1.48, '身体敏感化': 1.45, '性感女警': 1.40,
  '蕾丝内衣': 1.35, '半脱制服': 1.40, '办公室': 1.25,
};

export const CATEGORY_DEFAULT_WEIGHT: Record<TagCategory, number> = {
  character: 1.20, profession: 1.18, scene: 1.15, plot: 1.32,
  fetish: 1.45, costume: 1.30, fantasy: 1.48,
};

// ==================== 性能优化：缓存 + 查找表 ====================
const categoryLookupMap = new Map<string, TagCategory>();
const weightCache = new Map<string, number>();
const expandCache = new Map<string, Record<TagCategory, string[]>>();

// 构建分类查找表（一次性构建，之后 O(1) 查询）
function initCategoryLookup() {
  if (categoryLookupMap.size > 0) return;

  for (const cat of CATEGORY_PRIORITY) {
    TAG_KEYWORD_MAP[cat].forEach(kw => {
      const key = kw.toLowerCase().trim();
      if (!categoryLookupMap.has(key)) {
        categoryLookupMap.set(key, cat);
      }
    });
  }
}

export function autoDetectCategory(tagName: string): TagCategory {
  initCategoryLookup();
  const lower = tagName.toLowerCase().trim();

  if (categoryLookupMap.has(lower)) return categoryLookupMap.get(lower)!;

  // 模糊匹配
  for (const [key, cat] of categoryLookupMap) {
    if (lower.includes(key) || key.includes(lower)) {
      return cat;
    }
  }
  return 'character';
}

export function getRecommendedWeight(tag: string): number {
  if (weightCache.has(tag)) return weightCache.get(tag)!;

  const exact = TAG_WEIGHT_RECOMMENDATIONS[tag];
  if (exact) {
    weightCache.set(tag, exact);
    return exact;
  }

  for (const [key, weight] of Object.entries(TAG_WEIGHT_RECOMMENDATIONS)) {
    if (tag.includes(key) || key.includes(tag)) {
      const result = Math.max(1.15, weight * 0.92);
      weightCache.set(tag, result);
      return result;
    }
  }

  const cat = autoDetectCategory(tag);
  const result = CATEGORY_DEFAULT_WEIGHT[cat] || 1.15;
  weightCache.set(tag, result);
  return result;
}

/** 一键生成带权重的完整提示词 */
export function generateWeightedPrompt(
  keywords: string[],
  options: { maxTags?: number; addQuality?: boolean } = {}
): string {
  const { maxTags = 35, addQuality = true } = options;

  const expanded = offlineExpand(keywords);
  const allTags: { tag: string; weight: number }[] = [];

  (Object.keys(expanded) as TagCategory[]).forEach(cat => {
    expanded[cat].forEach(tag => {
      allTags.push({ tag, weight: getRecommendedWeight(tag) });
    });
  });

  allTags.sort((a, b) => b.weight - a.weight);

  let prompt = allTags
    .slice(0, maxTags)
    .map(item => item.weight > 1.22 ? `(${item.tag}:${item.weight.toFixed(2)})` : item.tag)
    .join('，');

  if (addQuality) {
    prompt += '，高细节，精致画面，昏暗灯光，汗水，凌乱衣物，电影光影，详细背景';
  }

  return prompt;
}

// ==================== 分类关键词 & LOCAL_TAG_RULES ====================
export const TAG_KEYWORD_MAP: Record<TagCategory, string[]> = {
  character: ['温柔御姐', '高冷女王', '成熟少妇', '骚浪人妻', '人妻', '清纯学生妹', '病娇', '傲娇', '巨乳', '黑长直', '媚眼', '丰满肉感'],
  profession: ['女警', '警察', '女教师', '老师', '护士', '空姐', '女秘书', 'OL', '女上司'],
  scene: ['办公室', '卧室', '客厅', '家里', '审讯室', '浴室', '厨房'],
  plot: ['人妻NTR', '办公室不伦', '强制NTR', '禁忌关系', '丈夫旁观'],
  fetish: ['强制', '强制高潮', '连续高潮', '潮吹', '失禁', '羞辱', '捆绑', '药物催情'],
  costume: ['蕾丝内衣', '半脱制服', '撕裂丝袜', '透明情趣装', '吊带丝袜', '高跟鞋'],
  fantasy: ['时停', '催眠', '意识操控', '身体敏感化', '记忆篡改'],
};

export const LOCAL_TAG_RULES: { keyword: string; category: TagCategory; expansions: string[] }[] = [
  { keyword: '骚浪人妻', category: 'character', expansions: ['成熟少妇', '人妻'] },
  { keyword: '人妻NTR', category: 'plot', expansions: ['办公室不伦', '强制NTR'] },
  { keyword: '强制', category: 'fetish', expansions: ['强制高潮'] },
  { keyword: '蕾丝内衣', category: 'costume', expansions: ['透明情趣装'] },
  { keyword: '时停', category: 'fantasy', expansions: ['时间停止'] },
  { keyword: '催眠', category: 'fantasy', expansions: ['深度催眠'] },
];

function fuzzyMatch(a: string, b: string): boolean {
  const k1 = a.toLowerCase().trim();
  const k2 = b.toLowerCase().trim();
  return k1 === k2 || k2.includes(k1) || k1.includes(k2);
}

export function offlineExpand(keywords: string[]): Record<TagCategory, string[]> {
  const cacheKey = keywords.slice().sort().join('|');
  if (expandCache.has(cacheKey)) return expandCache.get(cacheKey)!;

  const result: Record<TagCategory, string[]> = {
    character: [], profession: [], scene: [], plot: [], fetish: [], costume: [], fantasy: [],
  };

  for (const rawKw of keywords) {
    const kw = rawKw.trim();
    let matched = false;

    for (const rule of LOCAL_TAG_RULES) {
      if (fuzzyMatch(kw, rule.keyword)) {
        const cat = rule.category;
        if (!result[cat].includes(rule.keyword)) result[cat].push(rule.keyword);
        rule.expansions.forEach(exp => {
          if (!result[cat].includes(exp)) result[cat].push(exp);
        });
        matched = true;
        break;
      }
    }

    if (!matched) {
      const cat = autoDetectCategory(kw);
      if (!result[cat].includes(kw)) result[cat].push(kw);
    }
  }

  // 限制缓存大小
  if (expandCache.size > 300) expandCache.clear();
  expandCache.set(cacheKey, result);
  return result;
}

/** 统一入口函数 */
export function createFullPrompt(keywords: string[], useWeight: boolean = true): string {
  return useWeight ? generateWeightedPrompt(keywords) : keywords.join('，');
}