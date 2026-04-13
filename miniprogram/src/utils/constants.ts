/**
 * 全局常量定义
 */

// API 基础地址（通过环境变量注入）
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://your-domain.com'

// 本地存储 Key
export const STORAGE_KEYS = {
  TOKEN: 'st_token',
  USER: 'st_user',
  READER_SETTINGS: 'st_reader_settings',
  SEARCH_HISTORY: 'st_search_history',
  DRAFT_PREFIX: 'st_draft_',
} as const

// 分页配置
export const PAGINATION = {
  PAGE_SIZE: 20,
  STORY_PAGE_SIZE: 12,
} as const

// 故事可见性
export const VISIBILITY = {
  PUBLIC: 'public',
  PRIVATE: 'private',
  FOLLOWERS: 'followers',
} as const

export const VISIBILITY_LABELS: Record<string, string> = {
  public: '公开',
  private: '私密',
  followers: '关注者可见',
}

// 会员等级
export const MEMBERSHIP_TIER = {
  FREE: 'free',
  BASIC: 'basic',
  PRO: 'pro',
  PREMIUM: 'premium',
} as const

export const MEMBERSHIP_LABELS: Record<string, string> = {
  free: '普通用户',
  basic: '基础会员',
  pro: '专业会员',
  premium: '高级会员',
}

// 积分交易类型
export const POINT_TYPES: Record<string, string> = {
  registration_bonus: '注册奖励',
  invitation_reward: '邀请奖励',
  daily_checkin: '每日签到',
  makeup_checkin: '补签',
  story_follow: '追更故事',
  node_bookmark: '收藏章节',
  purchase: '积分购买',
  consume: '积分消费',
}

// AI 任务类型
export const AI_TASK_TYPES = {
  CONTINUE: 'continue',
  POLISH: 'polish',
  ILLUSTRATION: 'illustration',
  SUMMARY: 'summary',
} as const

// 通知类型
export const NOTIFICATION_TYPES: Record<string, string> = {
  comment: '评论',
  reply: '回复',
  follow: '关注',
  story_update: '故事更新',
  invitation_success: '邀请成功',
  system: '系统通知',
}

// 用户等级配置
export const LEVEL_CONFIG = [
  { level: 1, name: '见习作者', minPoints: 0, maxPoints: 100 },
  { level: 2, name: '初级作者', minPoints: 100, maxPoints: 500 },
  { level: 3, name: '中级作者', minPoints: 500, maxPoints: 1500 },
  { level: 4, name: '高级作者', minPoints: 1500, maxPoints: 4000 },
  { level: 5, name: '资深作者', minPoints: 4000, maxPoints: 10000 },
  { level: 6, name: '大师作者', minPoints: 10000, maxPoints: 30000 },
  { level: 7, name: '传奇作者', minPoints: 30000, maxPoints: Infinity },
]

// 颜色主题
export const THEME_COLORS = {
  primary: '#7c6af7',
  secondary: '#a78bfa',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  dark: '#1a1a2e',
  darkCard: '#16213e',
  text: '#e2e8f0',
  textSecondary: '#94a3b8',
}

