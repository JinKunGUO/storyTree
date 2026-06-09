/**
 * 对现有 seed-data JSON 文件执行智能分章
 *
 * 扫描 seed-data/*.json，找出只有 1 个章节且内容超过阈值的文件，
 * 用 split-chapters.ts 的算法重新切割，覆写原 JSON 文件。
 *
 * 用法：
 *   cd api && npx ts-node scripts/resplit-seed-data.ts
 *   cd api && npx ts-node scripts/resplit-seed-data.ts --dry-run     # 只统计不写入
 *   cd api && npx ts-node scripts/resplit-seed-data.ts --file 三国演义.json  # 只处理单个文件
 *   cd api && npx ts-node scripts/resplit-seed-data.ts --min-length 5000    # 自定义最小内容阈值
 */

import * as fs from 'fs';
import * as path from 'path';
import { splitIntoChapters, SplitOptions } from './split-chapters';

interface ChapterData {
  title: string;
  content: string;
}

interface StoryData {
  title: string;
  description?: string;
  author_name?: string;
  tags?: string;
  cover_image?: string;
  chapters: ChapterData[];
}

// ============ 命令行参数 ============

const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const DRY_RUN = args.includes('--dry-run');
const SPECIFIC_FILE = getArg('file');
const MIN_CONTENT_LENGTH = parseInt(getArg('min-length') || '3000', 10);
const SEED_DATA_DIR = path.join(__dirname, 'seed-data');

// 分章选项
const SPLIT_OPTIONS: SplitOptions = {
  minChapterLength: 1500,
  targetChapterLength: 6000,
  maxChapterLength: 10000,
};

// ============ 统计 ============

interface Stats {
  totalFiles: number;
  singleChapterFiles: number;
  processedFiles: number;
  skippedTooShort: number;
  totalChaptersBefore: number;
  totalChaptersAfter: number;
  errors: string[];
  details: { file: string; title: string; before: number; after: number; contentLength: number }[];
}

const stats: Stats = {
  totalFiles: 0,
  singleChapterFiles: 0,
  processedFiles: 0,
  skippedTooShort: 0,
  totalChaptersBefore: 0,
  totalChaptersAfter: 0,
  errors: [],
  details: [],
};

// ============ 核心逻辑 ============

function processFile(filePath: string): void {
  const fileName = path.basename(filePath);

  let data: StoryData;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    data = JSON.parse(raw);
  } catch (e: any) {
    stats.errors.push(`${fileName}: 读取/解析失败 - ${e.message}`);
    return;
  }

  stats.totalFiles++;

  if (!data.chapters || data.chapters.length !== 1) {
    // 不是单章节，跳过
    return;
  }

  stats.singleChapterFiles++;
  const content = data.chapters[0].content;

  if (!content || content.length < MIN_CONTENT_LENGTH) {
    stats.skippedTooShort++;
    return;
  }

  // 执行分章
  const newChapters = splitIntoChapters(content, SPLIT_OPTIONS);

  if (newChapters.length <= 1) {
    // 分章算法也无法分割（可能确实是短文），跳过
    stats.skippedTooShort++;
    return;
  }

  stats.processedFiles++;
  stats.totalChaptersBefore += 1;
  stats.totalChaptersAfter += newChapters.length;
  stats.details.push({
    file: fileName,
    title: data.title,
    before: 1,
    after: newChapters.length,
    contentLength: content.length,
  });

  if (!DRY_RUN) {
    // 覆写 JSON 文件
    data.chapters = newChapters;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }
}

// ============ 主入口 ============

function main(): void {
  console.log('='.repeat(60));
  console.log('  公版书 seed-data 智能分章工具');
  console.log('='.repeat(60));
  console.log(`  数据目录: ${SEED_DATA_DIR}`);
  console.log(`  最小内容阈值: ${MIN_CONTENT_LENGTH} 字`);
  console.log(`  模式: ${DRY_RUN ? '预览（不写入）' : '执行写入'}`);
  console.log('='.repeat(60));
  console.log('');

  if (SPECIFIC_FILE) {
    const filePath = path.join(SEED_DATA_DIR, SPECIFIC_FILE);
    if (!fs.existsSync(filePath)) {
      console.error(`文件不存在: ${filePath}`);
      process.exit(1);
    }
    processFile(filePath);
  } else {
    const files = fs.readdirSync(SEED_DATA_DIR)
      .filter(f => f.endsWith('.json'))
      .sort();

    for (const file of files) {
      processFile(path.join(SEED_DATA_DIR, file));
    }
  }

  // 输出统计报告
  console.log('');
  console.log('='.repeat(60));
  console.log('  分章统计报告');
  console.log('='.repeat(60));
  console.log(`  扫描文件总数:       ${stats.totalFiles}`);
  console.log(`  单章节文件数:       ${stats.singleChapterFiles}`);
  console.log(`  跳过（内容太短）:   ${stats.skippedTooShort}`);
  console.log(`  成功分章文件数:     ${stats.processedFiles}`);
  console.log(`  分章前总章数:       ${stats.totalChaptersBefore}`);
  console.log(`  分章后总章数:       ${stats.totalChaptersAfter}`);
  console.log('');

  if (stats.details.length > 0) {
    console.log('  分章详情（按章节数降序）:');
    console.log('  ' + '-'.repeat(56));
    const sorted = stats.details.sort((a, b) => b.after - a.after);
    for (const d of sorted.slice(0, 30)) {
      const lengthStr = d.contentLength > 10000
        ? `${(d.contentLength / 10000).toFixed(1)}万字`
        : `${d.contentLength}字`;
      console.log(`    ${d.title.padEnd(16)} ${lengthStr.padStart(8)} → ${d.after} 章`);
    }
    if (sorted.length > 30) {
      console.log(`    ... 及其他 ${sorted.length - 30} 本`);
    }
  }

  if (stats.errors.length > 0) {
    console.log('');
    console.log('  错误:');
    for (const err of stats.errors) {
      console.log(`    ✗ ${err}`);
    }
  }

  console.log('');
  if (DRY_RUN) {
    console.log('  ⚠ 预览模式，未实际写入文件。去掉 --dry-run 参数执行实际写入。');
  } else {
    console.log(`  ✓ 已完成，共更新 ${stats.processedFiles} 个文件。`);
  }
  console.log('');
}

main();
