# Git 工作流程

本文档描述 StoryTree 项目的 Git 工作流程和分支管理策略。

## 📋 分支策略

### 主要分支

- **main**: 生产分支，始终保持稳定可发布状态
- **develop**: 开发分支，用于日常开发集成（可选）

### 功能分支

使用功能分支进行新功能开发：

```bash
# 从 main 创建功能分支
git checkout main
git pull origin main
git checkout -b feature/your-feature-name

# 开发完成后合并回 main
git checkout main
git merge feature/your-feature-name
git push origin main
```

### 分支命名规范

- `feature/xxx` - 新功能开发
- `fix/xxx` - Bug修复
- `hotfix/xxx` - 紧急修复
- `refactor/xxx` - 代码重构
- `docs/xxx` - 文档更新
- `test/xxx` - 测试相关

**示例：**
```
feature/m2-basic-features
feature/user-authentication
fix/search-bug
hotfix/security-patch
refactor/api-structure
docs/api-documentation
```

## 🔄 工作流程

### 1. 开始新功能

```bash
# 更新本地 main 分支
git checkout main
git pull origin main

# 创建功能分支
git checkout -b feature/new-feature

# 查看当前分支
git branch
```

### 2. 开发过程

```bash
# 查看修改状态
git status

# 添加文件到暂存区
git add <file>
# 或添加所有修改
git add .

# 提交更改（遵循 Commit 规范）
git commit -m "feat: add new feature"

# 推送到远程
git push origin feature/new-feature
```

### 3. 保持分支更新

```bash
# 从 main 拉取最新更改
git checkout main
git pull origin main

# 切回功能分支
git checkout feature/new-feature

# 合并 main 的更新
git merge main
# 或使用 rebase（推荐）
git rebase main
```

### 4. 完成功能

```bash
# 确保所有更改已提交
git status

# 切换到 main 分支
git checkout main

# 合并功能分支
git merge feature/new-feature

# 推送到远程
git push origin main

# 删除本地功能分支
git branch -d feature/new-feature

# 删除远程功能分支
git push origin --delete feature/new-feature
```

## 📝 Commit 规范

### Commit Message 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 类型

- `feat`: 新功能
- `fix`: Bug修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试
- `chore`: 构建/工具
- `revert`: 回退

### 示例

```bash
# 简单提交
git commit -m "feat: 添加用户登录功能"

# 详细提交
git commit -m "feat(auth): 添加用户登录功能

- 实现用户名密码登录
- 添加JWT令牌生成
- 更新API文档

Closes #123"
```

## 🔍 常用命令

### 查看状态

```bash
# 查看工作区状态
git status

# 查看提交历史
git log
git log --oneline
git log --graph --oneline --all

# 查看文件差异
git diff
git diff <file>
git diff --staged
```

### 分支操作

```bash
# 查看所有分支
git branch -a

# 创建分支
git branch <branch-name>

# 切换分支
git checkout <branch-name>
# 或使用新命令
git switch <branch-name>

# 创建并切换分支
git checkout -b <branch-name>
# 或
git switch -c <branch-name>

# 删除分支
git branch -d <branch-name>
git branch -D <branch-name>  # 强制删除

# 重命名分支
git branch -m <old-name> <new-name>
```

### 撤销操作

```bash
# 撤销工作区修改
git checkout -- <file>
# 或
git restore <file>

# 取消暂存
git reset HEAD <file>
# 或
git restore --staged <file>

# 撤销最后一次提交（保留修改）
git reset --soft HEAD~1

# 撤销最后一次提交（丢弃修改）
git reset --hard HEAD~1

# 修改最后一次提交
git commit --amend
```

### 远程操作

```bash
# 查看远程仓库
git remote -v

# 添加远程仓库
git remote add origin <url>

# 拉取远程更新
git fetch origin
git pull origin main

# 推送到远程
git push origin <branch-name>

# 推送并设置上游分支
git push -u origin <branch-name>
```

### 标签管理

```bash
# 创建标签
git tag v1.0.0
git tag -a v1.0.0 -m "Release version 1.0.0"

# 查看标签
git tag
git show v1.0.0

# 推送标签
git push origin v1.0.0
git push origin --tags

# 删除标签
git tag -d v1.0.0
git push origin --delete v1.0.0
```

## 🔧 高级技巧

### Rebase vs Merge

**Merge（合并）**
```bash
git merge feature/new-feature
# 保留完整的分支历史
```

**Rebase（变基）**
```bash
git rebase main
# 创建线性的提交历史
```

推荐使用 rebase 保持提交历史清晰。

### 交互式 Rebase

```bash
# 整理最近3次提交
git rebase -i HEAD~3

# 可以进行的操作：
# pick   - 保留提交
# reword - 修改提交信息
# edit   - 编辑提交
# squash - 合并到前一个提交
# drop   - 删除提交
```

### Cherry-pick

```bash
# 将特定提交应用到当前分支
git cherry-pick <commit-hash>
```

### Stash（暂存）

```bash
# 暂存当前修改
git stash
git stash save "work in progress"

# 查看暂存列表
git stash list

# 应用暂存
git stash apply
git stash apply stash@{0}

# 应用并删除暂存
git stash pop

# 删除暂存
git stash drop stash@{0}
git stash clear
```

## 🚨 问题解决

### 合并冲突

```bash
# 1. 查看冲突文件
git status

# 2. 手动编辑冲突文件，解决冲突标记：
#    <<<<<<< HEAD
#    当前分支的内容
#    =======
#    合并分支的内容
#    >>>>>>> feature-branch

# 3. 标记为已解决
git add <resolved-file>

# 4. 完成合并
git commit
```

### 误提交敏感信息

```bash
# 从历史中删除文件
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch <file>" \
  --prune-empty --tag-name-filter cat -- --all

# 强制推送（谨慎使用）
git push origin --force --all
```

### 恢复删除的分支

```bash
# 查看引用日志
git reflog

# 恢复分支
git checkout -b <branch-name> <commit-hash>
```

## 📚 最佳实践

1. **频繁提交**：小步提交，每次只做一件事
2. **清晰的提交信息**：遵循 Commit 规范
3. **及时推送**：避免本地积累太多未推送的提交
4. **保持同步**：经常从 main 拉取更新
5. **代码审查**：使用 Pull Request 进行代码审查
6. **测试后提交**：确保代码通过测试后再提交
7. **避免直接推送到 main**：通过 Pull Request 合并
8. **使用 .gitignore**：不提交临时文件和敏感信息

## 🔗 相关文档

- [Git 官方文档](https://git-scm.com/doc)
- [GitHub Flow](https://guides.github.com/introduction/flow/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [语义化版本](https://semver.org/lang/zh-CN/)

## 📞 获取帮助

```bash
# 查看命令帮助
git help <command>
git <command> --help

# 常用帮助
git help commit
git help merge
git help rebase
```

---

遵循这些规范，让我们的 Git 历史保持清晰有序！ 🎯

