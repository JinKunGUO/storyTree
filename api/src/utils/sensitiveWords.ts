/**
 * 敏感词过滤工具
 * 使用简单遍历算法，后续可升级为DFA
 */

// 敏感词分类
export const sensitiveWordCategories = {
  illegal: [
    '毒品', '冰毒', '海洛因', '可卡因', '大麻',
    '赌博', '博彩', '赌马', '赌场',
    '枪支', '弹药', '爆炸物', '炸弹', '手雷',
    '暗杀', '绑架', '勒索', '敲诈', '抢劫',
    '伪造', '假钞', '假币', ' counterfeit'
  ],
  porn: [
    '色情', '性爱', '性交', '裸体', '裸照',
    '嫖娼', '卖淫', '援交', '一夜情',
    '高潮', '勃起', '阴道', '阴茎', '乳房'
  ],
  violence: [
    '杀人', '分尸', '碎尸', '血腥', '虐杀',
    '自残', '自杀', '割腕', '跳楼', '上吊'
  ],
  spam: [
    '加微信', '微信号', '二维码', '支付宝',
    '转账', '汇款', '刷单', '兼职赚钱',
    '免费送', '点击领取', '恭喜中奖'
  ]
};

// 所有敏感词合并
export const allSensitiveWords = Object.values(sensitiveWordCategories).flat();

// 敏感词扫描结果
export interface ScanResult {
  found: boolean;
  words: string[];
  category?: string;
}

/**
 * 扫描文本中的敏感词
 * @param text 要扫描的文本
 * @returns ScanResult
 */
export function scanSensitiveWords(text: string): ScanResult {
  if (!text || text.length === 0) {
    return { found: false, words: [] };
  }

  const foundWords: string[] = [];
  const categories: string[] = [];

  // 遍历每个分类
  for (const [category, words] of Object.entries(sensitiveWordCategories)) {
    for (const word of words) {
      if (text.includes(word)) {
        foundWords.push(word);
        if (!categories.includes(category)) {
          categories.push(category);
        }
      }
    }
  }

  return {
    found: foundWords.length > 0,
    words: foundWords,
    category: categories[0] // 返回第一个匹配的类别
  };
}

/**
 * 替换敏感词为*
 * @param text 原文本
 * @returns 处理后的文本
 */
export function maskSensitiveWords(text: string): string {
  let result = text;

  for (const word of allSensitiveWords) {
    result = result.replace(new RegExp(word, 'g'), '*'.repeat(word.length));
  }

  return result;
}

/**
 * 检查是否需要审核
 * @param text 内容文本
 * @param nodeCount 用户已发布节点数
 * @returns 是否需要审核
 */
export function needsReview(text: string, nodeCount: number): {
  needReview: boolean;
  reason: string;
} {
  // 新用户前3条强制审核
  if (nodeCount < 3) {
    return { needReview: true, reason: '新用户首次发布' };
  }

  // 检查敏感词
  const scanResult = scanSensitiveWords(text);
  if (scanResult.found) {
    return {
      needReview: true,
      reason: `命中敏感词: ${scanResult.words.join(', ')}`
    };
  }

  return { needReview: false, reason: '' };
}
