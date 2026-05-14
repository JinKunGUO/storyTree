# 修复默认封面路径问题

## 问题描述

数据库中存储的默认封面路径是 `/assets/default-cover.svg`，但实际文件是 `default-cover.jpg`，导致 Web 端封面显示为破损图片。

## 问题原因

早期代码中使用了错误的默认封面路径（`.svg` 而非 `.jpg`），导致旧数据的 `cover_image` 字段存储了错误的路径。

## 解决方案

### 方案一：通过管理 API 修复（推荐）

如果已部署了包含管理端点的代码版本：

```bash
# SSH 登录服务器
ssh root@120.26.182.140

# 执行 API 调用（需要管理员 token）
curl -X POST https://api.storytree.online/api/stories/admin/fix-cover-path \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

期望返回：
```json
{
  "success": true,
  "message": "已更新 X 个故事的封面路径",
  "updated": X,
  "from": "/assets/default-cover.svg",
  "to": "/assets/default-cover.jpg"
}
```

### 方案二：直接执行 SQL（需要数据库访问权限）

```bash
# SSH 登录服务器
ssh root@120.26.182.140

# 连接到阿里云 RDS MySQL（使用正确的数据库地址）
mysql -h rm-cn-4l64purrx00022.rwlb.rds.aliyuncs.com \
  -u storytree \
  -p'StoryTree0429' \
  storytree \
  -e "UPDATE stories SET cover_image = '/assets/default-cover.jpg' WHERE cover_image = '/assets/default-cover.svg';"
```

### 方案三：使用 Node.js 脚本修复（推荐）

```bash
# SSH 登录服务器
ssh root@120.26.182.140

# 进入 API 目录
cd /var/www/storytree/api

# 确保代码是最新的（获取修复脚本）
git pull origin main

# 运行修复脚本（JavaScript 版本，不需要 ts-node）
node scripts/fix-cover.js
```

## 验证修复结果

```bash
# 检查 API 返回
curl https://api.storytree.online/api/stories/1 | jq '.story.cover_image'

# 期望输出："/assets/default-cover.jpg"
```

或者访问 Web 端查看：
- https://storytree.online/story.html?id=1

## 预防措施

1. **代码层面**：确保 `stories.ts` 中创建故事时的默认封面路径正确
2. **数据库层面**：添加 CHECK 约束或使用枚举类型限制 `cover_image` 字段
3. **部署层面**：在部署脚本中加入数据校验步骤

## 相关文件

- 后端路由：`api/src/routes/stories.ts`
- 修复脚本：`api/scripts/fix-default-cover-path.ts`
- SQL 脚本：`api/scripts/fix-cover-path.sql`
- 部署脚本：`scripts/deploy.sh`