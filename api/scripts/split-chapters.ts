/**
 * 智能分章算法模块
 *
 * 将一段长文本自动拆分为多个章节。
 * 可被其他脚本复用（如 resplit-seed-data.ts、fetch-webnovels.ts）。
 *
 * 分章策略（优先级从高到低）：
 * 1. 正则匹配章节标记（第X章/回/节/篇/卷/集、Chapter N 等）
 * 2. 按连续空行分段 + 长度阈值（每段不少于 MIN_CHAPTER_LENGTH 字）
 * 3. 固定字数切割（兜底，每 TARGET_CHAPTER_LENGTH 字切一章）
 */

export interface Chapter {
  title: string;
  content: string;
}

export interface SplitOptions {
  /** 最小章节字数，低于此值会与下一段合并（默认 1500） */
  minChapterLength?: number;
  /** 目标章节字数，用于兜底切割（默认 6000） */
  targetChapterLength?: number;
  /** 兜底切割时的最大章节字数（默认 10000） */
  maxChapterLength?: number;
}

const DEFAULT_OPTIONS: Required<SplitOptions> = {
  minChapterLength: 1500,
  targetChapterLength: 6000,
  maxChapterLength: 10000,
};

// ============ 章节标记正则 ============

// 中文数字映射
const CN_NUMS = '一二三四五六七八九十百千零〇';

// 章节标记模式（按常见程度排列）
const CHAPTER_PATTERNS: RegExp[] = [
  // 第X章/回/节/篇/卷/集 + 可选标题
  new RegExp(`^\\s*第[${CN_NUMS}\\d]+[章回节篇卷集].*$`, 'm'),
  // "卷一"、"卷二" 等
  new RegExp(`^\\s*卷[${CN_NUMS}\\d]+.*$`, 'm'),
  // "上篇"、"中篇"、"下篇"、"序章"、"终章"、"尾声"、"楔子"
  /^\s*(上篇|中篇|下篇|序章|序言|终章|尾声|楔子|引子|前言|后记).*$/m,
  // Chapter N / CHAPTER N
  /^\s*Chapter\s+\d+.*$/im,
  // 纯数字章节号："1."、"01."、"1、"
  /^\s*\d{1,4}[\.、\s].*$/m,
];

/**
 * 尝试用章节标记正则分割文本
 * 返回 null 表示未能有效分割（匹配到的章节数 < 2）
 */
function splitByChapterMarkers(text: string, options: Required<SplitOptions>): Chapter[] | null {
  // 逐个模式尝试
  for (const pattern of CHAPTER_PATTERNS) {
    const chapters = trySplitWithPattern(text, pattern, options);
    if (chapters && chapters.length >= 2) {
      return chapters;
    }
  }
  return null;
}

function trySplitWithPattern(
  text: string,
  pattern: RegExp,
  options: Required<SplitOptions>
): Chapter[] | null {
  // 获取全局匹配版本
  const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');

  const matches: { index: number; title: string }[] = [];
  let match: RegExpExecArray | null;

  while ((match = globalPattern.exec(text)) !== null) {
    matches.push({ index: match.index, title: match[0].trim() });
  }

  if (matches.length < 2) {
    return null;
  }

  const chapters: Chapter[] = [];

  // 如果第一个匹配之前有大量内容，作为"前言"或"序"
  if (matches[0].index > options.minChapterLength) {
    const preContent = text.slice(0, matches[0].index).trim();
    if (preContent.length > 100) {
      chapters.push({
        title: '序',
        content: preContent,
      });
    }
  }

  // 按匹配位置切割
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i < matches.length - 1 ? matches[i + 1].index : text.length;
    const fullText = text.slice(start, end).trim();

    // 标题是匹配行本身，内容是标题之后的文本
    const titleEnd = fullText.indexOf('\n');
    const title = titleEnd > 0 ? fullText.slice(0, titleEnd).trim() : matches[i].title;
    const content = titleEnd > 0 ? fullText.slice(titleEnd).trim() : '';

    if (content.length > 0) {
      chapters.push({ title, content });
    }
  }

  // 合并过短的章节
  return mergeShortChapters(chapters, options.minChapterLength);
}

/**
 * 按连续空行分段，然后合并过短段落
 */
function splitByBlankLines(text: string, options: Required<SplitOptions>): Chapter[] | null {
  // 按 2 个以上连续换行分割
  const segments = text.split(/\n{2,}/).map(s => s.trim()).filter(s => s.length > 0);

  if (segments.length < 3) {
    return null;
  }

  // 合并相邻的短段落，直到达到 minChapterLength
  const chapters: Chapter[] = [];
  let buffer = '';
  let chapterIndex = 1;

  for (const seg of segments) {
    buffer += (buffer ? '\n\n' : '') + seg;

    if (buffer.length >= options.minChapterLength) {
      chapters.push({
        title: `第 ${chapterIndex} 章`,
        content: buffer,
      });
      buffer = '';
      chapterIndex++;
    }
  }

  // 剩余内容
  if (buffer.length > 0) {
    if (chapters.length > 0 && buffer.length < options.minChapterLength) {
      // 合并到最后一章
      chapters[chapters.length - 1].content += '\n\n' + buffer;
    } else {
      chapters.push({
        title: `第 ${chapterIndex} 章`,
        content: buffer,
      });
    }
  }

  if (chapters.length < 2) {
    return null;
  }

  return chapters;
}

/**
 * 兜底：按固定字数切割
 * 尽量在段落边界（换行符）处切割
 */
function splitByFixedLength(text: string, options: Required<SplitOptions>): Chapter[] {
  const { targetChapterLength, maxChapterLength } = options;
  const chapters: Chapter[] = [];
  let remaining = text;
  let chapterIndex = 1;

  while (remaining.length > 0) {
    if (remaining.length <= maxChapterLength) {
      chapters.push({
        title: `第 ${chapterIndex} 章`,
        content: remaining.trim(),
      });
      break;
    }

    // 在 target 附近找换行符作为切割点
    let cutPoint = targetChapterLength;

    // 向后搜索最近的换行符（不超过 maxChapterLength）
    const newlineAfter = remaining.indexOf('\n', cutPoint);
    if (newlineAfter > 0 && newlineAfter <= maxChapterLength) {
      cutPoint = newlineAfter + 1;
    } else {
      // 向前搜索
      const newlineBefore = remaining.lastIndexOf('\n', cutPoint);
      if (newlineBefore > targetChapterLength * 0.5) {
        cutPoint = newlineBefore + 1;
      }
    }

    chapters.push({
      title: `第 ${chapterIndex} 章`,
      content: remaining.slice(0, cutPoint).trim(),
    });
    remaining = remaining.slice(cutPoint);
    chapterIndex++;
  }

  return chapters;
}

/**
 * 合并过短的章节到相邻章节
 */
function mergeShortChapters(chapters: Chapter[], minLength: number): Chapter[] {
  if (chapters.length <= 1) return chapters;

  const result: Chapter[] = [];

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];

    if (ch.content.length < minLength && result.length > 0) {
      // 合并到前一章
      result[result.length - 1].content += '\n\n' + ch.content;
    } else if (ch.content.length < minLength && i < chapters.length - 1) {
      // 合并到下一章（修改下一章的内容）
      chapters[i + 1].content = ch.content + '\n\n' + chapters[i + 1].content;
    } else {
      result.push(ch);
    }
  }

  return result;
}

// ============ 主入口 ============

/**
 * 智能分章：将一段长文本拆分为多个章节
 *
 * @param text - 原始全文文本
 * @param options - 分章选项
 * @returns 章节数组
 */
export function splitIntoChapters(text: string, options?: SplitOptions): Chapter[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // 预处理：统一换行符
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 如果文本太短，不分章
  if (normalized.length < opts.minChapterLength * 2) {
    return [{ title: '全文', content: normalized.trim() }];
  }

  // 策略 1：正则匹配章节标记
  const byMarkers = splitByChapterMarkers(normalized, opts);
  if (byMarkers && byMarkers.length >= 2) {
    return byMarkers;
  }

  // 策略 2：按空行分段
  const byBlankLines = splitByBlankLines(normalized, opts);
  if (byBlankLines && byBlankLines.length >= 2) {
    return byBlankLines;
  }

  // 策略 3：固定字数切割（兜底）
  return splitByFixedLength(normalized, opts);
}

// ============ CLI 入口（直接运行时） ============

if (require.main === module) {
  const testText = process.argv[2];
  if (testText) {
    const fs = require('fs');
    const content = fs.readFileSync(testText, 'utf-8');
    const chapters = splitIntoChapters(content);
    console.log(`分章结果：共 ${chapters.length} 章`);
    for (const ch of chapters) {
      console.log(`  [${ch.title}] ${ch.content.length} 字`);
    }
  } else {
    console.log('用法: npx ts-node scripts/split-chapters.ts <文本文件路径>');
    console.log('也可作为模块导入: import { splitIntoChapters } from "./split-chapters"');
  }
}
