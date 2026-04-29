import * as fs from 'fs';
import * as path from 'path';

/**
 * TXT 文本 -> JSON 转换工具
 * 
 * 将纯文本小说/故事自动按章节分割，生成 batch-import-stories.ts 所需的 JSON 格式。
 * 
 * ===== 使用方法 =====
 * 
 * 第一步：把 .txt 文件放到 api/scripts/seed-data/raw/ 目录
 *         文件名就是故事标题，例如: 西游记.txt、三国演义.txt
 * 
 * 第二步：运行转换
 *   cd api
 *   npx ts-node scripts/text-to-json.ts                    # 转换 raw/ 下所有 txt
 *   npx ts-node scripts/text-to-json.ts 西游记.txt          # 只转换指定文件
 * 
 * 第三步：导入数据库
 *   npx ts-node scripts/batch-import-stories.ts
 * 
 * ===== TXT 文件格式要求 =====
 * 
 * 1. 纯文本，UTF-8 编码
 * 2. 章节标题独占一行，支持以下格式（自动识别）：
 *    - "第一回 xxx" / "第二回 xxx"（中文数字）
 *    - "第1回 xxx" / "第2回 xxx"（阿拉伯数字）
 *    - "第一章 xxx" / "第1章 xxx"
 *    - "第一篇 xxx" / "第1篇 xxx"
 *    - "第一节 xxx" / "第1节 xxx"
 *    - "第一卷 xxx" / "第1卷 xxx"
 *    - "Chapter 1" / "CHAPTER 1"（英文章节）
 * 3. 可选：文件前几行如果包含 [描述] 和 [标签]，会自动提取：
 *    [描述] 这是一部经典小说...
 *    [标签] 古典文学,神话,冒险
 * 
 * ===== 示例 TXT 文件 =====
 * 
 * --- 西游记.txt ---
 * [描述] 中国古典四大名著之一，描写唐僧师徒西天取经的故事。
 * [标签] 古典文学,神话,冒险,四大名著
 * 
 * 第一回 灵根育孕源流出 心性修持大道生
 * 
 * 诗曰：
 * 混沌未分天地乱，茫茫渺渺无人见。
 * ......（正文内容）
 * 
 * 第二回 悟彻菩提真妙理 断魔归本合元神
 * 
 * ......（正文内容）
 * --- 文件结束 ---
 */

const RAW_DIR = path.join(__dirname, 'seed-data', 'raw');
const OUTPUT_DIR = path.join(__dirname, 'seed-data');

// 章节标题正则（支持中文数字和阿拉伯数字）
const CHAPTER_PATTERNS = [
  // 中文格式：第X回/章/篇/节/卷 + 标题
  /^第[零一二三四五六七八九十百千万\d]+[回章篇节卷]\s*.*/,
  // 英文格式：Chapter X / CHAPTER X
  /^[Cc][Hh][Aa][Pp][Tt][Ee][Rr]\s+\d+/,
  // 数字序号格式：1. xxx / 1、xxx / 一、xxx
  /^[零一二三四五六七八九十百千万]+[、．.]\s*.+/,
];

// 元数据提取
function extractMeta(lines: string[]): { description: string; tags: string; contentStartIdx: number } {
  let description = '';
  let tags = '';
  let contentStartIdx = 0;

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i].trim();
    if (line.startsWith('[描述]') || line.startsWith('[简介]')) {
      description = line.replace(/^\[(?:描述|简介)\]\s*/, '');
      contentStartIdx = i + 1;
    } else if (line.startsWith('[标签]') || line.startsWith('[分类]')) {
      tags = line.replace(/^\[(?:标签|分类)\]\s*/, '');
      contentStartIdx = i + 1;
    } else if (line === '' && contentStartIdx > 0) {
      contentStartIdx = i + 1;
    } else if (line !== '') {
      break;
    }
  }

  return { description, tags, contentStartIdx };
}

// 判断一行是否是章节标题
function isChapterTitle(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 100) return false; // 标题不应超过100字
  return CHAPTER_PATTERNS.some(pattern => pattern.test(trimmed));
}

// 分割章节
function splitChapters(text: string, filename: string): { title: string; description: string; tags: string; chapters: { title: string; content: string }[] } {
  const lines = text.split(/\r?\n/);
  const title = path.basename(filename, path.extname(filename));

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

  return {
    title,
    description: meta.description,
    tags: meta.tags,
    chapters
  };
}

// 主函数
async function main() {
  console.log('📝 TXT -> JSON 转换工具\n');

  // 确保 raw 目录存在
  if (!fs.existsSync(RAW_DIR)) {
    fs.mkdirSync(RAW_DIR, { recursive: true });
    console.log(`📁 已创建 raw 目录: ${RAW_DIR}`);
    console.log('\n请将 .txt 文件放入该目录后重新运行');
    console.log('文件名即故事标题，例如: 西游记.txt');
    return;
  }

  // 获取要处理的文件
  const specificFile = process.argv[2];
  let txtFiles: string[];

  if (specificFile) {
    const filePath = path.join(RAW_DIR, specificFile);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ 文件不存在: ${filePath}`);
      return;
    }
    txtFiles = [filePath];
  } else {
    txtFiles = fs.readdirSync(RAW_DIR)
      .filter(f => f.endsWith('.txt'))
      .map(f => path.join(RAW_DIR, f));
  }

  if (txtFiles.length === 0) {
    console.log('⚠️  raw 目录下没有 .txt 文件');
    console.log(`   请将文件放入: ${RAW_DIR}`);
    return;
  }

  console.log(`📖 找到 ${txtFiles.length} 个 TXT 文件:\n`);

  let converted = 0;
  let skipped = 0;

  for (const file of txtFiles) {
    const filename = path.basename(file);
    const outputName = filename.replace(/\.txt$/, '.json');
    const outputPath = path.join(OUTPUT_DIR, outputName);

    console.log(`📥 处理: ${filename}`);

    // 检查是否已转换
    if (fs.existsSync(outputPath)) {
      console.log(`  ⏭️  已存在 ${outputName}，跳过（删除 JSON 文件可重新转换）`);
      skipped++;
      continue;
    }

    try {
      const text = fs.readFileSync(file, 'utf-8');
      const result = splitChapters(text, filename);

      if (result.chapters.length === 0) {
        console.log(`  ⚠️  没有提取到任何章节内容，跳过`);
        continue;
      }

      const totalWords = result.chapters.reduce((sum, c) => sum + c.content.length, 0);

      // 写入 JSON
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');

      console.log(`  ✅ -> ${outputName}`);
      console.log(`     ${result.chapters.length} 章, ${totalWords.toLocaleString()} 字`);
      if (result.description) console.log(`     描述: ${result.description.slice(0, 50)}...`);
      if (result.tags) console.log(`     标签: ${result.tags}`);
      converted++;
    } catch (err: any) {
      console.log(`  ❌ 转换失败: ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 转换完成: ${converted} 个成功, ${skipped} 个跳过`);
  console.log('='.repeat(50));

  if (converted > 0) {
    console.log('\n💡 下一步: 运行导入脚本将数据写入数据库');
    console.log('   npx ts-node scripts/batch-import-stories.ts --dry-run  # 先预览');
    console.log('   npx ts-node scripts/batch-import-stories.ts            # 正式导入');
  }
}

main().catch(err => {
  console.error('❌ 脚本执行失败:', err.message || err);
  process.exit(1);
});

