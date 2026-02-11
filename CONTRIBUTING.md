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

再次感谢你的贡献！让我们一起打造更好的StoryTree！ 🌳✨

