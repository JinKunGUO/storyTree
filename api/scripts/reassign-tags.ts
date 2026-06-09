/**
 * 标签重新分配脚本
 *
 * 根据书名、作者、已有标签和内容关键词，为每本公版书分配更丰富的多维度标签。
 * 每本书至少分配 3-5 个标签，覆盖 era + genre/form + source 维度。
 *
 * 用法：
 *   cd api && npx ts-node scripts/reassign-tags.ts
 *   cd api && npx ts-node scripts/reassign-tags.ts --dry-run       # 只预览不写入
 *   cd api && npx ts-node scripts/reassign-tags.ts --file 三国演义.json  # 只处理单个文件
 */

import * as fs from 'fs';
import * as path from 'path';

interface StoryData {
  title: string;
  description?: string;
  author_name?: string;
  tags?: string;
  chapters: { title: string; content: string }[];
}

// ============ 命令行参数 ============

const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const DRY_RUN = args.includes('--dry-run');
const SPECIFIC_FILE = getArg('file');
const SEED_DATA_DIR = path.join(__dirname, 'seed-data');

// ============ 规则引擎：书名/作者 → 标签映射 ============

/** 精确匹配规则：书名 → 额外标签 */
const TITLE_EXACT_RULES: Record<string, string[]> = {
  '三国演义': ['明清', '历史', '长篇小说', '经典名著', '四大名著', '公版书', '战争', '男频'],
  '水浒传': ['明清', '武侠', '长篇小说', '经典名著', '四大名著', '公版书', '江湖', '男频'],
  '西游记': ['明清', '奇幻', '长篇小说', '经典名著', '四大名著', '公版书', '冒险', '通用'],
  '红楼梦': ['明清', '言情', '长篇小说', '经典名著', '四大名著', '公版书', '家族', '通用'],
  '史记': ['秦汉', '历史', '纪实', '经典名著', '公版书', '通用'],
  '聊斋志异': ['明清', '奇幻', '短篇合集', '经典名著', '公版书', '通用'],
  '儒林外史': ['明清', '讽刺', '长篇小说', '经典名著', '公版书', '社会', '通用'],
  '封神演义': ['明清', '奇幻', '长篇小说', '经典名著', '公版书', '战争', '男频'],
  '金瓶梅': ['明清', '现实主义', '长篇小说', '经典名著', '公版书', '社会', '通用'],
  '镜花缘': ['明清', '奇幻', '长篇小说', '公版书', '冒险', '通用'],
  '老残游记': ['明清', '现实主义', '长篇小说', '公版书', '社会', '通用'],
  '官场现形记': ['明清', '讽刺', '长篇小说', '公版书', '官场', '通用'],
  '孽海花': ['明清', '历史', '长篇小说', '公版书', '社会', '通用'],
  '二十年目睹之怪现状': ['明清', '讽刺', '长篇小说', '公版书', '社会', '通用'],
  '骆驼祥子': ['近代', '现实主义', '长篇小说', '经典名著', '公版书', '社会', '通用'],
  '子夜': ['近代', '现实主义', '长篇小说', '经典名著', '公版书', '社会', '通用'],
  '家': ['近代', '现实主义', '长篇小说', '经典名著', '公版书', '家族', '通用'],
  '围城': ['近代', '讽刺', '长篇小说', '经典名著', '公版书', '社会', '通用'],
  '边城': ['近代', '浪漫主义', '中篇小说', '经典名著', '公版书', '爱情', '乡土', '通用'],
  '呐喊': ['近代', '现实主义', '短篇合集', '经典名著', '公版书', '社会', '讽刺批判', '通用'],
  '彷徨': ['近代', '现实主义', '短篇合集', '经典名著', '公版书', '社会', '人性', '通用'],
  '朝花夕拾': ['近代', '散文集', '经典名著', '公版书', '成长', '通用'],
  '大林和小林': ['近代', '奇幻', '长篇小说', '公版书', '冒险', '儿童'],
  '阿Q正传': ['近代', '讽刺', '中篇小说', '经典名著', '公版书', '社会', '人性', '通用'],
  '春秋左传': ['先秦', '历史', '纪实', '经典名著', '公版书', '通用'],
  '昭明文选': ['魏晋', '散文集', '经典名著', '公版书', '通用'],
  '太平广记': ['宋元', '短篇合集', '经典名著', '公版书', '通用'],
  '三侠剑': ['明清', '武侠', '长篇小说', '公版书', '江湖', '男频'],
  '七侠五义': ['明清', '武侠', '长篇小说', '公版书', '江湖', '男频'],
  '万里孤侠': ['近代', '武侠', '长篇小说', '公版书', '江湖', '冒险', '男频'],
};

/** 作者 → 默认标签（时代+体裁倾向） */
const AUTHOR_RULES: Record<string, string[]> = {
  '鲁迅': ['近代', '现实主义', '讽刺批判', '公版书'],
  '巴金': ['近代', '现实主义', '家族', '公版书'],
  '老舍': ['近代', '现实主义', '社会', '公版书'],
  '茅盾': ['近代', '现实主义', '社会', '公版书'],
  '沈从文': ['近代', '浪漫主义', '乡土', '公版书'],
  '钱钟书': ['近代', '讽刺', '公版书'],
  '张爱玲': ['近代', '言情', '人性', '公版书', '女频'],
  '萧红': ['近代', '现实主义', '乡土', '公版书'],
  '郁达夫': ['近代', '浪漫主义', '人性', '公版书'],
  '朱自清': ['近代', '散文', '公版书'],
  '周作人': ['近代', '散文', '公版书'],
  '林语堂': ['近代', '散文', '杂文', '公版书'],
  '梁实秋': ['近代', '散文', '杂文', '公版书'],
  '冰心': ['近代', '散文', '公版书', '通用'],
  '丁玲': ['近代', '现实主义', '革命', '公版书'],
  '曹禺': ['近代', '戏剧', '公版书'],
  '白先勇': ['当代', '现实主义', '人性', '公版书'],
  '施耐庵': ['明清', '公版书'],
  '罗贯中': ['明清', '公版书'],
  '吴承恩': ['明清', '公版书'],
  '曹雪芹': ['明清', '公版书'],
  '蒲松龄': ['明清', '公版书'],
  '吴敬梓': ['明清', '公版书'],
  '司马迁': ['秦汉', '公版书'],
};

// ============ 关键词规则：内容中出现特定词汇 → 推断标签 ============

interface KeywordRule {
  keywords: string[];
  /** 至少匹配到几个关键词才触发 */
  threshold: number;
  tags: string[];
}

const KEYWORD_RULES: KeywordRule[] = [
  {
    keywords: ['剑法', '武功', '江湖', '侠客', '内力', '掌门', '门派', '轻功', '暗器'],
    threshold: 3,
    tags: ['武侠', '江湖', '男频'],
  },
  {
    keywords: ['修仙', '灵气', '飞升', '丹药', '法宝', '元婴', '金丹', '渡劫'],
    threshold: 2,
    tags: ['仙侠', '男频'],
  },
  {
    keywords: ['魔法', '精灵', '龙', '骑士', '魔王', '公主', '王国', '勇者'],
    threshold: 3,
    tags: ['奇幻', '冒险'],
  },
  {
    keywords: ['爱情', '恋爱', '情人', '相爱', '思念', '心动', '约会', '婚姻'],
    threshold: 3,
    tags: ['言情', '爱情'],
  },
  {
    keywords: ['革命', '同志', '斗争', '解放', '党', '红军', '抗日', '根据地'],
    threshold: 3,
    tags: ['革命', '战争'],
  },
  {
    keywords: ['乡村', '农民', '田地', '庄稼', '村子', '土地', '牛', '犁'],
    threshold: 3,
    tags: ['乡土'],
  },
  {
    keywords: ['案件', '凶手', '侦探', '线索', '推理', '嫌疑', '警察', '证据'],
    threshold: 3,
    tags: ['悬疑推理'],
  },
  {
    keywords: ['鬼', '灵异', '阴间', '冥界', '妖怪', '狐仙', '精怪'],
    threshold: 2,
    tags: ['恐怖灵异', '奇幻'],
  },
  {
    keywords: ['朝廷', '皇帝', '大臣', '奏折', '太监', '后宫', '龙椅'],
    threshold: 3,
    tags: ['历史', '官场'],
  },
];

// ============ 体裁推断 ============

function inferForm(data: StoryData): string[] {
  const totalContent = data.chapters.reduce((sum, ch) => sum + ch.content.length, 0);
  const chapterCount = data.chapters.length;

  if (chapterCount === 1 && totalContent < 5000) return ['短篇小说'];
  if (totalContent < 15000) return ['短篇小说'];
  if (totalContent < 50000) return ['中篇小说'];
  if (totalContent >= 50000) return ['长篇小说'];
  return [];
}

/** 判断是否是散文/合集（章节标题多样且每章独立） */
function isEssayCollection(data: StoryData): boolean {
  if (data.chapters.length < 5) return false;
  const avgLen = data.chapters.reduce((s, c) => s + c.content.length, 0) / data.chapters.length;
  // 平均章节长度较短（< 3000字）且章节标题多样
  if (avgLen < 3000) {
    const uniqueTitles = new Set(data.chapters.map(c => c.title.replace(/[《》「」]/g, '')));
    return uniqueTitles.size > data.chapters.length * 0.8;
  }
  return false;
}

// ============ 核心逻辑 ============

function assignTags(data: StoryData): string[] {
  const tagSet = new Set<string>();

  // 1. 精确匹配书名
  const exactTags = TITLE_EXACT_RULES[data.title];
  if (exactTags) {
    exactTags.forEach(t => tagSet.add(t));
  }

  // 2. 作者规则
  if (data.author_name && AUTHOR_RULES[data.author_name]) {
    AUTHOR_RULES[data.author_name].forEach(t => tagSet.add(t));
  }

  // 3. 关键词分析（取前3章 + 中间1章的内容做采样，避免全文扫描太慢）
  const sampleChapters = [
    ...data.chapters.slice(0, 3),
    ...(data.chapters.length > 6 ? [data.chapters[Math.floor(data.chapters.length / 2)]] : []),
  ];
  const sampleText = sampleChapters.map(c => c.content).join(' ');

  for (const rule of KEYWORD_RULES) {
    let matchCount = 0;
    for (const kw of rule.keywords) {
      if (sampleText.includes(kw)) matchCount++;
    }
    if (matchCount >= rule.threshold) {
      rule.tags.forEach(t => tagSet.add(t));
    }
  }

  // 4. 体裁推断
  if (!tagSet.has('长篇小说') && !tagSet.has('中篇小说') && !tagSet.has('短篇小说') &&
      !tagSet.has('散文') && !tagSet.has('散文集') && !tagSet.has('诗歌') &&
      !tagSet.has('戏剧') && !tagSet.has('纪实') && !tagSet.has('短篇合集')) {
    if (isEssayCollection(data)) {
      tagSet.add('散文集');
    } else {
      inferForm(data).forEach(t => tagSet.add(t));
    }
  }

  // 5. 确保有"来源"标签
  if (!tagSet.has('公版书') && !tagSet.has('原创') && !tagSet.has('网文')) {
    tagSet.add('公版书');
  }

  // 6. 确保有"时代"标签（如果还没有）
  const eraTags = ['先秦', '秦汉', '魏晋', '隋唐', '宋元', '明清', '近代', '当代'];
  if (!eraTags.some(t => tagSet.has(t))) {
    // 从原有 tags 中尝试保留
    const oldTags = (data.tags || '').split(',').map(t => t.trim());
    const existingEra = oldTags.find(t => eraTags.includes(t));
    if (existingEra) {
      tagSet.add(existingEra);
    } else {
      tagSet.add('近代'); // 默认归为近代（大部分公版书是近代作品）
    }
  }

  // 7. 确保有受众标签（如果没有则默认通用）
  const audienceTags = ['男频', '女频', '通用', '儿童', '青少年'];
  if (!audienceTags.some(t => tagSet.has(t))) {
    tagSet.add('通用');
  }

  // 8. 已完结标记（公版书全部已完结）
  tagSet.add('已完结');

  // 移除 "文学" 这种过于宽泛的标签
  tagSet.delete('文学');

  return Array.from(tagSet);
}

// ============ 主流程 ============

interface Stats {
  total: number;
  updated: number;
  avgTagsBefore: number;
  avgTagsAfter: number;
  tagDistribution: Record<string, number>;
}

function main(): void {
  console.log('='.repeat(60));
  console.log('  公版书标签重新分配工具');
  console.log('='.repeat(60));
  console.log(`  模式: ${DRY_RUN ? '预览（不写入）' : '执行写入'}`);
  console.log('='.repeat(60));
  console.log('');

  const stats: Stats = { total: 0, updated: 0, avgTagsBefore: 0, avgTagsAfter: 0, tagDistribution: {} };
  let totalTagsBefore = 0;
  let totalTagsAfter = 0;

  const files = SPECIFIC_FILE
    ? [SPECIFIC_FILE]
    : fs.readdirSync(SEED_DATA_DIR).filter(f => f.endsWith('.json')).sort();

  for (const file of files) {
    const filePath = path.join(SEED_DATA_DIR, file);
    let data: StoryData;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      continue;
    }

    stats.total++;
    const oldTags = (data.tags || '').split(',').filter(t => t.trim());
    totalTagsBefore += oldTags.length;

    const newTags = assignTags(data);
    totalTagsAfter += newTags.length;

    // 统计标签分布
    for (const t of newTags) {
      stats.tagDistribution[t] = (stats.tagDistribution[t] || 0) + 1;
    }

    const newTagsStr = newTags.join(',');
    if (data.tags !== newTagsStr) {
      stats.updated++;
      if (!DRY_RUN) {
        data.tags = newTagsStr;
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      }
    }
  }

  stats.avgTagsBefore = stats.total > 0 ? totalTagsBefore / stats.total : 0;
  stats.avgTagsAfter = stats.total > 0 ? totalTagsAfter / stats.total : 0;

  // 输出报告
  console.log('  统计报告:');
  console.log(`    扫描文件:    ${stats.total}`);
  console.log(`    更新文件:    ${stats.updated}`);
  console.log(`    平均标签数:  ${stats.avgTagsBefore.toFixed(1)} → ${stats.avgTagsAfter.toFixed(1)}`);
  console.log('');
  console.log('  标签分布 (前30):');

  const sorted = Object.entries(stats.tagDistribution).sort((a, b) => b[1] - a[1]);
  for (const [tag, count] of sorted.slice(0, 30)) {
    const bar = '█'.repeat(Math.ceil(count / stats.total * 30));
    console.log(`    ${tag.padEnd(10)} ${String(count).padStart(4)} ${bar}`);
  }

  console.log('');
  if (DRY_RUN) {
    console.log('  ⚠ 预览模式，未实际写入。去掉 --dry-run 执行写入。');
  } else {
    console.log(`  ✓ 已完成，共更新 ${stats.updated} 个文件。`);
  }
  console.log('');
}

main();
