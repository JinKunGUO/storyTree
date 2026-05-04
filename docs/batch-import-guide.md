# StoryTree 批量导入公版书指南

本文档详细介绍如何使用 StoryTree 的批量导入工具将公版小说/文章导入系统。

## 目录

- [概述](#概述)
- [工具链说明](#工具链说明)
- [快速开始](#快速开始)
- [详细使用方法](#详细使用方法)
  - [步骤一：准备 TXT 文件](#步骤一准备-txt-文件)
  - [步骤二：TXT 转 JSON](#步骤二txt-转-json)
  - [步骤三：导入数据库](#步骤三导入数据库)
- [JSON 数据格式](#json-数据格式)
- [章节识别规则](#章节识别规则)
- [自动标签分配](#自动标签分配)
- [命令行参数](#命令行参数)
- [删除已导入的故事](#删除已导入的故事)
- [常见问题](#常见问题)

---

## 概述

StoryTree 提供了三个脚本用于管理公版书：

| 脚本 | 功能 | 位置 |
|------|------|------|
| `text-to-json.ts` | 将 TXT 文本按章节分割，转换为 JSON 格式 | `api/scripts/text-to-json.ts` |
| `batch-import-stories.ts` | 将 JSON 数据批量导入数据库 | `api/scripts/batch-import-stories.ts` |
| `delete-story.ts` | 删除已导入的故事 | `api/scripts/delete-story.ts` |

**工作流程**：

```
TXT 文件 → [text-to-json.ts] → JSON 文件 → [batch-import-stories.ts] → 数据库
                                                                          ↓
                                              [delete-story.ts] ← 如需删除
```

### 新增功能（v2.0）

- ✅ **支持外部目录直接导入**：无需复制文件，直接指定源目录
- ✅ **递归扫描子目录**：支持 `--recursive` 参数
- ✅ **自动标签分配**：根据文件名/目录名自动分配标签（四大名著、先秦、秦汉等）
- ✅ **进度条显示**：大批量处理时显示进度
- ✅ **更多章节格式**：支持【第一章】、(一)、卷一 等格式
- ✅ **删除故事脚本**：支持按 ID、标题、作者删除

---

## 工具链说明

### 1. text-to-json.ts（TXT 转 JSON）

**功能**：
- 自动识别章节标题（支持多种格式）
- 提取文件前几行的元数据（描述、标签）
- 将纯文本分割为结构化的 JSON

**代码位置**：`api/scripts/text-to-json.ts`

### 2. batch-import-stories.ts（批量导入）

**功能**：
- 读取 JSON 文件，创建故事和章节
- 支持断点续传（跳过已存在的故事）
- 支持 dry-run 模式预览
- 自动设置审核状态为 `APPROVED`

**代码位置**：`api/scripts/batch-import-stories.ts`

---

## 快速开始

假设你的公版书存放在 `/Users/jinkun/shu/books` 目录下。

### 方法一：直接从外部目录导入（推荐）

```bash
cd /Users/jinkun/storytree/api

# 1. TXT 转 JSON（直接指定源目录，递归扫描子目录）
npx ts-node scripts/text-to-json.ts --source /Users/jinkun/shu/books --recursive

# 2. 预览导入（不写入数据库）
npx ts-node scripts/batch-import-stories.ts --dry-run

# 3. 正式导入
npx ts-node scripts/batch-import-stories.ts
```

### 方法二：复制文件到 raw 目录

```bash
# 1. 将 TXT 文件复制到 raw 目录
cp /Users/jinkun/shu/books/*.txt /Users/jinkun/storytree/api/scripts/seed-data/raw/

# 2. 进入 api 目录
cd /Users/jinkun/storytree/api

# 3. TXT 转 JSON
npx ts-node scripts/text-to-json.ts

# 4. 预览导入（不写入数据库）
npx ts-node scripts/batch-import-stories.ts --dry-run

# 5. 正式导入
npx ts-node scripts/batch-import-stories.ts
```

### 方法三：直接准备 JSON 文件

如果你已经有结构化的 JSON 数据，可以跳过转换步骤：

```bash
# 1. 将 JSON 文件放入 seed-data 目录
cp your-book.json /Users/jinkun/storytree/api/scripts/seed-data/

# 2. 导入
cd /Users/jinkun/storytree/api
npx ts-node scripts/batch-import-stories.ts
```

---

## 详细使用方法

### 步骤一：准备 TXT 文件

#### 文件存放位置

将 TXT 文件放入：`api/scripts/seed-data/raw/`

```bash
# 创建 raw 目录（如果不存在）
mkdir -p /Users/jinkun/storytree/api/scripts/seed-data/raw

# 从公版书目录复制
cp /Users/jinkun/shu/books/西游记.txt /Users/jinkun/storytree/api/scripts/seed-data/raw/
cp /Users/jinkun/shu/books/三国演义.txt /Users/jinkun/storytree/api/scripts/seed-data/raw/
```

#### 文件命名规则

**文件名即故事标题**，例如：
- `西游记.txt` → 故事标题为"西游记"
- `三国演义.txt` → 故事标题为"三国演义"

#### TXT 文件格式要求

1. **编码**：UTF-8（必须）
2. **章节标题**：独占一行
3. **元数据**（可选）：在文件开头添加描述和标签

**示例 TXT 文件**：

```
[描述] 中国古典四大名著之一，描写唐僧师徒西天取经的故事。
[标签] 古典文学,神话,冒险,四大名著

第一回 灵根育孕源流出 心性修持大道生

诗曰：
混沌未分天地乱，茫茫渺渺无人见。
自从盘古破鸿蒙，开辟从兹清浊辨。
......（正文内容）

第二回 悟彻菩提真妙理 断魔归本合元神

......（正文内容）
```

### 步骤二：TXT 转 JSON

```bash
cd /Users/jinkun/storytree/api

# 转换所有 raw 目录下的 TXT 文件
npx ts-node scripts/text-to-json.ts

# 或只转换指定文件
npx ts-node scripts/text-to-json.ts 西游记.txt
```

**输出示例**：

```
📝 TXT -> JSON 转换工具

📖 找到 2 个 TXT 文件:

📥 处理: 西游记.txt
  ✅ -> 西游记.json
     100 章, 856,432 字
     描述: 中国古典四大名著之一...
     标签: 古典文学,神话,冒险,四大名著

📥 处理: 三国演义.txt
  ✅ -> 三国演义.json
     120 章, 732,156 字

==================================================
📊 转换完成: 2 个成功, 0 个跳过
==================================================
```

**生成的 JSON 文件位置**：`api/scripts/seed-data/`

### 步骤三：导入数据库

```bash
cd /Users/jinkun/storytree/api

# 1. 先预览（推荐）
npx ts-node scripts/batch-import-stories.ts --dry-run

# 2. 正式导入
npx ts-node scripts/batch-import-stories.ts

# 3. 更新用户统计（可选）
npx ts-node scripts/recalculate-user-stats.ts
```

**输出示例**：

```
📚 StoryTree 批量导入工具

✅ 管理员用户: admin (ID: 1)

📖 找到 2 个数据文件:

   - 西游记.json
   - 三国演义.json

📥 导入: 西游记.json
  📖 "西游记" - 100 章
  ✅ 导入成功 (ID: 5, 100 章, 856,432 字)

📥 导入: 三国演义.json
  📖 "三国演义" - 120 章
  ✅ 导入成功 (ID: 6, 120 章, 732,156 字)

==================================================
📊 导入完成汇总:
   成功导入: 2 部故事
   总章节数: 220
   总字数:   1,588,588
==================================================
```

---

## JSON 数据格式

如果你想手动创建或编辑 JSON 文件，格式如下：

```json
{
  "title": "故事标题",
  "description": "故事简介（可选）",
  "tags": "标签1,标签2,标签3（可选）",
  "cover_image": "封面图片URL（可选）",
  "chapters": [
    {
      "title": "第一回 章节标题",
      "content": "章节正文内容..."
    },
    {
      "title": "第二回 章节标题",
      "content": "章节正文内容..."
    }
  ]
}
```

**字段说明**：

| 字段 | 必填 | 说明 |
|------|------|------|
| `title` | ✅ | 故事标题 |
| `description` | ❌ | 故事简介 |
| `tags` | ❌ | 标签，逗号分隔 |
| `cover_image` | ❌ | 封面图片 URL |
| `chapters` | ✅ | 章节数组 |
| `chapters[].title` | ✅ | 章节标题（为空时自动生成"第 N 章"） |
| `chapters[].content` | ✅ | 章节正文 |

**示例**：参考 `api/scripts/seed-data/伊索寓言精选.json`

---

## 章节识别规则

`text-to-json.ts` 支持以下章节标题格式：

| 格式 | 示例 |
|------|------|
| 中文"回" | 第一回 xxx、第二回 xxx |
| 中文"章" | 第一章 xxx、第二章 xxx |
| 中文"篇" | 第一篇 xxx、第二篇 xxx |
| 中文"节" | 第一节 xxx、第二节 xxx |
| 中文"卷" | 第一卷 xxx、第二卷 xxx |
| 阿拉伯数字 | 第1回 xxx、第2章 xxx |
| 英文 | Chapter 1、CHAPTER 2 |
| 序号 | 一、xxx、二、xxx、1、xxx |
| 【】格式 | 【第一章】xxx |
| 括号格式 | (一) xxx、（一）xxx |
| 卷格式 | 卷一 xxx、上卷 xxx、中卷 xxx |
| Part 格式 | Part 1、PART ONE |

**代码位置**：`api/scripts/text-to-json.ts:76-95`

---

## 自动标签分配

脚本会根据文件名和目录名自动分配标签，无需手动添加。

### 支持的标签映射

#### 朝代分类（根据目录名）

| 目录名 | 自动分配的标签 |
|--------|----------------|
| 先秦 | 先秦,古典文学,哲学 |
| 秦汉 | 秦汉,古典文学,历史 |
| 魏晋 | 魏晋,古典文学,历史 |
| 隋唐 | 隋唐,古典文学,历史 |
| 宋元 | 宋元,古典文学,历史 |
| 明清 | 明清,古典文学,历史 |
| 近代 | 近代,文学 |

#### 经典著作（根据文件名）

| 文件名 | 自动分配的标签 |
|--------|----------------|
| 论语 | 儒家,经典,哲学,先秦 |
| 道德经 | 道家,经典,哲学,先秦 |
| 庄子 | 道家,经典,哲学,先秦 |
| 孙子兵法 | 兵法,经典,军事,先秦 |
| 史记 | 历史,经典,秦汉 |
| 三国演义 | 四大名著,古典文学,历史演义,明清 |
| 水浒传 | 四大名著,古典文学,侠义小说,明清 |
| 西游记 | 四大名著,古典文学,神魔小说,明清 |
| 红楼梦 | 四大名著,古典文学,言情小说,明清 |
| 本草纲目 | 医学,科技,明清 |
| 天工开物 | 科技,工艺,明清 |

### 示例

```
/Users/jinkun/shu/books/
├── 先秦/
│   ├── 论语.txt      → 标签: 儒家,经典,哲学,先秦,古典文学
│   └── 道德经.txt    → 标签: 道家,经典,哲学,先秦,古典文学
├── 秦汉/
│   └── 史记.txt      → 标签: 历史,经典,秦汉,古典文学
└── 三国演义.txt      → 标签: 四大名著,古典文学,历史演义,明清
```

### 自定义标签

如果需要自定义标签，可以在 TXT 文件开头添加：

```
[标签] 自定义标签1,自定义标签2
```

自定义标签会与自动分配的标签合并。

---

## 命令行参数

### text-to-json.ts

| 参数 | 说明 | 示例 |
|------|------|------|
| `--source <path>` | 指定源目录（默认为 raw 目录） | `--source /Users/jinkun/shu/books` |
| `--recursive` | 递归扫描子目录 | `--recursive` |
| `--force` | 强制覆盖已存在的 JSON 文件 | `--force` |
| `<filename>` | 只转换指定文件 | `西游记.txt` |

**示例**：

```bash
# 从外部目录导入，递归扫描子目录
npx ts-node scripts/text-to-json.ts --source /Users/jinkun/shu/books --recursive

# 强制重新转换所有文件
npx ts-node scripts/text-to-json.ts --source /Users/jinkun/shu/books --recursive --force

# 只转换指定文件
npx ts-node scripts/text-to-json.ts 西游记.txt
```

### batch-import-stories.ts

| 参数 | 说明 | 示例 |
|------|------|------|
| `--file <path>` | 只导入指定 JSON 文件 | `--file seed-data/西游记.json` |
| `--admin-username <name>` | 指定作者（管理员用户名） | `--admin-username admin` |
| `--dry-run` | 预览模式，不写入数据库 | `--dry-run` |

**示例**：

```bash
# 只导入一本书
npx ts-node scripts/batch-import-stories.ts --file seed-data/西游记.json

# 使用指定管理员账号
npx ts-node scripts/batch-import-stories.ts --admin-username guojinkun1

# 预览模式
npx ts-node scripts/batch-import-stories.ts --dry-run
```

### delete-story.ts

| 参数 | 说明 | 示例 |
|------|------|------|
| `--id <id>` | 按故事 ID 删除 | `--id 5` |
| `--title <title>` | 按标题删除（模糊匹配） | `--title "西游记"` |
| `--author <username>` | 删除某用户的所有故事 | `--author admin` |
| `--dry-run` | 预览模式，不实际删除 | `--dry-run` |
| `--force` | 确认删除多个故事 | `--force` |

**示例**：

```bash
# 预览要删除的故事
npx ts-node scripts/delete-story.ts --id 5 --dry-run

# 按 ID 删除
npx ts-node scripts/delete-story.ts --id 5

# 按标题删除
npx ts-node scripts/delete-story.ts --title "西游记"

# 删除某用户的所有故事（需要 --force）
npx ts-node scripts/delete-story.ts --author admin --force
```

---

## 删除已导入的故事

如果导入有误，可以使用 `delete-story.ts` 脚本删除故事。

### 删除单个故事

```bash
cd /Users/jinkun/storytree/api

# 1. 先预览（推荐）
npx ts-node scripts/delete-story.ts --id 5 --dry-run

# 2. 确认后删除
npx ts-node scripts/delete-story.ts --id 5
```

### 按标题删除

```bash
# 模糊匹配标题
npx ts-node scripts/delete-story.ts --title "西游记" --dry-run
npx ts-node scripts/delete-story.ts --title "西游记"
```

### 批量删除某用户的故事

```bash
# 删除 admin 用户的所有故事（危险操作，需要 --force）
npx ts-node scripts/delete-story.ts --author admin --dry-run
npx ts-node scripts/delete-story.ts --author admin --force
```

### 注意事项

- ⚠️ **删除操作不可逆**，请务必先使用 `--dry-run` 预览
- ⚠️ 删除故事会同时删除所有章节（nodes）、评论、书签等关联数据
- ⚠️ 删除多个故事时必须添加 `--force` 参数确认

---

## 常见问题

### Q1: 导入失败提示"管理员用户不存在"

**原因**：需要先创建管理员用户

**解决**：
```bash
npx ts-node scripts/create-admin.ts
```

### Q2: TXT 文件没有被正确分章

**原因**：章节标题格式不在支持列表中

**解决**：
1. 检查 TXT 文件的章节标题格式
2. 确保章节标题独占一行
3. 如有特殊格式，可修改 `text-to-json.ts` 中的 `CHAPTER_PATTERNS`

### Q3: 中文乱码

**原因**：TXT 文件编码不是 UTF-8

**解决**：
```bash
# macOS 转换编码
iconv -f GBK -t UTF-8 原文件.txt > 新文件.txt
```

### Q4: 导入后故事作者不对

**原因**：默认使用 `admin` 用户作为作者

**解决**：
```bash
npx ts-node scripts/batch-import-stories.ts --admin-username 你的用户名
```

### Q5: 重复导入会怎样

**答**：脚本会自动跳过已存在的同名故事（断点续传功能）

### Q6: 如何删除导入错误的故事

**答**：使用 `delete-story.ts` 脚本：
```bash
npx ts-node scripts/delete-story.ts --id 5 --dry-run  # 先预览
npx ts-node scripts/delete-story.ts --id 5            # 确认删除
```

---

## 完整工作流示例

以导入 `/Users/jinkun/shu/books` 目录下的公版书为例：

```bash
# 1. 进入 api 目录
cd /Users/jinkun/storytree/api

# 2. TXT 转 JSON（直接从外部目录，递归扫描）
npx ts-node scripts/text-to-json.ts --source /Users/jinkun/shu/books --recursive

# 3. 预览导入
npx ts-node scripts/batch-import-stories.ts --dry-run

# 4. 正式导入
npx ts-node scripts/batch-import-stories.ts

# 5. 更新用户统计（可选）
npx ts-node scripts/recalculate-user-stats.ts

# 6. 如果需要删除某个故事
npx ts-node scripts/delete-story.ts --title "西游记" --dry-run
npx ts-node scripts/delete-story.ts --title "西游记"
```

---

## 相关文件

| 文件 | 说明 |
|------|------|
| `api/scripts/text-to-json.ts` | TXT 转 JSON 工具（增强版） |
| `api/scripts/batch-import-stories.ts` | 批量导入工具 |
| `api/scripts/delete-story.ts` | 删除故事工具 |
| `api/scripts/seed-data/` | JSON 数据文件目录 |
| `api/scripts/seed-data/raw/` | TXT 源文件目录 |
| `api/scripts/seed-data/伊索寓言精选.json` | 示例数据文件 |
| `api/scripts/create-admin.ts` | 创建管理员用户 |
| `api/scripts/recalculate-user-stats.ts` | 重新计算用户统计 |

