# 📦 StoryTree 版本管理指南

## 快速开始

### 1. 初始化Git仓库

在**项目根目录**运行：

```bash
cd /Users/jinkun/storytree
bash scripts/setup-git.sh
```

这个脚本会：
- 初始化Git仓库
- 配置Git hooks（自动版本更新）
- 创建.gitignore文件
- 安装依赖

### 2. 查看当前版本

```bash
node scripts/version-manager.js
```

输出示例：
```
╔════════════════════════════════════════╗
║        📦 StoryTree Version Info       ║
╠════════════════════════════════════════╣
║  Name:       storytree                 ║
║  Version:    1.0.0                     ║
║  Codename:   M1-Seed                   ║
║  Stage:      MVP                       ║
║  Branch:     main                      ║
║  Commit:     a1b2c3d                   ║
║  Features:   5 items                   ║
║  Build Date: 2025-02-10T00:00:00.000Z  ║
╚════════════════════════════════════════╝
```

### 3. 版本号规则

采用 **语义化版本** (SemVer):

```
版本格式：主版本号.次版本号.修订号
示例：1.0.0
```

- **主版本号 (Major)**: 重大功能变更、架构重构
- **次版本号 (Minor)**: 新功能添加 (如M1→M2)
- **修订号 (Patch)**: bug修复、小优化

### 4. 更新版本

#### 手动更新

```bash
# 增加修订号
node scripts/version-manager.js patch

# 增加次版本号 (例如完成M2时)
node scripts/version-manager.js minor

# 增加主版本号 (重大发布)
node scripts/version-manager.js major

# 设置开发阶段
node scripts/version-manager.js stage M2

# 添加变更日志
node scripts/version-manager.js changelog "添加用户认证功能"
```

#### 自动更新 (Git Hooks)

配置好Git hooks后，**每次提交会自动**：
1. 增加patch版本号
2. 更新commit hash
3. 记录分支名
4. 更新构建时间

```bash
git add .
git commit -m "feat: add user authentication"
# 版本自动从 1.0.0 → 1.0.1
```

## 版本与里程碑对应

| 版本 | 代号 | 阶段 | 主要功能 |
|------|------|------|----------|
| 1.0.x | M1-Seed | MVP | 故事创建、AI续写、分支系统、评分 |
| 1.1.x | M2-Sprout | Alpha | 审核系统、用户关注、图片支持 |
| 1.2.x | M3-Sapling | Beta | 微信小程序、高级推荐算法 |
| 2.0.x | M4-Tree | Stable | 完整平台、视频支持、商业化 |

## 提交规范

使用 **Conventional Commits** 格式：

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

Type说明：
- `feat`: 新功能
- `fix`: 修复
- `docs`: 文档
- `style`: 格式调整
- `refactor`: 重构
- `test`: 测试
- `chore`: 构建/工具

示例：
```bash
git commit -m "feat(ai): upgrade to Claude 3.5"
git commit -m "fix(api): correct node rating calculation"
git commit -m "docs: update API documentation"
```

## Git Workflow

### 分支策略

```
main        (生产分支)
  │
  ├── develop    (开发分支)
  │      │
  │      ├── feature/xxx
  │      ├── bugfix/xxx
  │      └── hotfix/xxx
  │
  └── release/v1.1.0
```

### 推荐工作流

```bash
# 1. 创建功能分支
git checkout -b feature/ai-optimization

# 2. 开发并提交
git add .
git commit -m "feat(ai): improve prompt engineering"

# 3. 合并到develop
git checkout develop
git merge feature/ai-optimization

# 4. 发布版本
git checkout main
git merge develop
node scripts/version-manager.js minor
git add VERSION.json
git commit -m "chore: bump version to 1.1.0"
git tag v1.1.0
git push origin main --tags
```

## 文件说明

| 文件 | 用途 |
|------|------|
| `VERSION.json` | 版本信息存储（项目根目录） |
| `scripts/version-manager.js` | 版本管理CLI工具 |
| `scripts/setup-git.sh` | Git初始化脚本 |
| `.githooks/pre-commit` | 提交前自动更新版本 |
| `.githooks/post-commit` | 提交后更新git信息 |

## 版本API

后端提供版本查询接口：

```bash
curl http://localhost:3001/api/version
```

返回：
```json
{
  "version": "1.0.0",
  "codename": "M1-Seed",
  "stage": "MVP"
}
```

## 故障排除

### Git hooks 未触发

```bash
cd /Users/jinkun/storytree
git config core.hooksPath .githooks
chmod +x .githooks/*
```

### 版本号未更新

```bash
# 手动运行
node scripts/version-manager.js update
```

### 查看帮助

```bash
node scripts/version-manager.js --help
```
