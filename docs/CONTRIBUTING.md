# 贡献指南

感谢你对 StoryTree 项目的关注！我们欢迎任何形式的贡献。

## 🤝 如何贡献

### 报告Bug

如果你发现了Bug，请通过GitHub Issues报告，并包含以下信息：

1. **Bug描述**：清晰简洁地描述问题
2. **复现步骤**：详细的复现步骤
3. **期望行为**：你期望发生什么
4. **实际行为**：实际发生了什么
5. **环境信息**：
   - 操作系统
   - Node.js版本
   - 浏览器版本（如果是前端问题）
6. **截图**：如果适用，添加截图帮助说明问题

### 提出新功能

如果你有新功能的想法：

1. 先检查是否已有相关Issue
2. 创建新Issue，标题以 `[Feature Request]` 开头
3. 详细描述功能需求和使用场景
4. 说明为什么这个功能有价值

### 提交代码

#### 开发流程

1. **Fork项目**
   ```bash
   # 在GitHub上Fork项目
   ```

2. **克隆到本地**
   ```bash
   git clone https://github.com/your-username/storytree.git
   cd storytree
   ```

3. **创建特性分支**
   ```bash
   git checkout -b feature/your-feature-name
   # 或
   git checkout -b fix/your-bug-fix
   ```

4. **安装依赖**
   ```bash
   cd api
   npm install
   ```

5. **进行开发**
   - 编写代码
   - 遵循代码规范
   - 添加必要的注释
   - 编写测试（如果适用）

6. **测试你的更改**
   ```bash
   npm run lint      # 代码检查
   npm run dev       # 本地测试
   ```

7. **提交更改**
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

8. **推送到你的Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

9. **创建Pull Request**
   - 在GitHub上创建PR
   - 填写PR模板
   - 等待代码审查

## 📝 代码规范

### Commit Message规范

使用语义化提交信息，格式：`<type>(<scope>): <subject>`

**Type类型：**

- `feat`: 新功能
- `fix`: Bug修复
- `docs`: 文档更新
- `style`: 代码格式调整（不影响功能）
- `refactor`: 重构（既不是新功能也不是修复）
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具相关
- `revert`: 回退

**示例：**

```bash
feat(api): 添加图片上传功能
fix(frontend): 修复搜索结果显示问题
docs(readme): 更新安装说明
refactor(routes): 重构用户路由代码
```

### TypeScript代码规范

```typescript
// 使用接口定义类型
interface User {
  id: number;
  username: string;
  email: string;
}

// 函数添加类型注解
async function getUser(id: number): Promise<User> {
  // 实现...
}

// 使用async/await而不是.then()
try {
  const user = await getUser(1);
} catch (error) {
  console.error(error);
}

// 使用const而不是let（除非需要重新赋值）
const API_BASE = 'http://localhost:3001/api';
```

### 代码风格

- 使用2空格缩进
- 使用单引号（TypeScript/JavaScript）
- 语句末尾加分号
- 文件末尾留空行
- 函数和类之间空一行
- 适当添加注释说明复杂逻辑

### 命名规范

- **变量/函数**: camelCase (`getUserById`, `userName`)
- **类/接口**: PascalCase (`User`, `StoryNode`)
- **常量**: UPPER_SNAKE_CASE (`API_BASE`, `MAX_FILE_SIZE`)
- **文件名**: kebab-case (`user-routes.ts`, `auth-middleware.ts`)

## 🧪 测试

### 运行测试

```bash
npm test
```

### 编写测试

为新功能编写单元测试：

```typescript
describe('User API', () => {
  it('should create a new user', async () => {
    const user = await createUser({
      username: 'testuser',
      email: 'test@example.com'
    });
    expect(user.username).toBe('testuser');
  });
});
```

## 📚 文档

### 更新文档

如果你的更改影响了用户使用方式：

1. 更新 `README.md`
2. 更新 `CHANGELOG.md`
3. 添加必要的API文档
4. 更新代码注释

### 文档风格

- 使用清晰简洁的语言
- 提供代码示例
- 包含截图（如果适用）
- 保持格式一致

## 🔍 代码审查

### 审查标准

代码审查时会关注：

- **功能性**: 代码是否正确实现了功能
- **可读性**: 代码是否易于理解
- **性能**: 是否有性能问题
- **安全性**: 是否存在安全隐患
- **测试**: 是否有充分的测试
- **文档**: 是否更新了相关文档

### 响应审查意见

- 及时回复审查意见
- 虚心接受建议
- 进行必要的修改
- 解释你的设计决策

## 🎯 开发优先级

### 高优先级

- 安全性修复
- 严重Bug修复
- 性能优化

### 中优先级

- 新功能开发
- 用户体验改进
- 文档完善

### 低优先级

- 代码重构
- 小的UI调整
- 代码风格统一

## 💡 开发建议

### 最佳实践

1. **小步提交**: 每次提交只做一件事
2. **及时同步**: 经常从主分支拉取更新
3. **编写测试**: 为核心功能编写测试
4. **性能考虑**: 注意数据库查询性能
5. **安全第一**: 验证用户输入，防止注入攻击
6. **用户体验**: 考虑加载状态、错误提示等

### 常见陷阱

- ❌ 直接在main分支开发
- ❌ 提交包含console.log的代码
- ❌ 忽略TypeScript类型错误
- ❌ 不写注释或文档
- ❌ 提交未测试的代码

## 📞 联系方式

如有疑问，可以通过以下方式联系：

- GitHub Issues: 提出问题或建议
- Email: storytree@example.com
- Discord: [加入我们的Discord](https://discord.gg/storytree)

## 📜 行为准则

### 我们的承诺

为了营造开放和包容的环境，我们承诺：

- 尊重不同的观点和经验
- 接受建设性的批评
- 关注对社区最有利的事情
- 对其他社区成员表示同理心

### 不可接受的行为

- 使用性化语言或图像
- 人身攻击或政治攻击
- 公开或私下骚扰
- 未经许可发布他人的私人信息
- 其他不道德或不专业的行为

## 🎉 贡献者

感谢所有为StoryTree做出贡献的开发者！

<!-- 这里会自动生成贡献者列表 -->

---

## 🧪 E2E 自动化测试

项目使用 Playwright 进行端到端自动化测试，覆盖所有页面的可用性、移动端适配、链路爬取、用户流程、视觉回归和无障碍审计。

### 何时运行测试

| 场景 | 命令 | 说明 |
|------|------|------|
| **日常开发** | `npx playwright test tests/e2e/smoke/` | 快速验证所有页面可加载、无 JS 错误、移动端无溢出 |
| **提交前** | `npm run test:e2e:smoke` | 等同上面，推荐 commit 前跑一次 |
| **完整测试** | `npm run test:e2e` | 全量测试（需要认证环境变量） |
| **CI 自动触发** | 自动 | PR 时跑 smoke，合并到 main 时跑全量（见 `.github/workflows/test.yml`） |

### 快速开始

```bash
# 1. 安装 Playwright 浏览器（首次）
npx playwright install chromium

# 2. 运行公开页面冒烟测试（无需任何配置，直接跑）
npx playwright test tests/e2e/smoke/public-pages.spec.ts

# 3. 运行全部冒烟测试（含移动端溢出检测）
npm run test:e2e:smoke

# 4. 查看 HTML 报告
npx playwright show-report
```

### 启用认证测试（完整模式）

生产环境需要邮箱验证，因此需要预先创建一个已验证的测试账号：

```bash
# 设置环境变量后运行完整测试
export E2E_TEST_EMAIL="your-verified-test@example.com"
export E2E_TEST_PASSWORD="your-password"
npm run test:e2e
```

如果不设置这些变量，需要认证的测试会自动跳过（显示为 skipped），不会报错。

### 本地开发环境测试

```bash
# 先启动本地 API 服务器
npm run dev

# 指向本地运行测试（本地环境无邮箱验证，可自动注册）
E2E_BASE_URL=http://localhost:3001 npm run test:e2e
```

### 测试层级说明

| 层级 | 目录 | 用途 | 是否需要认证 |
|------|------|------|:---:|
| Smoke | `tests/e2e/smoke/` | 页面加载、JS 错误、移动端溢出、认证守卫 | 部分 |
| Crawler | `tests/e2e/crawler/` | BFS 链路爬取、死链检测、交互发现 | 是 |
| Flows | `tests/e2e/flows/` | P0-P2 用户流程（注册→创作→社交→支付） | 是 |
| Visual | `tests/e2e/visual/` | 截图对比回归检测 | 否 |
| A11y | `tests/e2e/accessibility/` | WCAG 2.1 AA 无障碍审计 | 部分 |

### 可用的 npm scripts

```
test:e2e          - 运行全部 E2E 测试
test:e2e:smoke    - 仅冒烟测试（推荐日常使用）
test:e2e:crawler  - 链路爬取测试
test:e2e:flows    - 用户流程测试
test:e2e:visual   - 视觉回归测试
test:e2e:a11y     - 无障碍审计
test:e2e:update-snapshots - 更新视觉基线截图
test:e2e:local    - 指向本地环境运行
```

### 添加新页面时

在 `tests/e2e/helpers/page-registry.ts` 中添加一行即可自动获得：
- 公开页面加载测试
- 移动端溢出检测
- 无障碍审计
- 爬虫覆盖率计算

```typescript
{ path: '/new-page.html', titleKeyword: '页面标题', auth: false, category: 'content' },
```

### CI/CD 集成

- **PR 提交时**：自动运行 `e2e-smoke` job（公开页面 + 移动端检测），约 30 秒
- **合并到 main 时**：自动运行 `e2e-full` job（全量测试），约 3 分钟
- 测试报告和失败截图作为 CI artifact 保存 30 天

### 测试发现的已知问题

运行测试时如果看到以下失败，这些是**真实的产品问题**（非测试 bug）：

1. `/payment.html` - 未登录时缺少认证守卫，且有 `toast is not defined` JS 错误
2. `/create.html` - 未登录时认证守卫延迟过高（>3s 才重定向）

---

再次感谢你的贡献！让我们一起打造更好的StoryTree！ 🌳✨

