/**
 * 角色管理系统 - 常量与配置
 * 吸收自 F:\1\old 新组件，适配现有数据结构
 *
 * 关键差异说明：
 * - 现有项目 roleType 含4种（protagonist/supporting/minor/antagonist），新组件只有3种
 * - 现有项目 personality 是 string[]，新组件是 string
 * - 现有项目 relationships 是结构化数组，新组件是纯文本
 */

import type { RoleType } from '../types/types'

// ==========================================
// 角色类型配置（4种，兼容现有 RoleType）
// ==========================================
export const CHARACTER_ROLE_CONFIG: Record<RoleType, {
  label: string
  icon: string
  color: string
  bgColor: string
  borderColor: string
  description: string
}> = {
  protagonist: {
    label: '主角',
    icon: '👑',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    description: '故事核心角色，驱动情节发展',
  },
  supporting: {
    label: '配角',
    icon: '🎭',
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
    description: '重要辅助角色，丰富故事层次',
  },
  minor: {
    label: '龙套',
    icon: '👥',
    color: '#6b7280',
    bgColor: 'rgba(107, 114, 128, 0.15)',
    borderColor: 'rgba(107, 114, 128, 0.3)',
    description: '次要角色，承担特定功能',
  },
  antagonist: {
    label: '反派',
    icon: '😈',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    description: '与主角对立的势力，制造冲突',
  },
}

/** 角色类型 key 列表（用于遍历） */
export const ROLE_KEYS: RoleType[] = ['protagonist', 'supporting', 'minor', 'antagonist']

// ==========================================
// 性格标签库（4类：正面16/负面16/中性16/NSFW45）
// ==========================================
export const PERSONALITY_TAGS = {
  positive: [
    '勇敢', '聪明', '善良', '忠诚', '幽默', '坚韧', '温柔', '正直',
    '果断', '豁达', '细心', '乐观', '热情', '沉稳', '宽容', '自信',
  ],
  negative: [
    '固执', '多疑', '急躁', '冷漠', '自私', '傲慢', '胆小', '优柔',
    '偏执', '嫉妒', '虚荣', '阴险', '冲动', '吝啬', '懦弱', '叛逆',
  ],
  neutral: [
    '内向', '外向', '理性', '感性', '神秘', '古怪', '慵懒', '严谨',
    '随性', '务实', '理想', '传统', '前卫', '低调', '张扬', '中庸',
  ],
  nsfw: [
    '淫荡', '淫乱', '发情', '身体敏感', '主动诱惑', '骚浪', '欲女', '痴女',
    '敏感体质', '易潮吹', '巨乳', '露出癖', '言语挑逗', '享受被操',
    '浪叫', '肉欲强烈', '羞耻心低', 'M属性', 'S属性', '高H', 'NSFW',
    '色情', '湿润', '多汁', '性饥渴', '渴望被插', '性瘾', '高潮不断',
    '口交高手', '深喉达人', '肛交爱好者', 'SM倾向', '制服诱惑', '角色扮演',
    '野外露出', '多人混战', '性玩具爱好者', '精液崇拜', '内射渴望',
    '主动求欢', '骑乘位达人', '后入爱好者', '高潮脸', '呻吟不断',
  ],
} as const

/** 性格标签分类配置（名称/颜色） */
export const PERSONALITY_CATEGORY_CONFIG = {
  positive: { label: '正面', color: '#10b981' },
  negative: { label: '负面', color: '#ef4444' },
  neutral: { label: '中性', color: '#3b82f6' },
  nsfw: { label: '🔞 NSFW成人', color: '#ff3366' },
} as const

// ==========================================
// 外貌特征词库（4类各8个）
// ==========================================
export const APPEARANCE_KEYWORDS = {
  face: ['剑眉星目', '面如冠玉', '眉清目秀', '棱角分明', '圆脸', '瓜子脸', '国字脸', '娃娃脸'],
  body: ['高挑', '魁梧', '纤瘦', '匀称', '娇小', '健壮', '修长', '敦实'],
  hair: ['长发', '短发', '马尾', '散发', '卷发', '直发', '披肩', '束发'],
  feature: ['疤痕', '胎记', '酒窝', '虎牙', '泪痣', '刀疤', '纹身', '戴眼镜'],
} as const

// ==========================================
// 预设角色模板（6组）
// ==========================================
export const PRESET_CHARACTER_TEMPLATES = [
  {
    name: '热血少年',
    role: 'protagonist' as RoleType,
    description: '性格热血、正义感强，虽然有时冲动但关键时刻总能爆发出惊人力量',
    personality: ['勇敢', '热血', '正直', '冲动', '重情重义'],
    avatar: '🔥',
  },
  {
    name: '冷面高手',
    role: 'supporting' as RoleType,
    description: '表面冷漠寡言，实力深不可测，内心却有着不为人知的柔软',
    personality: ['冷漠', '理性', '忠诚', '内敛', '可靠'],
    avatar: '❄️',
  },
  {
    name: '智谋军师',
    role: 'supporting' as RoleType,
    description: '运筹帷幄的智者，善于分析和制定策略，常常在幕后推动局势',
    personality: ['聪明', '深沉', '谨慎', '多谋', '洞察力强'],
    avatar: '🧠',
  },
  {
    name: '温柔姐姐',
    role: 'supporting' as RoleType,
    description: '温柔体贴的大姐姐形象，善解人意，关键时刻给予支持',
    personality: ['温柔', '体贴', '包容', '细心', '坚强'],
    avatar: '🌸',
  },
  {
    name: '宿命对手',
    role: 'antagonist' as RoleType,
    description: '与主角立场对立的强力对手，有着自己的信念和坚持',
    personality: ['骄傲', '执着', '强大', '孤独', '有原则'],
    avatar: '⚡',
  },
  {
    name: '神秘旅人',
    role: 'minor' as RoleType,
    description: '来路不明的人物，总是出现在关键时刻，留下谜一般的线索',
    personality: ['神秘', '随性', '洞察世事', '超然', '玩世不恭'],
    avatar: '🌙',
  },
] as const

// ==========================================
// 头像选项（40个 Emoji）
// 此段吸收自 F:\1\old 新组件 AVATAR_OPTIONS
// ==========================================
export const AVATAR_OPTIONS = [
  '👤', '👩', '👨', '👧', '🧒', '🧔', '👸', '🤴',
  '🧙', '🧝', '🧛', '🦹', '🥷', '💂', '🕵️', '🧑‍🎨',
  '🔥', '❄️', '⚡', '🌊', '🌸', '🌙', '⭐', '🍀',
  '🦁', '🐉', '🦊', '🐺', '🦅', '🐍', '🦇', '🐅',
  '⚔️', '🛡️', '🎭', '🎯', '💎', '🎪', '🧬', '🔮',
] as const

/** 额外 Emoji 头像（P3 新增分类） */
export const AVATAR_EMOJI_EXTRA = [
  '😍', '😈', '🥰', '😏', '💀', '🤖', '👽', '🧟',
  '🐱', '🐶', '🦄', '🐧', '🐝', '🦋', '🐙', '🦑',
  '🌙', '☀️', '❤️', '💜', '💚', '💙', '🧡', '💛',
  '🎭', '🎬', '🎵', '🎹', '🖌️', '📸', '☕', '🍷',
] as const

// ==========================================
// 工具函数
// ==========================================

/** 获取角色类型中文标签 */
export function getRoleLabel(role: string): string {
  const config = CHARACTER_ROLE_CONFIG[role as RoleType]
  return config?.label || '未知'
}

/** 获取角色类型颜色 */
export function getRoleColor(role: string): string {
  const config = CHARACTER_ROLE_CONFIG[role as RoleType]
  return config?.color || '#6b7280'
}

/** 获取性格标签在哪个分类中 */
export function getPersonalityCategory(tag: string): keyof typeof PERSONALITY_TAGS | null {
  for (const [cat, tags] of Object.entries(PERSONALITY_TAGS)) {
    if ((tags as readonly string[]).includes(tag)) {
      return cat as keyof typeof PERSONALITY_TAGS
    }
  }
  return null
}
