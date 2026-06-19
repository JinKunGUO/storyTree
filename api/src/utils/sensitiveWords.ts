/**
 * 敏感词过滤工具
 * 使用 DFA（确定性有限自动机 / Trie 树）算法，O(n) 时间复杂度扫描文本。
 * 支持：
 * - 分类词库（illegal/porn/violence/spam/political）
 * - 变体检测（忽略中间空格、特殊字符）
 * - 高性能 Trie 匹配
 */

// ===================== 敏感词分类词库 =====================

export const sensitiveWordCategories: Record<string, string[]> = {
  // 违法犯罪
  illegal: [
    '毒品', '冰毒', '海洛因', '可卡因', '大麻', '摇头丸', '麻古', 'K粉', '氯胺酮',
    '吗啡', '鸦片', '安非他明', '甲基苯丙胺', '致幻剂', '迷幻药', '笑气',
    '赌博', '博彩', '赌马', '赌场', '网赌', '赌球', '百家乐', '老虎机', '六合彩',
    '枪支', '弹药', '爆炸物', '炸弹', '手雷', '雷管', '火药', '管制刀具',
    '暗杀', '绑架', '勒索', '敲诈', '抢劫', '贩毒', '走私', '洗钱',
    '伪造', '假钞', '假币', '伪钞', '制假', '贩假',
    '传销', '非法集资', '庞氏骗局', '杀猪盘', '电信诈骗'
  ],
  // 色情低俗
  porn: [
    '色情', '性爱', '性交', '裸体', '裸照', '裸聊',
    '嫖娼', '卖淫', '援交', '一夜情', '约炮', '找小姐',
    '高潮', '勃起', '阴道', '阴茎', '乳房', '性器官',
    '口交', '肛交', '手淫', '自慰', 'AV女优', '黄片',
    '情色', '淫秽', '猥亵', '强奸', '轮奸', '性侵',
    '恋童', '幼女', '未成年', '萝莉控',
    '开房', '包养', '情妇', '小三上位'
  ],
  // 暴力血腥
  violence: [
    '杀人', '分尸', '碎尸', '虐杀', '屠杀', '灭门',
    '自残', '自杀', '割腕', '跳楼', '上吊', '服毒自杀',
    '血腥', '血肉模糊', '开膛破肚', '挖眼', '剥皮',
    '虐待', '酷刑', '凌迟', '活埋', '焚烧',
    '恐怖袭击', '人体炸弹', '斩首', '砍头'
  ],
  // 垃圾广告
  spam: [
    '加微信', '微信号', '二维码', '支付宝转账',
    '转账', '汇款', '刷单', '兼职赚钱', '日赚千元',
    '免费送', '点击领取', '恭喜中奖', '扫码领红包',
    '代开发票', '办证', '代孕', '私家侦探',
    '加QQ', 'QQ群', '加群', '私聊发',
    '低价出售', '高仿', 'A货', '复刻', '代购优惠',
    '贷款', '套现', '信用卡提额', '网贷口子'
  ],
  // 政治敏感（仅限明确违规内容）
  political: [
    '颠覆政权', '分裂国家', '恐怖主义', '极端主义',
    '邪教', '法轮功', '全能神', '门徒会',
    '翻墙', '科学上网', 'VPN翻墙', '代理翻墙'
  ]
};

// 所有敏感词合并（保留向后兼容）
export const allSensitiveWords = Object.values(sensitiveWordCategories).flat();

// ===================== DFA Trie 数据结构 =====================

interface TrieNode {
  children: Map<string, TrieNode>;
  isEnd: boolean;
  category?: string;
  word?: string;
}

/**
 * DFA 敏感词 Trie 树
 * 构建一次，多次查询，时间复杂度 O(n)
 */
class SensitiveWordTrie {
  private root: TrieNode;

  constructor() {
    this.root = { children: new Map(), isEnd: false };
    this.buildTrie();
  }

  /** 构建 Trie 树 */
  private buildTrie() {
    for (const [category, words] of Object.entries(sensitiveWordCategories)) {
      for (const word of words) {
        this.addWord(word, category);
      }
    }
  }

  /** 插入一个词 */
  private addWord(word: string, category: string) {
    let current = this.root;
    for (const char of word) {
      if (!current.children.has(char)) {
        current.children.set(char, { children: new Map(), isEnd: false });
      }
      current = current.children.get(char)!;
    }
    current.isEnd = true;
    current.category = category;
    current.word = word;
  }

  /**
   * 扫描文本，返回所有命中的敏感词
   * 使用滑动窗口 + Trie 匹配，O(n) 复杂度
   */
  scan(text: string): { words: string[]; categories: string[] } {
    if (!text) return { words: [], categories: [] };

    const foundWords: string[] = [];
    const categories: string[] = [];
    // 预处理：转小写用于匹配（保留原文用于定位）
    const normalized = text.toLowerCase();
    const len = normalized.length;

    for (let i = 0; i < len; i++) {
      let current = this.root;
      let j = i;

      while (j < len) {
        const char = normalized[j];

        // 跳过干扰字符（空格、特殊符号）— 变体检测
        if (this.isNoiseChar(char)) {
          j++;
          continue;
        }

        if (!current.children.has(char)) {
          break;
        }

        current = current.children.get(char)!;

        if (current.isEnd && current.word) {
          if (!foundWords.includes(current.word)) {
            foundWords.push(current.word);
          }
          if (current.category && !categories.includes(current.category)) {
            categories.push(current.category);
          }
          // 继续匹配更长的词（贪心）
        }

        j++;
      }
    }

    return { words: foundWords, categories };
  }

  /** 判断是否为干扰字符（用于变体检测） */
  private isNoiseChar(char: string): boolean {
    // 空格、零宽字符、特殊符号
    return /[\s\u200b\u200c\u200d\ufeff\u00a0·•\-_~`!@#$%^&*()+=\[\]{}|\\:;"'<>,./?\u3000]/.test(char);
  }

  /** 替换敏感词为 * */
  mask(text: string): string {
    if (!text) return text;
    let result = text;
    const { words } = this.scan(text);

    // 按长度降序排列，避免短词替换破坏长词
    const sorted = [...words].sort((a, b) => b.length - a.length);
    for (const word of sorted) {
      // 使用正则忽略大小写替换
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(escaped, 'gi'), '*'.repeat(word.length));
    }

    return result;
  }
}

// 单例实例（模块加载时构建一次）
const trie = new SensitiveWordTrie();

// ===================== 导出 API（保持向后兼容） =====================

/** 敏感词扫描结果 */
export interface ScanResult {
  found: boolean;
  words: string[];
  categories: string[];
  category?: string; // 向后兼容：返回第一个匹配分类
  severity: 'none' | 'low' | 'medium' | 'high';
}

/**
 * 扫描文本中的敏感词（DFA 算法）
 * @param text 要扫描的文本
 * @returns ScanResult
 */
export function scanSensitiveWords(text: string): ScanResult {
  if (!text || text.length === 0) {
    return { found: false, words: [], categories: [], severity: 'none' };
  }

  const { words, categories } = trie.scan(text);

  // 计算严重程度
  let severity: ScanResult['severity'] = 'none';
  if (words.length > 0) {
    if (categories.includes('porn') || categories.includes('illegal') || categories.includes('political')) {
      severity = 'high';
    } else if (categories.includes('violence')) {
      severity = 'medium';
    } else {
      severity = 'low';
    }
  }

  return {
    found: words.length > 0,
    words,
    categories,
    category: categories[0], // 向后兼容
    severity
  };
}

/**
 * 替换敏感词为 *（DFA 算法）
 * @param text 原文本
 * @returns 处理后的文本
 */
export function maskSensitiveWords(text: string): string {
  return trie.mask(text);
}

/**
 * 检查是否需要审核
 * @param text 内容文本
 * @param nodeCount 用户已发布节点数
 * @param options 可选参数
 * @returns 是否需要审核及原因
 */
export function needsReview(
  text: string,
  nodeCount: number,
  options?: { isMember?: boolean; memberTier?: string }
): {
  needReview: boolean;
  reason: string;
  severity: ScanResult['severity'];
  autoReject: boolean; // 是否建议自动驳回（严重违规）
} {
  // 会员优先：年度/企业会员且已有足够发布记录，跳过新用户强制审核
  const skipNewUserCheck = options?.isMember &&
    (options.memberTier === 'annual' || options.memberTier === 'enterprise') &&
    nodeCount >= 1;

  // 新用户前 3 条强制审核（会员可豁免）
  if (!skipNewUserCheck && nodeCount < 3) {
    return { needReview: true, reason: '新用户首次发布', severity: 'none', autoReject: false };
  }

  // 检查敏感词
  const scanResult = scanSensitiveWords(text);
  if (scanResult.found) {
    return {
      needReview: true,
      reason: `命中敏感词: ${scanResult.words.slice(0, 5).join(', ')}${scanResult.words.length > 5 ? '...' : ''}`,
      severity: scanResult.severity,
      autoReject: scanResult.severity === 'high' && scanResult.words.length >= 3
    };
  }

  return { needReview: false, reason: '', severity: 'none', autoReject: false };
}
