# 惊喜时间选择与AI章节创作功能

## 📖 功能简介

根据M2基础功能开发计划书，完成了**"惊喜时间选择与AI章节创作"**核心功能。该功能允许用户选择AI在不同时间点为他们创作完整的新章节，而不仅仅是续写片段。

## ✨ 核心特性

### 1. 惊喜时间选择
- ⚡ **立即生成**: AI实时生成续写内容（3-10秒）
- ⏳ **1小时后**: 任务延迟1小时执行
- 🌙 **今晚22:00**: 在今晚22:00执行
- ☀️ **明天8:00**: 在明天早上8:00执行

### 2. AI风格选择
- ❓ **悬疑**: 制造悬念，引人入胜
- ❤️ **温情**: 温暖感人的叙事风格
- 💡 **脑洞**: 充满创意和想象力

### 3. AI章节创作
- 🤖 AI生成完整章节（500-1000字）
- 📝 自动创建新节点（标记为AI生成）
- 🌳 作为故事树的新分支
- 🎯 用户可接受或重新生成

### 4. 任务管理
- 📋 独立的任务列表页面
- 🔄 实时状态更新
- 👁️ 查看任务结果
- 🗂️ 按状态筛选（全部/等待中/处理中/已完成/失败）

## 🚀 快速开始

### 前置条件

```bash
# 1. 确保Redis运行
brew services start redis
# 或
redis-server

# 2. 配置AI API密钥
cd api
cp .env.example .env
# 编辑.env，添加 QWEN_API_KEY 或 ANTHROPIC_API_KEY
```

### 启动服务

```bash
# 启动后端
cd api
npm install
npm run dev

# 访问前端
open http://localhost:3001
```

### 使用功能

1. **创作页面**: http://localhost:3001/write?storyId=1
2. **任务列表**: http://localhost:3001/ai-tasks

## 📁 项目结构

```
storytree/
├── web/
│   ├── write.html              # 创作页面（包含AI续写功能）
│   └── ai-tasks.html           # AI任务列表页面（新增）
├── api/
│   └── src/
│       ├── routes/
│       │   └── ai-v2.ts        # AI API v2（已有）
│       └── workers/
│           └── aiWorker.ts     # AI任务处理器（已有）
└── docs/
    ├── SURPRISE_TIME_IMPLEMENTATION.md  # 实现总结
    ├── SURPRISE_TIME_TEST_GUIDE.md      # 测试指南
    └── SURPRISE_TIME_DEMO.md            # 功能演示
```

## 🎯 使用流程

### 场景1: 立即生成

```
1. 进入创作页面
2. 撰写至少50字的内容
3. 点击"AI续写"按钮
4. 选择"立即生成"和风格
5. 等待3-10秒
6. 查看3个AI生成的章节选项
7. 点击"接受并创建章节"
8. 自动跳转到新章节页面
```

### 场景2: 延迟生成

```
1. 进入创作页面
2. 撰写内容
3. 点击"AI续写"按钮
4. 选择"1小时后"或其他延迟选项
5. 提交任务
6. 访问任务列表查看状态
7. 在预定时间后查看结果
8. 接受章节创建新分支
```

## 📊 API端点

### 提交AI续写任务

```http
POST /api/ai/v2/continuation/submit
Authorization: Bearer <token>
Content-Type: application/json

{
  "storyId": 1,
  "nodeId": null,
  "context": "故事上下文...",
  "style": "suspense",
  "count": 3,
  "surpriseTime": "1hour"  // null | "1hour" | "tonight" | "tomorrow"
}
```

### 查询任务状态

```http
GET /api/ai/v2/tasks/:taskId
Authorization: Bearer <token>
```

### 接受AI续写并创建章节

```http
POST /api/ai/v2/continuation/accept
Authorization: Bearer <token>
Content-Type: application/json

{
  "taskId": 123,
  "optionIndex": 0
}
```

### 获取任务列表

```http
GET /api/ai/v2/tasks
Authorization: Bearer <token>
```

## 🎨 界面预览

### AI续写模态框

![AI续写模态框](https://via.placeholder.com/800x600?text=AI%E7%BB%AD%E5%86%99%E6%A8%A1%E6%80%81%E6%A1%86)

- 惊喜时间选择器
- AI风格选择器
- 开始生成按钮

### 生成结果展示

![生成结果](https://via.placeholder.com/800x600?text=%E7%94%9F%E6%88%90%E7%BB%93%E6%9E%9C)

- 3个AI生成的章节选项
- 每个选项包含标题和完整内容
- 接受按钮和预览按钮

### 任务列表页面

![任务列表](https://via.placeholder.com/800x600?text=%E4%BB%BB%E5%8A%A1%E5%88%97%E8%A1%A8)

- 任务筛选标签
- 任务状态卡片
- 查看结果和刷新按钮

## 🧪 测试

### 自动化测试

```bash
# 运行测试脚本
bash scripts/test-surprise-time.sh
```

### 手动测试

详见: `docs/SURPRISE_TIME_TEST_GUIDE.md`

### 测试用例

1. ✅ 立即生成AI章节
2. ✅ 1小时后生成
3. ✅ 今晚22:00生成
4. ✅ 明天8:00生成
5. ✅ 查看任务列表
6. ✅ 筛选任务状态
7. ✅ 查看任务结果
8. ✅ 接受AI章节
9. ✅ 章节自动创建
10. ✅ 页面自动跳转

## 📈 技术实现

### 前端技术

- **HTML5 + CSS3**: 响应式布局
- **Vanilla JavaScript**: 无框架依赖
- **Fetch API**: 异步请求
- **轮询机制**: 任务状态实时更新

### 后端技术

- **Node.js + Express**: RESTful API
- **Prisma**: ORM数据库操作
- **Bull**: 任务队列管理
- **Redis**: 队列存储
- **Qwen/Claude API**: AI生成

### 数据库Schema

```sql
-- ai_tasks表
CREATE TABLE ai_tasks (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  story_id INTEGER,
  node_id INTEGER,
  task_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  input_data TEXT NOT NULL,
  result_data TEXT,
  error_message TEXT,
  scheduled_at DATETIME,      -- 惊喜时间
  started_at DATETIME,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- nodes表（AI生成标记）
CREATE TABLE nodes (
  id INTEGER PRIMARY KEY,
  story_id INTEGER NOT NULL,
  parent_id INTEGER,
  author_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  path TEXT NOT NULL,
  ai_generated BOOLEAN DEFAULT 0,  -- AI生成标记
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME
);
```

## 🔧 配置说明

### 环境变量

```env
# AI服务配置（二选一）
QWEN_API_KEY=your_qwen_api_key
QWEN_MODEL=qwen-plus

# 或
ANTHROPIC_API_KEY=your_anthropic_api_key

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT密钥
JWT_SECRET=your_secret_key
```

### Bull队列配置

```javascript
// api/src/utils/queue.ts
export const aiContinuationQueue = new Queue('ai-continuation', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: 100,
    removeOnFail: 50
  }
});
```

## 📝 待完成功能

### 实时通知 (P1)

- [ ] WebSocket实时推送
- [ ] 任务完成通知
- [ ] Toast提示
- [ ] 点击跳转到结果

### AI虚拟创作者 (P1)

- [ ] 创建AI用户账号
- [ ] AI章节作者设置为AI用户
- [ ] AI创作统计
- [ ] AI vs 人类创作对比

### 任务管理增强 (P2)

- [ ] 取消pending任务
- [ ] 批量删除任务
- [ ] 任务执行日志
- [ ] 任务重试功能

## 🐛 已知问题

1. **长时间轮询**: 立即生成时最多轮询60秒，超时后需要手动刷新
   - **解决方案**: 实现WebSocket实时推送

2. **任务取消**: 无法取消已提交的pending任务
   - **解决方案**: 添加取消任务API

3. **移动端优化**: 部分按钮在小屏幕上可能过小
   - **解决方案**: 进一步优化移动端样式

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

### 开发流程

1. Fork项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

## 📄 许可证

MIT License

## 👥 作者

- **开发者**: CodeFuse AI Assistant
- **项目**: StoryTree
- **版本**: M2 - 基础功能开发
- **日期**: 2026-03-08

## 📚 相关文档

- [实现总结](./SURPRISE_TIME_IMPLEMENTATION.md)
- [测试指南](./SURPRISE_TIME_TEST_GUIDE.md)
- [功能演示](./SURPRISE_TIME_DEMO.md)
- [M2开发计划](./M2基础功能开发.plan.md)

## 🎉 致谢

感谢所有为StoryTree项目做出贡献的开发者！

---

**享受AI创作的惊喜时刻！** 🎊

