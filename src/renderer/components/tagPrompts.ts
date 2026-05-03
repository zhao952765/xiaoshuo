import type { TagCategory } from '../../config/types'

export const TAG_CATEGORY_CONFIG: Record<TagCategory, { label: string; color: string; icon: string; description: string; isHighlight?: boolean }> = {
  character: { label: '人物类型', color: '#8b5cf6', icon: '👤', description: '角色类型、性格、外貌特征' },
  profession: { label: '职业身份', color: '#3b82f6', icon: '💼', description: '职业、技能、职场身份' },
  scene: { label: '场景地点', color: '#14b8a6', icon: '🏠', description: '地点、环境、场所' },
  plot: { label: '关系剧情', color: '#f97316', icon: '📖', description: '情节类型、禁忌关系、叙事模式' },
  fetish: { label: '性癖玩法', color: '#ec4899', icon: '🔥', description: '感官刺激、性癖元素、玩法类型', isHighlight: true },
  costume: { label: '恋物制服', color: '#dc2626', icon: '👗', description: '服装、制服、恋物元素' },
  fantasy: { label: '特殊幻想', color: '#a855f7', icon: '✨', description: '超自然、特殊设定、幻想元素' },
}

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

// 离线词库
export const LOCAL_TAG_RULES: { keyword: string; category: TagCategory; expansions: string[] }[] = [
  // 人物类型
  { keyword: '冷艳御姐', category: 'character', expansions: ['高冷', '成熟', '魅力', '傲娇', '冰山美人', '女王'] },
  { keyword: '高冷女总裁', category: 'character', expansions: ['强势', '霸道', '高智商', '商业精英', '气场强'] },
  { keyword: '强势女上司', category: 'character', expansions: ['领导力', '压迫感', '职场', '掌控欲', '严厉'] },
  { keyword: '温柔贤妻', category: 'character', expansions: ['贤惠', '体贴', '居家', '柔顺', '传统'] },
  { keyword: '反差婊', category: 'character', expansions: ['表面纯真', '内心浪荡', '绿茶', '虚伪', '双面'] },
  { keyword: '病娇腹黑双胞胎', category: 'character', expansions: ['偏执', '占有欲', '危险', '双重人格', '跟踪狂'] },
  { keyword: '腹黑萝莉', category: 'character', expansions: ['心机', '外表可爱', '腹黑', '暗黑', '萌系'] },
  { keyword: '骚浪人妻', category: 'character', expansions: ['欲求不满', '出轨', '性感', '成熟', '魅惑'] },
  { keyword: '成熟少妇', category: 'character', expansions: ['风韵', '性感', '经验丰富', '魅力', '丰满'] },
  { keyword: '傲娇大小姐', category: 'character', expansions: ['千金', '刁蛮', '公主病', '任性', '可爱'] },
  { keyword: '冰山美女', category: 'character', expansions: ['高冷', '难以接近', '冷漠', '外冷内热'] },
  { keyword: '邻居姐姐', category: 'character', expansions: ['温柔', '亲切', '成熟', '邻家', '好感'] },

  // 职业身份
  { keyword: '女总裁', category: 'profession', expansions: ['CEO', '霸道', '强势', '高智商', '商业帝国'] },
  { keyword: '女秘书', category: 'profession', expansions: ['助理', '职场OL', '干练', '细心', '贴身'] },
  { keyword: '职场OL', category: 'profession', expansions: ['职业装', '高跟鞋', '黑丝', '干练', 'office lady'] },
  { keyword: '女医生', category: 'profession', expansions: ['白大褂', '手术室', '专业', '温柔', '护士'] },
  { keyword: '护士', category: 'profession', expansions: ['白衣天使', '温柔', '照顾', '护士服', '护理'] },
  { keyword: '空姐', category: 'profession', expansions: ['制服', '高跟鞋', '优雅', '服务', '空乘'] },
  { keyword: '女教师', category: 'profession', expansions: ['老师', '讲台', '知性', '教育', '师生'] },
  { keyword: '女律师', category: 'profession', expansions: ['法庭', '辩护', '专业', '理性', '西装'] },
  { keyword: '女主播', category: 'profession', expansions: ['直播', '网红', '镜头', '表演', '性感'] },
  { keyword: '女模特', category: 'profession', expansions: ['T台', '时尚', '身材', '美丽', '走秀'] },
  { keyword: '女警', category: 'profession', expansions: ['执法', '正义', '制服', '英姿', '警察'] },

  // 场景地点
  { keyword: '办公室', category: 'scene', expansions: ['职场', '办公桌', '会议室', '加班', '上司'] },
  { keyword: '会议室', category: 'scene', expansions: ['谈判', '会议', '投影', '严肃', '密闭'] },
  { keyword: '电梯', category: 'scene', expansions: ['密闭', '狭小', '上升', '意外', '偶遇'] },
  { keyword: '地下停车场', category: 'scene', expansions: ['昏暗', '隐蔽', '停车', '车库', '幽会'] },
  { keyword: '酒店套房', category: 'scene', expansions: ['豪华', '大床', '浴室', '浪漫', '私密'] },
  { keyword: '情趣酒店', category: 'scene', expansions: ['主题房', '道具', 'SM', '特殊', '氛围'] },
  { keyword: '大学校园', category: 'scene', expansions: ['教室', '图书馆', '操场', '宿舍', '青春'] },
  { keyword: '图书馆', category: 'scene', expansions: ['安静', '书架', '学习', '偶遇', '文艺'] },
  { keyword: '浴室', category: 'scene', expansions: ['洗澡', '湿身', '泡沫', '诱惑', '卫生间'] },
  { keyword: '厨房', category: 'scene', expansions: ['烹饪', '居家', '围裙', '诱惑', '食物'] },
  { keyword: '豪车后座', category: 'scene', expansions: ['名车', '豪华', '私密', '激情', '车载'] },

  // 关系剧情
  { keyword: '人妻NTR', category: 'plot', expansions: ['出轨', '偷情', '绿帽', '已婚', '背叛'] },
  { keyword: '禁忌之恋', category: 'plot', expansions: ['伦理', '禁忌', '不被允许', '背德', '挣扎'] },
  { keyword: '偷情', category: 'plot', expansions: ['外遇', '秘密', '幽会', '刺激', '隐瞒'] },
  { keyword: '师生恋', category: 'plot', expansions: ['老师学生', '禁忌', '年龄差', '权力', '学校'] },
  { keyword: '强取豪夺', category: 'plot', expansions: ['强制', '霸道', '占有', '控制', '征服'] },
  { keyword: '调教堕落', category: 'plot', expansions: ['调教', 'SM', '堕落', '驯化', '臣服'] },
  { keyword: '黑化', category: 'plot', expansions: ['复仇', '变坏', '腹黑', '觉醒', '反杀'] },
  { keyword: '旧情重燃', category: 'plot', expansions: ['前任', '回忆', '复合', '旧爱', '重逢'] },
  { keyword: '先恨后爱', category: 'plot', expansions: ['仇恨', '误解', '真相', '爱上', '反转'] },

  // 性癖玩法
  { keyword: '高H', category: 'fetish', expansions: ['肉戏', '激烈', '详细', '频繁', '高潮'] },
  { keyword: '肉戏密集', category: 'fetish', expansions: ['详细描写', '多次', '激烈', '持续', '激情'] },
  { keyword: '黑丝', category: 'fetish', expansions: ['丝袜', '诱惑', '美腿', '性感', 'OL'] },
  { keyword: '潮吹', category: 'fetish', expansions: ['女性高潮', '喷水', '敏感', '失态', '快感'] },
  { keyword: '连续高潮', category: 'fetish', expansions: ['多次', '高潮迭起', '持续', '强烈', '极限'] },
  { keyword: '失禁', category: 'fetish', expansions: ['失控', '羞耻', '生理', '极端', '快感'] },
  { keyword: '深喉', category: 'fetish', expansions: ['口交', '深吞', '喉结', '窒息', '极限'] },
  { keyword: '颜射', category: 'fetish', expansions: ['射精', '面部', '凌乱', '羞耻', '颜面'] },
  { keyword: '中出', category: 'fetish', expansions: ['体内', '射精', '怀孕', '危险', '内射'] },
  { keyword: '后入', category: 'fetish', expansions: ['背后式', '深入', '动物式', '原始', '背面'] },
  { keyword: '露出play', category: 'fetish', expansions: ['公共场合', '暴露', '羞耻', '大胆', '偷窥'] },
  { keyword: '强制高潮', category: 'fetish', expansions: ['被迫', '高潮', '强制', '失控', '药物'] },
  { keyword: '媚药', category: 'fetish', expansions: ['春药', '催情', '失控', '欲望', '药物'] },

  // 恋物制服
  { keyword: 'OL制服', category: 'costume', expansions: ['职业装', '西装', '衬衫', '包臀裙', '职场'] },
  { keyword: '护士服', category: 'costume', expansions: ['白衣', '护士', '纯洁', '诱惑', '角色扮演'] },
  { keyword: '空姐服', category: 'costume', expansions: ['制服', '优雅', '服务', '空乘', '套装'] },
  { keyword: '女仆装', category: 'costume', expansions: ['女仆', '角色扮演', '可爱', '顺从', '家务'] },
  { keyword: '撕丝袜', category: 'costume', expansions: ['撕破', '破坏', '暴力', '性感', '脱衣'] },
  { keyword: '白丝', category: 'costume', expansions: ['白色丝袜', '纯洁', '可爱', '诱惑', '美腿'] },
  { keyword: '高跟鞋', category: 'costume', expansions: ['高跟鞋', '性感', '优雅', '美腿', '诱惑'] },
  { keyword: '蕾丝内衣', category: 'costume', expansions: ['蕾丝', '性感', '精致', '诱惑', '内衣'] },
  { keyword: '情趣内衣', category: 'costume', expansions: ['性感', '诱惑', '特殊', '挑逗', '内衣'] },
  { keyword: '丁字裤', category: 'costume', expansions: ['性感', '暴露', '丁字', '诱惑', 'minimal'] },

  // 特殊幻想
  { keyword: '时停', category: 'fantasy', expansions: ['时间停止', '静止', '暂停', '无敌', '为所欲为'] },
  { keyword: '催眠', category: 'fantasy', expansions: ['暗示', '控制', '洗脑', '潜意识', '操控'] },
  { keyword: '梦境', category: 'fantasy', expansions: ['梦中', '潜意识', '虚幻', '真实', '梦境现实'] },
  { keyword: '触手', category: 'fantasy', expansions: ['触手', '怪物', '异形', '缠绕', '异种'] },
  { keyword: '公共露出', category: 'fantasy', expansions: ['公共场所', '暴露', '羞耻', '大胆', '偷窥'] },
  { keyword: '怪物play', category: 'fantasy', expansions: ['怪物', '异形', '兽交', '科幻', '异种'] },
]

export function offlineExpand(keywords: string[]): Record<TagCategory, string[]> {
  const result: Record<TagCategory, string[]> = {
    character: [], profession: [], scene: [], plot: [], fetish: [], costume: [], fantasy: [],
  }
  keywords.forEach((kw) => {
    const rule = LOCAL_TAG_RULES.find((r) => r.keyword === kw || kw.includes(r.keyword) || r.keyword.includes(kw))
    if (rule) {
      if (!result[rule.category].includes(rule.keyword)) result[rule.category].push(rule.keyword)
      rule.expansions.forEach((exp) => { if (!result[rule.category].includes(exp)) result[rule.category].push(exp) })
    } else {
      if (!result.character.includes(kw)) result.character.push(kw)
    }
  })
  return result
}