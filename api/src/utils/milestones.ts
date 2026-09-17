/**
 * 码字里程碑配置
 */

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

export interface Milestone {
  words: number;
  reward: number;
  badge: Badge;
}

export const WORD_MILESTONES: Milestone[] = [
  { 
    words: 10000, 
    reward: 50, 
    badge: { id: 'rookie', name: '初出茅庐', emoji: '🌱', description: '创作满 1 万字' }
  },
  { 
    words: 50000, 
    reward: 200, 
    badge: { id: 'achiever', name: '小有成就', emoji: '📝', description: '创作满 5 万字' }
  },
  { 
    words: 100000, 
    reward: 500, 
    badge: { id: 'diligent', name: '笔耕不辍', emoji: '✍️', description: '创作满 10 万字' }
  },
  { 
    words: 200000, 
    reward: 1200, 
    badge: { id: 'professional', name: '专业作者', emoji: '📚', description: '创作满 20 万字' }
  },
  { 
    words: 500000, 
    reward: 3500, 
    badge: { id: 'signed', name: '签约作者', emoji: '🎖️', description: '创作满 50 万字' }
  },
  { 
    words: 1000000, 
    reward: 10000, 
    badge: { id: 'master', name: '大神作者', emoji: '👑', description: '创作满 100 万字' }
  },
  { 
    words: 2000000, 
    reward: 25000, 
    badge: { id: 'legend', name: '殿堂作者', emoji: '🏆', description: '创作满 200 万字' }
  }
];

// 每1000字奖励的积分
export const WORD_REWARD_RATE = 10;

// 每1000字获得的补签机会
export const MAKEUP_CHANCE_RATE = 1;

/**
 * 邀请裂变里程碑配置
 * 邀请人成功邀请满 N 人时触发，发放积分与徽章
 */
export interface InviteMilestone {
  count: number;      // 累计邀请人数
  reward: number;     // 额外奖励积分
  badge: Badge | null; // 达成徽章（null 表示仅积分）
}

export const INVITE_MILESTONES: InviteMilestone[] = [
  { count: 1, reward: 50, badge: null },
  { count: 3, reward: 150, badge: { id: 'connector', name: '呼朋引伴', emoji: '🤝', description: '成功邀请 3 位好友' } },
  { count: 5, reward: 300, badge: { id: 'recruiter', name: '伯乐', emoji: '🌟', description: '成功邀请 5 位好友' } },
  { count: 10, reward: 600, badge: { id: 'ambassador', name: '星推官', emoji: '🚀', description: '成功邀请 10 位好友' } },
];

/**
 * 获取所有徽章（字数里程碑 + 邀请里程碑）
 */
export function getAllBadges(): Badge[] {
  const wordBadges = WORD_MILESTONES.map(m => m.badge);
  const inviteBadges = INVITE_MILESTONES
    .map(m => m.badge)
    .filter((b): b is Badge => b !== null);
  return [...wordBadges, ...inviteBadges];
}

/**
 * 根据ID获取徽章
 */
export function getBadgeById(id: string): Badge | undefined {
  return getAllBadges().find(b => b.id === id);
}

/**
 * 获取下一个未达成的里程碑
 */
export function getNextMilestone(currentWordCount: number): Milestone | null {
  for (const milestone of WORD_MILESTONES) {
    if (currentWordCount < milestone.words) {
      return milestone;
    }
  }
  return null; // 已达成所有里程碑
}