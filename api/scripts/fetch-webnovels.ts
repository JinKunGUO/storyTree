/**
 * 网文数据获取/导入工具
 *
 * 通用适配器框架，支持多种数据来源：
 * - local-txt：从本地 TXT 文件批量导入（默认适配器）
 * - local-dir：从包含多个 TXT 的目录批量导入
 *
 * 输出标准 JSON 格式到 seed-data/ 目录，可直接用 batch-import-stories.ts 导入数据库。
 *
 * 用法：
 *   cd api && npx ts-node scripts/fetch-webnovels.ts --source local-txt --path ./novels/斗破苍穹.txt
 *   cd api && npx ts-node scripts/fetch-webnovels.ts --source local-dir --path ./novels/
 *   cd api && npx ts-node scripts/fetch-webnovels.ts --source local-dir --path ./novels/ --dry-run
 *   cd api && npx ts-node scripts/fetch-webnovels.ts --source local-txt --path ./novels/斗破苍穹.txt --author "天蚕土豆" --tags "玄幻,冒险"
 */

import * as fs from 'fs';
import * as path from 'path';
import { splitIntoChapters, Chapter, SplitOptions } from './split-chapters';

// ============ 接口定义 ============

export interface NovelMetadata {
  title: string;
  author_name?: string;
  description?: string;
  tags?: string;
  cover_image?: string;
}

export interface NovelData extends NovelMetadata {
  chapters: Chapter[];
}

/** 数据源适配器接口 */
export interface SourceAdapter {
  name: string;
  /** 获取小说列表（用于批量模式） */
  list(): Promise<string[]>;
  /** 获取单本小说的原始文本 + 元数据 */
  fetch(id: string): Promise<{ text: string; meta: NovelMetadata }>;
}

// ============ 命令行参数 ============

const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const SOURCE_TYPE = getArg('source') || 'local-txt';
const INPUT_PATH = getArg('path');
const AUTHOR = getArg('author');
const TAGS = getArg('tags');
const DESCRIPTION = getArg('description');
const DRY_RUN = args.includes('--dry-run');
const OUTPUT_DIR = path.join(__dirname, 'seed-data');

const SPLIT_OPTIONS: SplitOptions = {
  minChapterLength: 1500,
  targetChapterLength: 6000,
  maxChapterLength: 10000,
};

// ============ 本地 TXT 适配器 ============

class LocalTxtAdapter implements SourceAdapter {
  name = 'local-txt';
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = path.resolve(filePath);
  }

  async list(): Promise<string[]> {
    return [this.filePath];
  }

  async fetch(id: string): Promise<{ text: string; meta: NovelMetadata }> {
    const text = fs.readFileSync(id, 'utf-8');
    const fileName = path.basename(id, path.extname(id));

    return {
      text,
      meta: {
        title: fileName,
        author_name: AUTHOR || undefined,
        description: DESCRIPTION || undefined,
        tags: TAGS || undefined,
      },
    };
  }
}

// ============ 本地目录适配器 ============

class LocalDirAdapter implements SourceAdapter {
  name = 'local-dir';
  private dirPath: string;

  constructor(dirPath: string) {
    this.dirPath = path.resolve(dirPath);
  }

  async list(): Promise<string[]> {
    const files = fs.readdirSync(this.dirPath)
      .filter(f => f.endsWith('.txt'))
      .map(f => path.join(this.dirPath, f))
      .sort();
    return files;
  }

  async fetch(id: string): Promise<{ text: string; meta: NovelMetadata }> {
    const text = fs.readFileSync(id, 'utf-8');
    const fileName = path.basename(id, '.txt');

    // 尝试从同名 .meta.json 读取元数据
    const metaPath = id.replace('.txt', '.meta.json');
    let extraMeta: Partial<NovelMetadata> = {};
    if (fs.existsSync(metaPath)) {
      try {
        extraMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      } catch { /* ignore */ }
    }

    return {
      text,
      meta: {
        title: extraMeta.title || fileName,
        author_name: extraMeta.author_name || AUTHOR || undefined,
        description: extraMeta.description || DESCRIPTION || undefined,
        tags: extraMeta.tags || TAGS || undefined,
        cover_image: extraMeta.cover_image || undefined,
      },
    };
  }
}

// ============ 标签自动推断（复用 reassign-tags 的关键词规则） ============

interface KeywordRule {
  keywords: string[];
  threshold: number;
  tags: string[];
}

const KEYWORD_RULES: KeywordRule[] = [
  { keywords: ['剑法', '武功', '江湖', '侠客', '内力', '掌门', '门派', '轻功', '暗器'], threshold: 3, tags: ['武侠', '江湖', '男频'] },
  { keywords: ['修仙', '灵气', '飞升', '丹药', '法宝', '元婴', '金丹', '渡劫', '灵石'], threshold: 2, tags: ['仙侠', '男频'] },
  { keywords: ['斗气', '魔法', '大陆', '魔兽', '异火', '功法', '炼药', '宗门'], threshold: 3, tags: ['玄幻', '男频'] },
  { keywords: ['魔法', '精灵', '龙', '骑士', '魔王', '公主', '王国', '勇者'], threshold: 3, tags: ['奇幻', '冒险'] },
  { keywords: ['飞船', '星际', '机甲', '基因', '文明', '外星', '量子'], threshold: 2, tags: ['科幻'] },
  { keywords: ['爱情', '恋爱', '情人', '相爱', '心动', '约会', '甜蜜', '暧昧'], threshold: 3, tags: ['言情', '爱情'] },
  { keywords: ['总裁', '豪门', '继承人', '秘书', '合约', '联姻'], threshold: 2, tags: ['都市', '言情', '女频'] },
  { keywords: ['案件', '凶手', '侦探', '线索', '推理', '嫌疑', '警察', '证据'], threshold: 3, tags: ['悬疑推理'] },
  { keywords: ['鬼', '灵异', '阴间', '冥界', '妖怪', '诡异', '恐怖'], threshold: 2, tags: ['恐怖灵异'] },
  { keywords: ['系统', '面板', '任务', '升级', '属性', '积分', '签到'], threshold: 3, tags: ['系统'] },
  { keywords: ['穿越', '重生', '前世', '上辈子', '回到', '醒来发现'], threshold: 2, tags: ['穿越'] },
  { keywords: ['末世', '丧尸', '变异', '废墟', '幸存者', '辐射'], threshold: 2, tags: ['末世'] },
  { keywords: ['游戏', '副本', 'NPC', '装备', '技能', '公会', 'BOSS'], threshold: 3, tags: ['游戏竞技'] },
];

function inferTags(text: string, existingTags?: string): string {
  const tagSet = new Set<string>();

  // 保留已有标签
  if (existingTags) {
    existingTags.split(',').map(t => t.trim()).filter(Boolean).forEach(t => tagSet.add(t));
  }

  // 采样前 30000 字做关键词分析
  const sample = text.slice(0, 30000);
  for (const rule of KEYWORD_RULES) {
    let matchCount = 0;
    for (const kw of rule.keywords) {
      if (sample.includes(kw)) matchCount++;
    }
    if (matchCount >= rule.threshold) {
      rule.tags.forEach(t => tagSet.add(t));
    }
  }

  // 确保有来源标签
  if (!tagSet.has('公版书') && !tagSet.has('原创')) {
    tagSet.add('网文');
  }

  // 体裁推断
  if (!tagSet.has('长篇小说') && !tagSet.has('中篇小说') && !tagSet.has('短篇小说')) {
    if (text.length > 50000) tagSet.add('长篇小说');
    else if (text.length > 15000) tagSet.add('中篇小说');
    else tagSet.add('短篇小说');
  }

  // 默认受众
  const audienceTags = ['男频', '女频', '通用', '儿童', '青少年'];
  if (!audienceTags.some(t => tagSet.has(t))) {
    tagSet.add('通用');
  }

  tagSet.add('已完结');

  return Array.from(tagSet).join(',');
}

// ============ 核心处理逻辑 ============

async function processNovel(adapter: SourceAdapter, id: string): Promise<NovelData | null> {
  const { text, meta } = await adapter.fetch(id);

  if (!text || text.trim().length < 1000) {
    console.log(`  ⚠ 跳过（内容太短）: ${meta.title}`);
    return null;
  }

  // 智能分章
  const chapters = splitIntoChapters(text, SPLIT_OPTIONS);

  // 自动推断标签
  const tags = inferTags(text, meta.tags);

  // 自动生成简介（取前200字）
  const description = meta.description || generateDescription(text);

  return {
    title: meta.title,
    author_name: meta.author_name,
    description,
    tags,
    cover_image: meta.cover_image,
    chapters,
  };
}

function generateDescription(text: string): string {
  // 跳过可能的标题行，取正文前 200 字
  const lines = text.split('\n').filter(l => l.trim().length > 10);
  const firstContent = lines.slice(0, 5).join(' ').slice(0, 200).trim();
  return firstContent ? firstContent + '...' : '';
}

function saveNovel(novel: NovelData): string {
  const fileName = novel.title.replace(/[\/\\:*?"<>|]/g, '_') + '.json';
  const outputPath = path.join(OUTPUT_DIR, fileName);

  if (!DRY_RUN) {
    fs.writeFileSync(outputPath, JSON.stringify(novel, null, 2), 'utf-8');
  }

  return outputPath;
}

// ============ 主入口 ============

async function main() {
  console.log('='.repeat(60));
  console.log('  网文数据获取/导入工具');
  console.log('='.repeat(60));
  console.log(`  数据源: ${SOURCE_TYPE}`);
  console.log(`  输入路径: ${INPUT_PATH || '(未指定)'}`);
  console.log(`  输出目录: ${OUTPUT_DIR}`);
  console.log(`  模式: ${DRY_RUN ? '预览' : '执行'}`);
  console.log('='.repeat(60));
  console.log('');

  if (!INPUT_PATH) {
    console.error('错误: 必须指定 --path 参数');
    console.log('');
    console.log('用法示例:');
    console.log('  # 导入单个 TXT 文件');
    console.log('  npx ts-node scripts/fetch-webnovels.ts --source local-txt --path ./novels/斗破苍穹.txt --author "天蚕土豆" --tags "玄幻,冒险"');
    console.log('');
    console.log('  # 批量导入目录下所有 TXT');
    console.log('  npx ts-node scripts/fetch-webnovels.ts --source local-dir --path ./novels/');
    console.log('');
    console.log('  # 预览模式（不写入文件）');
    console.log('  npx ts-node scripts/fetch-webnovels.ts --source local-dir --path ./novels/ --dry-run');
    console.log('');
    console.log('TXT 文件格式要求:');
    console.log('  - 文件名即书名（如"斗破苍穹.txt"）');
    console.log('  - 内容中包含章节标记（如"第一章 xxx"）会自动识别分章');
    console.log('  - 无章节标记时按空行或固定字数自动切割');
    console.log('');
    console.log('可选: 同目录下放置 .meta.json 文件提供元数据:');
    console.log('  斗破苍穹.meta.json → { "author_name": "天蚕土豆", "tags": "玄幻,冒险", "description": "..." }');
    process.exit(1);
  }

  // 创建适配器
  let adapter: SourceAdapter;
  switch (SOURCE_TYPE) {
    case 'local-txt':
      adapter = new LocalTxtAdapter(INPUT_PATH);
      break;
    case 'local-dir':
      adapter = new LocalDirAdapter(INPUT_PATH);
      break;
    default:
      console.error(`未知数据源: ${SOURCE_TYPE}`);
      console.log('支持的数据源: local-txt, local-dir');
      process.exit(1);
  }

  // 获取文件列表
  const ids = await adapter.list();
  console.log(`  找到 ${ids.length} 个文件`);
  console.log('');

  let success = 0;
  let skipped = 0;
  let totalChapters = 0;

  for (const id of ids) {
    const fileName = path.basename(id);
    process.stdout.write(`  处理: ${fileName} ... `);

    try {
      const novel = await processNovel(adapter, id);
      if (!novel) {
        skipped++;
        continue;
      }

      const outputPath = saveNovel(novel);
      totalChapters += novel.chapters.length;
      success++;
      console.log(`✓ ${novel.chapters.length} 章, 标签: [${novel.tags}]`);
    } catch (err: any) {
      console.log(`✗ 错误: ${err.message}`);
      skipped++;
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('  导入统计');
  console.log('='.repeat(60));
  console.log(`  成功: ${success} 本`);
  console.log(`  跳过: ${skipped} 本`);
  console.log(`  总章数: ${totalChapters}`);
  console.log('');

  if (DRY_RUN) {
    console.log('  ⚠ 预览模式，未写入文件。');
  } else if (success > 0) {
    console.log(`  ✓ 已输出到 ${OUTPUT_DIR}`);
    console.log(`  下一步: npx ts-node scripts/batch-import-stories.ts 将 JSON 导入数据库`);
  }
  console.log('');
}

main().catch(err => {
  console.error('致命错误:', err);
  process.exit(1);
});
