import * as fs from 'fs';
import * as path from 'path';

/**
 * TXT 文本 -> JSON 转换工具（增强版）
 * 
 * 将纯文本小说/故事自动按章节分割，生成 batch-import-stories.ts 所需的 JSON 格式。
 * 
 * ===== 新增功能 =====
 * - 自动检测文件编码（支持 UTF-8、GBK、GB2312 等）
 * - 支持从外部目录直接导入
 * - 支持递归扫描子目录
 * - 根据目录名/文件名自动分配标签
 * - 更多章节格式支持
 * 
 * ===== 使用方法 =====
 * 
 * cd api
 * 
 * # 基本用法：转换 raw/ 下所有 txt
 * npx ts-node scripts/text-to-json.ts
 * 
 * # 只转换指定文件
 * npx ts-node scripts/text-to-json.ts 西游记.txt
 * 
 * # 从外部目录导入（推荐）
 * npx ts-node scripts/text-to-json.ts --source /Users/jinkun/shu/books
 * 
 * # 递归扫描子目录
 * npx ts-node scripts/text-to-json.ts --source /Users/jinkun/shu/books --recursive
 * 
 * # 强制重新转换（覆盖已存在的 JSON）
 * npx ts-node scripts/text-to-json.ts --force
 * 
 * ===== TXT 文件格式要求 =====
 * 
 * 1. 纯文本，支持 UTF-8/GBK/GB2312 编码（自动检测）
 * 2. 章节标题独占一行，支持以下格式（自动识别）：
 *    - "第一回 xxx" / "第1回 xxx"
 *    - "第一章 xxx" / "第1章 xxx"
 *    - "第一篇 xxx" / "第1篇 xxx"
 *    - "第一节 xxx" / "第1节 xxx"
 *    - "第一卷 xxx" / "第1卷 xxx"
 *    - "【第一章】xxx"
 *    - "Chapter 1" / "CHAPTER 1"
 *    - "一、xxx" / "1、xxx" / "1. xxx"
 *    - "(一) xxx" / "（一）xxx"
 *    - "卷一 xxx" / "上卷 xxx"
 * 3. 可选：文件前几行如果包含元数据，会自动提取：
 *    [描述] 这是一部经典小说...
 *    [标签] 古典文学,神话,冒险
 *    [作者] 原作者名
 *    [年份] 出版年份
 */

// ===== 配置 =====
const DEFAULT_RAW_DIR = path.join(__dirname, 'seed-data', 'raw');
const OUTPUT_DIR = path.join(__dirname, 'seed-data');

// 解析命令行参数
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('--') ? args[idx + 1] : undefined;
}
function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

const SOURCE_DIR = getArg('source') || DEFAULT_RAW_DIR;
const RECURSIVE = hasFlag('recursive');
const FORCE = hasFlag('force');
const SPECIFIC_FILE = args.find(a => !a.startsWith('--') && a.endsWith('.txt'));

// ===== 章节标题正则（增强版）=====
// 注意：所有正则都需要在 isChapterTitle 函数中对 trim() 后的文本进行匹配
const CHAPTER_PATTERNS = [
  // ===== 古典文学常见格式 =====
  
  // 《书名·篇名·章节第X》格式（如庄子）
  // 例：《庄子·内篇·逍遥游第一》
  /^《.+[·・].+第[零一二三四五六七八九十百千万\d]+》$/,
  
  // 《标题》格式（如呐喊中的各篇）
  // 例：《呐喊》自序、《狂人日记》
  /^《[\u4e00-\u9fa5]{1,20}》(?:自序|序|跋)?$/,
  
  // 卷X + 篇名第X 格式（如论语）
  // 例：卷一　学而第一、卷一　为政第二
  /^卷[零一二三四五六七八九十百千万\d]+[　\s]+.+第[零一二三四五六七八九十百千万\d]+$/,
  
  // 正文 + 第X回/章 格式（如三国演义）
  // 例：正文 第二回　张翼德怒鞭督邮　何国舅谋诛宦竖
  /^正文\s+第[零一二三四五六七八九十百千万\d]+[回章篇节卷].*/,
  
  // ===== 标准章节格式 =====
  
  // 第X回/章/篇/节/卷 + 标题（最常见格式）
  // 例：第一回 xxx、第1章 xxx、第十二节 xxx
  /^第[零一二三四五六七八九十百千万\d]+[回章篇节卷][　\s]*.*/,
  
  // 【第X章】格式
  // 例：【第一章】xxx、【第2回】xxx
  /^【第[零一二三四五六七八九十百千万\d]+[回章篇节卷]】.*/,
  
  // ◆ 第X章 格式（带特殊符号前缀）
  /^[◆◇■□▲△●○★☆]\s*第[零一二三四五六七八九十百千万\d]+[回章篇节卷].*/,
  
  // ===== 英文格式 =====
  
  // Chapter X / CHAPTER X
  /^[Cc][Hh][Aa][Pp][Tt][Ee][Rr]\s+\d+.*/,
  
  // Part 1 / PART ONE
  /^[Pp][Aa][Rr][Tt]\s+(\d+|[Oo][Nn][Ee]|[Tt][Ww][Oo]|[Tt][Hh][Rr][Ee][Ee]).*/,
  
  // ===== 序号格式 =====
  
  // 卷X xxx / 上卷 xxx / 卷首 xxx（独立卷标题）
  // 例：卷一 xxx、上卷 xxx、卷首语
  /^卷[零一二三四五六七八九十百千万\d首尾上中下]+[　\s]+.+/,
  /^[上中下]卷[　\s]+.*/,
  
  // 中文数字 + 空格 + 标题（如墨子：一 亲士、二 修身）
  // 例：一 亲士、二 修身、十五 兼爱上
  /^[零一二三四五六七八九十百千万]+[　\s]+[\u4e00-\u9fa5]{1,20}$/,
  
  // 中文数字序号：一、xxx / 二、xxx（需要有后续内容）
  // 例：一、绑架事件、二、调查开始
  /^[零一二三四五六七八九十百千万]+[、．.][　\s]*.+/,
  
  // 阿拉伯数字 + 空格 + 标题（如：1 亲士、2 修身）
  /^\d+[　\s]+[\u4e00-\u9fa5]{1,20}$/,
  
  // 阿拉伯数字序号：1、xxx / 1. xxx（需要有后续内容）
  // 例：1、绑架事件、1. 调查开始
  /^\d+[、．.][　\s]*.+/,
  
  // 括号序号：(一) xxx / （一）xxx / [一] xxx
  // 例：(一) xxx、（1）xxx、[第一章] xxx
  /^[（(【\[]\s*[零一二三四五六七八九十百千万\d]+\s*[）)】\]][　\s]*.+/,
  /^[（(【\[]\s*第?[零一二三四五六七八九十百千万\d]+[回章篇节卷]?\s*[）)】\]][　\s]*.*/,
  
  // ===== 特殊格式 =====
  
  // 篇名第X 格式（无卷号）
  // 例：学而第一、为政第二
  /^[\u4e00-\u9fa5]{2,6}第[零一二三四五六七八九十百千万\d]+$/,
  
  // 内篇/外篇/杂篇 + 篇名
  // 例：内篇·逍遥游、外篇·秋水
  /^[内外杂]篇[·・　\s]+[\u4e00-\u9fa5]+/,
  
  // XXX篇 格式（如墨子的 亲士篇、修身篇）
  // 例：亲士篇、修身篇、所染篇
  /^[\u4e00-\u9fa5]{2,6}篇$/,
];

// ===== 标签映射配置 =====
// 根据目录名或文件名自动分配标签
const TAG_MAPPING: Record<string, string> = {
  // 朝代分类
  '先秦': '先秦,古典文学,哲学',
  '秦汉': '秦汉,古典文学,历史',
  '魏晋': '魏晋,古典文学,历史',
  '隋唐': '隋唐,古典文学,历史',
  '宋元': '宋元,古典文学,历史',
  '明清': '明清,古典文学,历史',
  '近代': '近代,文学',
  
  // 经典著作
  '论语': '儒家,经典,哲学,先秦',
  '孟子': '儒家,经典,哲学,先秦',
  '道德经': '道家,经典,哲学,先秦',
  '庄子': '道家,经典,哲学,先秦',
  '墨子': '墨家,经典,哲学,先秦',
  '孙子兵法': '兵法,经典,军事,先秦',
  '韩非子': '法家,经典,哲学,先秦',
  '诗经': '诗歌,经典,先秦',
  '尚书': '经典,历史,先秦',
  '春秋左传': '经典,历史,先秦',
  '史记': '历史,经典,秦汉',
  '汉书': '历史,经典,秦汉',
  '战国策': '历史,经典,先秦',
  '吕氏春秋': '哲学,历史,秦汉',
  '淮南子': '哲学,道家,秦汉',
  '盐铁论': '经济,历史,秦汉',
  
  // 四大名著
  '三国演义': '四大名著,古典文学,历史演义,明清',
  '水浒传': '四大名著,古典文学,侠义小说,明清',
  '西游记': '四大名著,古典文学,神魔小说,明清',
  '红楼梦': '四大名著,古典文学,言情小说,明清',
  
  // 其他经典小说
  '封神演义': '神魔小说,古典文学,明清',
  '儒林外史': '讽刺小说,古典文学,明清',
  '聊斋志异': '志怪小说,古典文学,明清',
  '隋唐演义': '历史演义,古典文学,明清',
  '东周列国志': '历史演义,古典文学,明清',
  '镜花缘': '神魔小说,古典文学,明清',
  
  // 科技类
  '本草纲目': '医学,科技,明清',
  '天工开物': '科技,工艺,明清',
  '梦溪笔谈': '科技,笔记,宋元',
  '齐民要术': '农学,科技',
  
  // 其他
  '太平广记': '志怪,笔记,宋元',
  '昭明文选': '文学,诗文,魏晋',
  '曾国藩家书': '家书,近代',
  '南方草木状': '博物,魏晋',
};

// 简单的编码检测（检测前 1000 字节）
function detectEncoding(buffer: Buffer): string {
  const sample = buffer.slice(0, Math.min(1000, buffer.length));
  
  // 检测 UTF-8 BOM
  if (sample[0] === 0xEF && sample[1] === 0xBB && sample[2] === 0xBF) {
    return 'utf-8';
  }
  
  // 尝试 UTF-8 解码
  try {
    const text = sample.toString('utf-8');
    // 检查是否有乱码（常见的 GBK 误读为 UTF-8 的特征）
    if (!/[\uFFFD]/.test(text) && /[\u4e00-\u9fa5]/.test(text)) {
      return 'utf-8';
    }
  } catch (e) {
    // UTF-8 解码失败
  }
  
  // 默认使用 GBK（中文 Windows 常用编码）
  return 'gbk';
}

// 读取文件并自动检测编码
function readFileWithEncoding(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  const encoding = detectEncoding(buffer);
  
  if (encoding === 'utf-8') {
    return buffer.toString('utf-8');
  } else {
    // GBK 需要使用 iconv-lite 或手动转换
    // 这里简化处理：先尝试 UTF-8，失败则提示用户转换
    try {
      return buffer.toString('utf-8');
    } catch (e) {
      console.log(`  ⚠️  编码检测为 ${encoding}，但 Node.js 不直接支持，请先转换为 UTF-8`);
      console.log(`     macOS 转换命令: iconv -f GBK -t UTF-8 "${filePath}" > "${filePath}.utf8"`);
      throw new Error('编码不支持');
    }
  }
}

// 根据文件路径自动分配标签
function autoAssignTags(filePath: string, existingTags: string): string {
  const fileName = path.basename(filePath, '.txt');
  const dirName = path.basename(path.dirname(filePath));
  
  const tags = new Set<string>();
  
  // 添加已有标签
  if (existingTags) {
    existingTags.split(',').forEach(t => tags.add(t.trim()));
  }
  
  // 根据文件名匹配
  for (const [key, value] of Object.entries(TAG_MAPPING)) {
    if (fileName.includes(key)) {
      value.split(',').forEach(t => tags.add(t.trim()));
      break;
    }
  }
  
  // 根据目录名匹配
  if (TAG_MAPPING[dirName]) {
    TAG_MAPPING[dirName].split(',').forEach(t => tags.add(t.trim()));
  }
  
  return Array.from(tags).join(',');
}

// 元数据提取（增强版）
function extractMeta(lines: string[]): { description: string; tags: string; author: string; year: string; contentStartIdx: number } {
  let description = '';
  let tags = '';
  let author = '';
  let year = '';
  let contentStartIdx = 0;

  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const line = lines[i].trim();
    if (line.startsWith('[描述]') || line.startsWith('[简介]')) {
      description = line.replace(/^\[(?:描述|简介)\]\s*/, '');
      contentStartIdx = i + 1;
    } else if (line.startsWith('[标签]') || line.startsWith('[分类]')) {
      tags = line.replace(/^\[(?:标签|分类)\]\s*/, '');
      contentStartIdx = i + 1;
    } else if (line.startsWith('[作者]')) {
      author = line.replace(/^\[作者\]\s*/, '');
      contentStartIdx = i + 1;
    } else if (line.startsWith('[年份]') || line.startsWith('[时代]')) {
      year = line.replace(/^\[(?:年份|时代)\]\s*/, '');
      contentStartIdx = i + 1;
    } else if (line === '' && contentStartIdx > 0) {
      contentStartIdx = i + 1;
    } else if (line !== '' && !line.startsWith('[')) {
      break;
    }
  }

  return { description, tags, author, year, contentStartIdx };
}

// 判断一行是否是章节标题
function isChapterTitle(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 100) return false; // 标题不应超过100字
  return CHAPTER_PATTERNS.some(pattern => pattern.test(trimmed));
}

// 分割章节（增强版）
interface ConvertResult {
  title: string;
  description: string;
  tags: string;
  author?: string;
  year?: string;
  chapters: { title: string; content: string }[];
}

function splitChapters(text: string, filePath: string): ConvertResult {
  const lines = text.split(/\r?\n/);
  const title = path.basename(filePath, path.extname(filePath));

  // 提取元数据
  const meta = extractMeta(lines);
  const contentLines = lines.slice(meta.contentStartIdx);

  // 查找所有章节标题的行号
  const chapterStarts: { lineIdx: number; title: string }[] = [];
  for (let i = 0; i < contentLines.length; i++) {
    if (isChapterTitle(contentLines[i])) {
      chapterStarts.push({ lineIdx: i, title: contentLines[i].trim() });
    }
  }

  const chapters: { title: string; content: string }[] = [];

  if (chapterStarts.length === 0) {
    // 没有检测到章节标题，整个文件作为一章
    const content = contentLines.join('\n').trim();
    if (content) {
      chapters.push({ title: '全文', content });
    }
    console.log(`  ⚠️  未检测到章节标题，整个文件作为一章`);
  } else {
    // 如果第一个章节标题前有内容，作为"前言/序"
    if (chapterStarts[0].lineIdx > 0) {
      const preamble = contentLines.slice(0, chapterStarts[0].lineIdx).join('\n').trim();
      if (preamble.length > 50) { // 超过50字才算有实质内容
        chapters.push({ title: '序', content: preamble });
      }
    }

    // 逐章提取
    for (let i = 0; i < chapterStarts.length; i++) {
      const start = chapterStarts[i].lineIdx + 1; // 标题的下一行开始
      const end = i + 1 < chapterStarts.length ? chapterStarts[i + 1].lineIdx : contentLines.length;
      const content = contentLines.slice(start, end).join('\n').trim();

      if (content) {
        chapters.push({
          title: chapterStarts[i].title,
          content
        });
      }
    }
  }

  // 自动分配标签
  const finalTags = autoAssignTags(filePath, meta.tags);

  return {
    title,
    description: meta.description,
    tags: finalTags,
    author: meta.author || undefined,
    year: meta.year || undefined,
    chapters
  };
}

// 递归获取目录下所有 txt 文件
function getTxtFiles(dir: string, recursive: boolean): string[] {
  const files: string[] = [];
  
  if (!fs.existsSync(dir)) {
    return files;
  }
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && recursive) {
      files.push(...getTxtFiles(fullPath, true));
    } else if (entry.isFile() && entry.name.endsWith('.txt')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// 进度条显示
function showProgress(current: number, total: number, filename: string) {
  const barLength = 30;
  const progress = current / total;
  const filled = Math.round(barLength * progress);
  const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
  const percent = Math.round(progress * 100);
  process.stdout.write(`\r[${bar}] ${percent}% (${current}/${total}) ${filename.padEnd(20).slice(0, 20)}`);
}

// 主函数（增强版）
async function main() {
  console.log('📝 TXT -> JSON 转换工具（增强版）\n');
  
  // 显示配置
  console.log('📋 配置:');
  console.log(`   源目录: ${SOURCE_DIR}`);
  console.log(`   输出目录: ${OUTPUT_DIR}`);
  console.log(`   递归扫描: ${RECURSIVE ? '是' : '否'}`);
  console.log(`   强制覆盖: ${FORCE ? '是' : '否'}`);
  console.log('');

  // 确保输出目录存在
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 检查源目录
  if (!fs.existsSync(SOURCE_DIR)) {
    if (SOURCE_DIR === DEFAULT_RAW_DIR) {
      fs.mkdirSync(SOURCE_DIR, { recursive: true });
      console.log(`📁 已创建 raw 目录: ${SOURCE_DIR}`);
      console.log('\n请将 .txt 文件放入该目录后重新运行');
      console.log('或使用 --source 参数指定外部目录:');
      console.log('   npx ts-node scripts/text-to-json.ts --source /path/to/books');
      return;
    } else {
      console.error(`❌ 源目录不存在: ${SOURCE_DIR}`);
      return;
    }
  }

  // 获取要处理的文件
  let txtFiles: string[];

  if (SPECIFIC_FILE) {
    // 指定了具体文件
    const filePath = path.join(SOURCE_DIR, SPECIFIC_FILE);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ 文件不存在: ${filePath}`);
      return;
    }
    txtFiles = [filePath];
  } else {
    // 扫描目录
    txtFiles = getTxtFiles(SOURCE_DIR, RECURSIVE);
  }

  if (txtFiles.length === 0) {
    console.log('⚠️  没有找到 .txt 文件');
    console.log(`   请检查目录: ${SOURCE_DIR}`);
    if (!RECURSIVE) {
      console.log('   提示: 使用 --recursive 参数可扫描子目录');
    }
    return;
  }

  console.log(`📖 找到 ${txtFiles.length} 个 TXT 文件\n`);

  // 统计
  let converted = 0;
  let skipped = 0;
  let failed = 0;
  let totalWords = 0;
  let totalChapters = 0;
  const tagStats: Record<string, number> = {};

  // 处理每个文件
  for (let i = 0; i < txtFiles.length; i++) {
    const file = txtFiles[i];
    const filename = path.basename(file);
    const relativePath = path.relative(SOURCE_DIR, file);
    const outputName = filename.replace(/\.txt$/, '.json');
    const outputPath = path.join(OUTPUT_DIR, outputName);

    // 显示进度
    showProgress(i + 1, txtFiles.length, filename);

    // 检查是否已转换
    if (fs.existsSync(outputPath) && !FORCE) {
      skipped++;
      continue;
    }

    try {
      // 读取文件（自动检测编码）
      const text = readFileWithEncoding(file);
      const result = splitChapters(text, file);

      if (result.chapters.length === 0) {
        failed++;
        continue;
      }

      const words = result.chapters.reduce((sum, c) => sum + c.content.length, 0);

      // 写入 JSON
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');

      converted++;
      totalWords += words;
      totalChapters += result.chapters.length;

      // 统计标签
      if (result.tags) {
        result.tags.split(',').forEach(tag => {
          const t = tag.trim();
          tagStats[t] = (tagStats[t] || 0) + 1;
        });
      }
    } catch (err: any) {
      failed++;
    }
  }

  // 清除进度条
  process.stdout.write('\r' + ' '.repeat(80) + '\r');

  // 输出详细结果
  console.log('\n' + '='.repeat(60));
  console.log('📊 转换完成汇总');
  console.log('='.repeat(60));
  console.log(`   ✅ 成功转换: ${converted} 个文件`);
  console.log(`   ⏭️  已跳过:   ${skipped} 个文件（已存在）`);
  if (failed > 0) console.log(`   ❌ 失败:     ${failed} 个文件`);
  console.log(`   📖 总章节数: ${totalChapters.toLocaleString()}`);
  console.log(`   📝 总字数:   ${totalWords.toLocaleString()}`);

  // 显示标签统计
  if (Object.keys(tagStats).length > 0) {
    console.log('\n📏 标签统计:');
    const sortedTags = Object.entries(tagStats).sort((a, b) => b[1] - a[1]).slice(0, 15);
    sortedTags.forEach(([tag, count]) => {
      console.log(`   ${tag}: ${count}`);
    });
  }

  console.log('='.repeat(60));

  if (converted > 0) {
    console.log('\n💡 下一步: 运行导入脚本将数据写入数据库');
    console.log('   npx ts-node scripts/batch-import-stories.ts --dry-run  # 先预览');
    console.log('   npx ts-node scripts/batch-import-stories.ts            # 正式导入');
  }

  if (skipped > 0 && !FORCE) {
    console.log('\n💡 提示: 使用 --force 参数可强制重新转换已存在的文件');
  }
}

main().catch(err => {
  console.error('\n❌ 脚本执行失败:', err.message || err);
  process.exit(1);
});

