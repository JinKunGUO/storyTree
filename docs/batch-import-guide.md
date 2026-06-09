# StoryTree 批量导入指南

本文档介绍如何使用 StoryTree 的导入工具链将小说/公版书导入系统。

## 目录

- [工具链概览](#工具链概览)
- [快速开始](#快速开始)
- [详细使用方法](#详细使用方法)
  - [步骤一：TXT → JSON（预处理）](#步骤一txt--json预处理)
  - [步骤二：JSON → 数据库](#步骤二json--数据库)
- [JSON 数据格式](#json-数据格式)
- [命令行参数](#命令行参数)
- [元数据提供方式](#元数据提供方式)
- [标签分类体系](#标签分类体系)
- [定时/批量导入方案](#定时批量导入方案)
- [删除已导入的故事](#删除已导入的故事)
- [环境迁移与数据同步](#环境迁移与数据同步)
- [常见问题](#常见问题)

---

## 工具链概览

| 脚本 | 功能 | 位置 |
|------|------|------|
| `fetch-webnovels.ts` | TXT → JSON：分章、打标签、生成 JSON | `api/scripts/fetch-webnovels.ts` |
| `batch-import-stories.ts` | JSON → 数据库：创建故事和章节 | `api/scripts/batch-import-stories.ts` |
| `split-chapters.ts` | 核心分章算法（被上面两个脚本复用） | `api/scripts/split-chapters.ts` |
| `reassign-tags.ts` | 对已有 seed-data 重新分配标签 | `api/scripts/reassign-tags.ts` |
| `resplit-seed-data.ts` | 对已有 seed-data 重新分章 | `api/scripts/resplit-seed-data.ts` |
| `delete-story.ts` | 删除已导入的故事 | `api/scripts/delete-story.ts` |

**完整工作流**：

```
TXT 文件 (.txt)
    ↓  fetch-webnovels.ts（智能分章 + 自动标签 + 生成简介）
JSON 文件 (seed-data/*.json)
    ↓  batch-import-stories.ts（写入数据库 + 创建虚拟作者）
PostgreSQL 数据库
    ↓  API 提供给前端
用户在 web/小程序 看到新书
```

**两个脚本的分工**：

| | `fetch-webnovels.ts` | `batch-import-stories.ts` |
|---|---|---|
| **输入** | `.txt` 文件 | `seed-data/*.json` 文件 |
| **输出** | `seed-data/` 目录下的 JSON | 数据库记录 |
| **依赖** | 无需数据库 | 需要数据库 + admin 用户 |
| **核心能力** | 智能分章、标签推断、编码检测 | 创建虚拟作者、分批写入、断点续传 |

---

## 快速开始

```bash
cd /Users/jinkun/storytree/api

# 1. TXT → JSON（从目录批量导入，递归子目录）
npx ts-node scripts/fetch-webnovels.ts --source local-dir --path /path/to/novels/ --recursive

# 2. 预览导入（不写入数据库）
npx ts-node scripts/batch-import-stories.ts --dry-run

# 3. 正式导入
npx ts-node scripts/batch-import-stories.ts

# 4. 更新用户统计（可选）
npx ts-node scripts/recalculate-user-stats.ts
```

---

## 详细使用方法

### 步骤一：TXT → JSON（预处理）

`fetch-webnovels.ts` 负责将原始 TXT 文件转换为标准 JSON 格式。

#### 单文件导入

```bash
npx ts-node scripts/fetch-webnovels.ts \
  --source local-txt \
  --path ./novels/斗破苍穹.txt \
  --author "天蚕土豆" \
  --tags "玄幻,冒险"
```

#### 批量导入目录

```bash
# 扫描目录下所有 .txt 文件
npx ts-node scripts/fetch-webnovels.ts --source local-dir --path ./novels/

# 递归扫描子目录
npx ts-node scripts/fetch-webnovels.ts --source local-dir --path ./novels/ --recursive

# 预览模式（不写入文件）
npx ts-node scripts/fetch-webnovels.ts --source local-dir --path ./novels/ --dry-run

# 强制覆盖已存在的 JSON
npx ts-node scripts/fetch-webnovels.ts --source local-dir --path ./novels/ --force
```

#### 自动能力

- **智能分章**：三级策略 — 正则章节标记 → 空行分段 → 固定长度切割
- **编码检测**：自动识别 UTF-8 和 GBK 编码
- **标签推断**：13 条关键词规则（武侠/仙侠/玄幻/言情/悬疑等）+ 体裁/受众推断
- **简介生成**：自动提取正文前 200 字作为简介

#### TXT 文件要求

1. **文件名即书名**：`斗破苍穹.txt` → 标题为"斗破苍穹"
2. **编码**：UTF-8 或 GBK（自动检测）
3. **章节标记**（可选）：
   - `第一章 xxx` / `第1回 xxx`
   - `Chapter 1` / `CHAPTER 1`
   - `卷一 xxx` / `【第一章】xxx`
   - 无标记时自动按空行或固定字数切割
4. **内嵌元数据**（可选）：在文件开头添加
   ```
   [作者] 天蚕土豆
   [描述] 一部经典玄幻小说
   [标签] 玄幻,冒险,热血
   
   第一章 陨落的天才
   ...
   ```

### 步骤二：JSON → 数据库

```bash
# 全量导入 seed-data/ 下所有 JSON
npx ts-node scripts/batch-import-stories.ts

# 只导入一本
npx ts-node scripts/batch-import-stories.ts --file 斗破苍穹.json

# 预览模式
npx ts-node scripts/batch-import-stories.ts --dry-run

# 增量更新模式（已存在的故事：删旧章 → 写新章 → 更新标签）
npx ts-node scripts/batch-import-stories.ts --update
```

**特性**：
- **断点续传**：同名故事自动跳过，不会重复导入
- **增量更新**：`--update` 模式下，已存在的故事会被更新（保留故事 ID，用户收藏/关注不丢失）
- **虚拟作者**：JSON 中有 `author_name` 字段时，自动创建不可登录的虚拟用户
- **分批写入**：每 50 章一个事务，避免超时

---

## JSON 数据格式

`fetch-webnovels.ts` 输出的 JSON 格式（也是 `batch-import-stories.ts` 的输入格式）：

```json
{
  "title": "故事标题",
  "description": "故事简介",
  "author_name": "原著作者（可选）",
  "tags": "标签1,标签2,标签3",
  "cover_image": "封面图片URL（可选）",
  "chapters": [
    { "title": "第一章 标题", "content": "正文内容..." },
    { "title": "第二章 标题", "content": "正文内容..." }
  ]
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `title` | ✅ | 故事标题 |
| `description` | ❌ | 故事简介（不填则自动生成） |
| `author_name` | ❌ | 原著作者（会创建虚拟用户） |
| `tags` | ❌ | 标签，逗号分隔（不填则自动推断） |
| `cover_image` | ❌ | 封面图片 URL |
| `chapters` | ✅ | 章节数组 |
| `chapters[].title` | ✅ | 章节标题 |
| `chapters[].content` | ✅ | 章节正文 |

---

## 命令行参数

### fetch-webnovels.ts

| 参数 | 说明 | 示例 |
|------|------|------|
| `--source <type>` | 数据源类型：`local-txt` 或 `local-dir` | `--source local-dir` |
| `--path <path>` | 输入路径（文件或目录） | `--path ./novels/` |
| `--recursive` | 递归扫描子目录 | `--recursive` |
| `--author <name>` | 指定作者 | `--author "天蚕土豆"` |
| `--tags <tags>` | 指定标签（逗号分隔） | `--tags "玄幻,冒险"` |
| `--description <desc>` | 指定简介 | `--description "..."` |
| `--dry-run` | 预览模式，不写入文件 | `--dry-run` |
| `--force` | 强制覆盖已存在的 JSON | `--force` |

### batch-import-stories.ts

| 参数 | 说明 | 示例 |
|------|------|------|
| `--file <path>` | 只导入指定 JSON 文件 | `--file 西游记.json` |
| `--admin-username <name>` | 指定管理员用户名 | `--admin-username admin` |
| `--update` | 增量更新已存在的故事 | `--update` |
| `--dry-run` | 预览模式，不写入数据库 | `--dry-run` |

### delete-story.ts

| 参数 | 说明 | 示例 |
|------|------|------|
| `--id <id>` | 按故事 ID 删除 | `--id 5` |
| `--title <title>` | 按标题删除（模糊匹配） | `--title "西游记"` |
| `--author <username>` | 删除某用户的所有故事 | `--author admin` |
| `--dry-run` | 预览模式 | `--dry-run` |
| `--force` | 确认删除多个故事 | `--force` |

---

## 元数据提供方式

三种方式提供书籍元数据（优先级从高到低）：

### 1. 命令行参数

```bash
npx ts-node scripts/fetch-webnovels.ts --source local-txt \
  --path ./novels/斗破苍穹.txt \
  --author "天蚕土豆" \
  --tags "玄幻,冒险" \
  --description "天才少年萧炎的修炼之路"
```

### 2. 同名 .meta.json 文件

在 TXT 文件同目录下放置同名的 `.meta.json`：

```
novels/
├── 斗破苍穹.txt
└── 斗破苍穹.meta.json
```

`斗破苍穹.meta.json` 内容：
```json
{
  "author_name": "天蚕土豆",
  "tags": "玄幻,冒险,热血",
  "description": "天才少年萧炎的修炼之路"
}
```

### 3. TXT 文件内嵌

在 TXT 文件开头写入元数据行：

```
[作者] 天蚕土豆
[描述] 天才少年萧炎的修炼之路
[标签] 玄幻,冒险,热血

第一章 陨落的天才
...正文...
```

如果三种方式都不提供，脚本会：
- 用文件名作为标题
- 自动推断标签（基于内容关键词）
- 自动生成简介（取正文前 200 字）

---

## 标签分类体系

标签配置文件：`api/config/tag-taxonomy.json`

当前支持 7 个维度：

| 维度 | 说明 | 示例标签 |
|------|------|----------|
| era | 时代 | 先秦、秦汉、明清、近代、当代 |
| genre | 类型 | 武侠、仙侠、玄幻、言情、悬疑推理 |
| form | 体裁 | 长篇小说、短篇小说、散文、诗歌 |
| theme | 题材 | 爱情、冒险、成长、穿越、末世 |
| audience | 受众 | 男频、女频、通用、儿童 |
| source | 来源 | 公版书、原创、网文、经典名著 |
| status | 状态 | 已完结、连载中 |

**添加新标签**：只需编辑 `api/config/tag-taxonomy.json`，前端会自动从 `/api/stories/tags/taxonomy` 获取最新配置。

**重新分配标签**：
```bash
# 对所有 seed-data 重新打标签
npx ts-node scripts/reassign-tags.ts

# 预览模式
npx ts-node scripts/reassign-tags.ts --dry-run
```

---

## 定时/批量导入方案

### 方式 1：手动批量

```bash
cd api
# 把 TXT 放到 novels/ 后一次性处理
npx ts-node scripts/fetch-webnovels.ts --source local-dir --path ./novels/ --recursive
npx ts-node scripts/batch-import-stories.ts
```

### 方式 2：crontab 定时

```bash
# 每天凌晨 3 点检查并导入新书
0 3 * * * cd /path/to/storytree/api && \
  npx ts-node scripts/fetch-webnovels.ts --source local-dir --path ./novels/ --recursive && \
  npx ts-node scripts/batch-import-stories.ts \
  >> /var/log/storytree-import.log 2>&1
```

### 方式 3：监听目录变化

```bash
# macOS 使用 fswatch
fswatch -0 ./novels/ | while read -d "" file; do
  if [[ "$file" == *.txt ]]; then
    npx ts-node scripts/fetch-webnovels.ts --source local-txt --path "$file"
    npx ts-node scripts/batch-import-stories.ts --file "$(basename "$file" .txt).json"
  fi
done
```

---

## 删除已导入的故事

```bash
# 预览
npx ts-node scripts/delete-story.ts --id 5 --dry-run

# 按 ID 删除
npx ts-node scripts/delete-story.ts --id 5

# 按标题删除
npx ts-node scripts/delete-story.ts --title "西游记"

# 批量删除某用户的所有故事（需 --force）
npx ts-node scripts/delete-story.ts --author admin --force
```

⚠️ 删除操作不可逆，务必先用 `--dry-run` 预览。

---

## 环境迁移与数据同步

当 seed-data 中的 JSON 文件更新后（如重新分章、标签增强），需要将改动同步到数据库。以下是不同环境的处理方法。

### 开发环境（SQLite）

开发环境数据不重要，推荐**清空重建**：

```bash
cd api

# 方式 A：重置数据库（最干净）
npx prisma migrate reset --force
npx ts-node scripts/create-admin.ts
npx ts-node scripts/batch-import-stories.ts

# 方式 B：增量更新（保留其他测试数据）
npx ts-node scripts/batch-import-stories.ts --update
```

> 注：`prisma migrate reset` 会删除所有数据并重建表结构，适合开发环境从头来过。

### 生产环境（MySQL / PostgreSQL）

生产环境有用户数据（收藏、关注、评论），必须保留故事 ID。使用 `--update` 模式：

```bash
cd api

# 1. 先预览变更范围（不写入）
npx ts-node scripts/batch-import-stories.ts --update --dry-run

# 2. 正式增量更新
npx ts-node scripts/batch-import-stories.ts --update
```

**`--update` 模式保证**：

| 保留 | 更新 |
|------|------|
| 故事 ID | 章节内容（删旧写新） |
| 用户收藏/关注 | 标签 |
| 用户评论 | 描述/简介 |
| 故事创建时间 | 作者归属 |

**建议在低峰期执行**（如凌晨），471 本书全量更新约需 5-10 分钟。

### 何时需要同步

| 场景 | 操作 |
|------|------|
| 运行了 `resplit-seed-data.ts`（重新分章） | `--update` |
| 运行了 `reassign-tags.ts`（重新打标签） | `--update` |
| 新增了 TXT 文件并转为 JSON | 正常导入（不需要 --update） |
| 修改了 `tag-taxonomy.json` | 无需同步数据库，前端自动获取最新配置 |

---

## 常见问题

### Q1: 导入失败提示"管理员用户不存在"

```bash
npx ts-node scripts/create-admin.ts
```

### Q2: TXT 文件没有被正确分章

分章算法按优先级尝试：
1. 正则匹配章节标记（`第X章`、`Chapter X` 等）
2. 按连续空行分段（段落长度 > 1500 字）
3. 固定字数切割（每 5000-8000 字一章）

如果效果不理想，可以手动在 TXT 中添加明确的章节标记。

### Q3: 中文乱码

脚本自动检测 GBK 编码。如果仍有问题：
```bash
# 手动转换编码
iconv -f GBK -t UTF-8 原文件.txt > 新文件.txt
```

### Q4: 重复导入会怎样

- `fetch-webnovels.ts`：已存在同名 JSON 时跳过（除非 `--force`）
- `batch-import-stories.ts`：已存在同名故事时跳过（断点续传）
- `batch-import-stories.ts --update`：已存在的故事会被更新（删旧章→写新章→更新标签），故事 ID 不变

### Q5: 如何只重新处理某本书

```bash
# 重新生成 JSON（覆盖）
npx ts-node scripts/fetch-webnovels.ts --source local-txt --path ./novels/西游记.txt --force

# 先删除数据库中的旧数据
npx ts-node scripts/delete-story.ts --title "西游记"

# 重新导入
npx ts-node scripts/batch-import-stories.ts --file 西游记.json
```

### Q6: 标签推断不准确

可以通过以下方式覆盖：
1. 命令行指定 `--tags "正确标签"`
2. 创建 `.meta.json` 文件
3. 在 TXT 开头添加 `[标签] 正确标签`
4. 导入后运行 `reassign-tags.ts` 重新分配

---

## 相关文件

| 文件 | 说明 |
|------|------|
| `api/scripts/fetch-webnovels.ts` | TXT → JSON 导入工具（统一入口） |
| `api/scripts/split-chapters.ts` | 智能分章算法 |
| `api/scripts/batch-import-stories.ts` | JSON → 数据库导入工具 |
| `api/scripts/reassign-tags.ts` | 标签重新分配工具 |
| `api/scripts/resplit-seed-data.ts` | 章节重新分割工具 |
| `api/scripts/delete-story.ts` | 删除故事工具 |
| `api/scripts/create-admin.ts` | 创建管理员用户 |
| `api/scripts/recalculate-user-stats.ts` | 重新计算用户统计 |
| `api/config/tag-taxonomy.json` | 标签分类配置（可维护） |
| `api/scripts/seed-data/` | JSON 数据文件目录 |
