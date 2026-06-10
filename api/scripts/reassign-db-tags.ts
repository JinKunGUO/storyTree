/**
 * 生产环境标签重新分配脚本（数据库版）
 *
 * 直接操作数据库，无需依赖 seed-data JSON 文件。
 * 基于书名精确匹配、作者规则、内容关键词分析为公版书分配多维度标签。
 *
 * 用法：
 *   cd api && npx ts-node scripts/reassign-db-tags.ts --dry-run       # 只预览不写入
 *   cd api && npx ts-node scripts/reassign-db-tags.ts                 # 执行写入
 *   cd api && npx ts-node scripts/reassign-db-tags.ts --story-id 123  # 只处理指定故事
 *   cd api && npx ts-node scripts/reassign-db-tags.ts --limit 10      # 限制处理数量
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============ 命令行参数 ============

const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const DRY_RUN = args.includes('--dry-run');
const SPECIFIC_STORY_ID = getArg('story-id') ? parseInt(getArg('story-id')!, 10) : undefined;
const LIMIT = getArg('limit') ? parseInt(getArg('limit')!, 10) : undefined;

// ============ 标签规则 ============

/** 书名精确匹配 → 标签数组 */
const TITLE_EXACT_RULES: Record<string, string[]> = {
  '西游记': ['明清', '奇幻', '长篇小说', '经典名著', '公版书', '冒险', '通用'],
  '红楼梦': ['明清', '言情', '长篇小说', '经典名著', '公版书', '家族', '通用'],
  '三国演义': ['明清', '历史', '长篇小说', '经典名著', '公版书', '战争', '男频'],
  '水浒传': ['明清', '武侠', '长篇小说', '经典名著', '公版书', '江湖', '男频'],
  '聊斋志异': ['明清', '恐怖灵异', '短篇合集', '经典名著', '公版书', '奇幻', '通用'],
  '儒林外史': ['明清', '讽刺', '长篇小说', '经典名著', '公版书', '社会', '通用'],
  '镜花缘': ['明清', '奇幻', '长篇小说', '公版书', '冒险', '通用'],
  '封神演义': ['明清', '奇幻', '长篇小说', '公版书', '战争', '男频'],
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
  '史记': ['秦汉', '历史', '纪实', '经典名著', '公版书', '通用'],
  '资治通鉴': ['宋元', '历史', '纪实', '经典名著', '公版书', '通用'],
  '世说新语': ['魏晋', '短篇合集', '经典名著', '公版书', '通用'],
  '搜神记': ['魏晋', '恐怖灵异', '短篇合集', '公版书', '奇幻', '通用'],
  '金瓶梅': ['明清', '现实主义', '长篇小说', '经典名著', '公版书', '社会', '通用'],
  '初刻拍案惊奇': ['明清', '短篇合集', '公版书', '社会', '通用'],
  '二刻拍案惊奇': ['明清', '短篇合集', '公版书', '社会', '通用'],
  '东周列国志': ['明清', '历史', '长篇小说', '公版书', '战争', '男频'],
  '隋唐演义': ['明清', '历史', '长篇小说', '公版书', '战争', '男频'],
  '说岳全传': ['明清', '历史', '长篇小说', '公版书', '战争', '男频'],
  '杨家将': ['明清', '历史', '长篇小说', '公版书', '战争', '男频'],
  '济公全传': ['明清', '奇幻', '长篇小说', '公版书', '冒险', '通用'],
  '三言二拍': ['明清', '短篇合集', '公版书', '社会', '通用'],
  '醒世恒言': ['明清', '短篇合集', '公版书', '社会', '通用'],
  '警世通言': ['明清', '短篇合集', '公版书', '社会', '通用'],
  '喻世明言': ['明清', '短篇合集', '公版书', '社会', '通用'],
  '牡丹亭': ['明清', '戏剧', '经典名著', '公版书', '爱情', '通用'],
  '西厢记': ['宋元', '戏剧', '经典名著', '公版书', '爱情', '通用'],
  '窦娥冤': ['宋元', '戏剧', '经典名著', '公版书', '社会', '通用'],
  '长生殿': ['明清', '戏剧', '公版书', '爱情', '通用'],
  '桃花扇': ['明清', '戏剧', '公版书', '历史', '爱情', '通用'],
  '雷雨': ['近代', '戏剧', '经典名著', '公版书', '家族', '通用'],
  '日出': ['近代', '戏剧', '经典名著', '公版书', '社会', '通用'],
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
  '班固': ['秦汉', '历史', '公版书'],
  '陈寿': ['魏晋', '历史', '公版书'],
  '刘义庆': ['魏晋', '公版书'],
  '干宝': ['魏晋', '公版书'],
  '李汝珍': ['明清', '公版书'],
  '刘鹗': ['明清', '公版书'],
  '李伯元': ['明清', '公版书'],
  '曾朴': ['明清', '公版书'],
  '吴趼人': ['明清', '公版书'],
  '张恨水': ['近代', '言情', '公版书', '通用'],
  '徐志摩': ['近代', '诗歌', '浪漫主义', '公版书'],
};

// ============ 关键词规则 ============

interface KeywordRule {
  keywords: string[];
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

function inferForm(totalContent: number, chapterCount: number): string[] {
  if (chapterCount === 1 && totalContent < 5000) return ['短篇小说'];
  if (totalContent < 15000) return ['短篇小说'];
  if (totalContent < 50000) return ['中篇小说'];
  if (totalContent >= 50000) return ['长篇小说'];
  return [];
}

function isEssayCollection(chapters: { title: string; content: string }[]): boolean {
  if (chapters.length < 5) return false;
  const avgLen = chapters.reduce((s, c) => s + c.content.length, 0) / chapters.length;
  if (avgLen < 3000) {
    const uniqueTitles = new Set(chapters.map(c => c.title.replace(/[《》「」]/g, '')));
    return uniqueTitles.size > chapters.length * 0.8;
  }
  return false;
}

// ============ 核心标签分配逻辑 ============

interface StoryInput {
  title: string;
  authorName: string | null;
  existingTags: string;
  chapters: { title: string; content: string }[];
}

function assignTags(story: StoryInput): string[] {
  const tagSet = new Set<string>();

  // 1. 精确匹配书名
  const exactTags = TITLE_EXACT_RULES[story.title];
  if (exactTags) {
    exactTags.forEach(t => tagSet.add(t));
  }

  // 2. 作者规则
  if (story.authorName && AUTHOR_RULES[story.authorName]) {
    AUTHOR_RULES[story.authorName].forEach(t => tagSet.add(t));
  }

  // 3. 关键词分析（取前3章 + 中间1章做采样）
  const sampleChapters = [
    ...story.chapters.slice(0, 3),
    ...(story.chapters.length > 6 ? [story.chapters[Math.floor(story.chapters.length / 2)]] : []),
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
    if (isEssayCollection(story.chapters)) {
      tagSet.add('散文集');
    } else {
      const totalContent = story.chapters.reduce((s, c) => s + c.content.length, 0);
      inferForm(totalContent, story.chapters.length).forEach(t => tagSet.add(t));
    }
  }

  // 5. 确保有"来源"标签
  if (!tagSet.has('公版书') && !tagSet.has('原创') && !tagSet.has('网文')) {
    tagSet.add('公版书');
  }

  // 6. 确保有"时代"标签
  const eraTags = ['先秦', '秦汉', '魏晋', '隋唐', '宋元', '明清', '近代', '当代'];
  if (!eraTags.some(t => tagSet.has(t))) {
    const oldTags = (story.existingTags || '').split(',').map(t => t.trim());
    const existingEra = oldTags.find(t => eraTags.includes(t));
    if (existingEra) {
      tagSet.add(existingEra);
    } else {
      tagSet.add('近代');
    }
  }

  // 7. 确保有受众标签
  const audienceTags = ['男频', '女频', '通用', '儿童', '青少年'];
  if (!audienceTags.some(t => tagSet.has(t))) {
    tagSet.add('通用');
  }

  // 8. 已完结标记
  tagSet.add('已完结');

  // 移除过于宽泛的标签
  tagSet.delete('文学');

  return Array.from(tagSet);
}

// ============ 主流程 ============

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('  公版书标签重新分配工具（数据库版）');
  console.log('='.repeat(60));
  console.log(`  模式: ${DRY_RUN ? '预览（不写入）' : '执行写入'}`);
  if (SPECIFIC_STORY_ID) console.log(`  指定故事: ID ${SPECIFIC_STORY_ID}`);
  if (LIMIT) console.log(`  处理上限: ${LIMIT}`);
  console.log('='.repeat(60));
  console.log('');

  // 查询所有公版书（由虚拟用户创建的故事）
  const whereClause: any = {};
  if (SPECIFIC_STORY_ID) {
    whereClause.id = SPECIFIC_STORY_ID;
  } else {
    // 公版书 = 作者是虚拟用户
    whereClause.author = { is_virtual: true };
  }

  const stories = await prisma.stories.findMany({
    where: whereClause,
    select: {
      id: true,
      title: true,
      tags: true,
      author: { select: { username: true, is_virtual: true } },
    },
    orderBy: { id: 'asc' },
    ...(LIMIT ? { take: LIMIT } : {}),
  });

  console.log(`  找到 ${stories.length} 本公版书`);
  console.log('');

  let updated = 0;
  let totalTagsBefore = 0;
  let totalTagsAfter = 0;
  const tagDistribution: Record<string, number> = {};

  for (const story of stories) {
    // 获取该故事的章节（用于关键词分析和体裁推断）
    // 采样策略：只取前4章 + 中间1章，避免全量读取大书
    const totalNodes = await prisma.nodes.count({ where: { story_id: story.id } });
    const nodesToFetch = Math.min(totalNodes, 5);

    // 取前3章
    const firstNodes = await prisma.nodes.findMany({
      where: { story_id: story.id },
      select: { title: true, content: true },
      orderBy: { id: 'asc' },
      take: 3,
    });

    // 取中间1章（如果总数 > 6）
    let middleNodes: { title: string; content: string }[] = [];
    if (totalNodes > 6) {
      const skipCount = Math.floor(totalNodes / 2);
      middleNodes = await prisma.nodes.findMany({
        where: { story_id: story.id },
        select: { title: true, content: true },
        orderBy: { id: 'asc' },
        skip: skipCount,
        take: 1,
      });
    }

    const chapters = [...firstNodes, ...middleNodes];
    const oldTags = (story.tags || '').split(',').filter(t => t.trim());
    totalTagsBefore += oldTags.length;

    const storyInput: StoryInput = {
      title: story.title,
      authorName: story.author?.username || null,
      existingTags: story.tags || '',
      chapters,
    };

    const newTags = assignTags(storyInput);
    totalTagsAfter += newTags.length;

    // 统计标签分布
    for (const t of newTags) {
      tagDistribution[t] = (tagDistribution[t] || 0) + 1;
    }

    const newTagsStr = newTags.join(',');
    if (story.tags !== newTagsStr) {
      updated++;
      if (!DRY_RUN) {
        await prisma.stories.update({
          where: { id: story.id },
          data: { tags: newTagsStr },
        });
      }
      // 显示变化
      console.log(`  [${story.id}] ${story.title}`);
      console.log(`    旧: ${story.tags || '(空)'}`);
      console.log(`    新: ${newTagsStr}`);
      console.log('');
    }
  }

  // 输出报告
  console.log('-'.repeat(60));
  console.log('  统计报告:');
  console.log(`    扫描故事:    ${stories.length}`);
  console.log(`    更新故事:    ${updated}`);
  console.log(`    平均标签数:  ${stories.length > 0 ? (totalTagsBefore / stories.length).toFixed(1) : 0} → ${stories.length > 0 ? (totalTagsAfter / stories.length).toFixed(1) : 0}`);
  console.log('');
  console.log('  标签分布 (前30):');

  const sorted = Object.entries(tagDistribution).sort((a, b) => b[1] - a[1]);
  for (const [tag, count] of sorted.slice(0, 30)) {
    const bar = '█'.repeat(Math.ceil(count / stories.length * 30));
    console.log(`    ${tag.padEnd(10)} ${String(count).padStart(4)} ${bar}`);
  }

  console.log('');
  if (DRY_RUN) {
    console.log('  ⚠ 预览模式，未实际写入。去掉 --dry-run 执行写入。');
  } else {
    console.log(`  ✓ 已完成，共更新 ${updated} 本故事的标签。`);
  }
  console.log('');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('执行失败:', e);
  await prisma.$disconnect();
  process.exit(1);
});
