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
 * 获取所有徽章
 */
export function getAllBadges(): Badge[] {
  return WORD_MILESTONES.map(m => m.badge);
}

/**
 * 根据ID获取徽章
 */
export function getBadgeById(id: string): Badge | undefined {
  return WORD_MILESTONES.find(m => m.badge.id === id)?.badge;
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