# AI功能测试指南

## 🧪 测试前准备

### 1. 启动Redis
```bash
# macOS
brew services start redis

# Ubuntu/Debian
sudo systemctl start redis

# 验证Redis运行
redis-cli ping
# 应返回: PONG
```

### 2. 配置环境变量
编辑 `api/.env`：
```bash
# 必需配置
ANTHROPIC_API_KEY="sk-ant-xxx"  # Claude API Key
OPENAI_API_KEY="sk-xxx"         # OpenAI API Key (用于DALL-E 3)

# Redis配置
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD=""

# 其他配置
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="your-secret-key"
PORT=3001
```

### 3. 启动服务
```bash
cd api
npm install
npm run db:push  # 确保数据库最新
npm run dev      # 启动开发服务器
```

你应该看到：
```
🚀 StoryTree API running on port 3001
📦 Version: http://localhost:3001/api/version
🤖 AI Worker已启动，等待任务...
```

---

## 📝 功能测试清单

### 1. 用户等级和积分系统

#### 测试1.1：查看用户等级信息
```bash
# 登录后访问
curl -X GET http://localhost:3001/api/points/info \
  -H "Authorization: Bearer YOUR_TOKEN"

# 预期响应：
{
  "points": 0,
  "level": {
    "current": 1,
    "name": "新手作者",
    "progress": 0,
    "nextLevelPoints": 100,
    "quotas": {
      "continuation": 3,
      "polish": 5,
      "illustration": 0
    }
  }
}
```

#### 测试1.2：每日签到获取积分
```bash
curl -X POST http://localhost:3001/api/points/daily-checkin \
  -H "Authorization: Bearer YOUR_TOKEN"

# 预期响应：
{
  "success": true,
  "points": 1,
  "newPoints": 1,
  "levelUp": false
}
```

#### 测试1.3：查看积分交易历史
```bash
curl -X GET http://localhost:3001/api/points/transactions \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. AI续写功能（异步）

#### 测试2.1：提交立即执行的续写任务
```bash
curl -X POST http://localhost:3001/api/ai/v2/continuation/submit \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "storyId": 1,
    "context": "在一个月黑风高的夜晚，主角独自走在空荡的街道上...",
    "style": "悬疑",
    "count": 3
  }'

# 预期响应：
{
  "taskId": 1,
  "status": "pending",
  "message": "任务已提交，正在处理中..."
}
```

#### 测试2.2：提交延迟执行的续写任务
```bash
curl -X POST http://localhost:3001/api/ai/v2/continuation/submit \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "storyId": 1,
    "context": "故事前文...",
    "surpriseTime": "1hour"
  }'

# 预期响应包含scheduledAt字段
```

#### 测试2.3：查询任务状态
```bash
curl -X GET http://localhost:3001/api/ai/v2/tasks/1 \
  -H "Authorization: Bearer YOUR_TOKEN"

# 任务完成后响应包含result字段：
{
  "taskId": 1,
  "status": "completed",
  "result": {
    "options": [
      {
        "title": "深夜的脚步声",
        "content": "...",
        "style": "悬疑向"
      }
    ]
  }
}
```

#### 测试2.4：接受续写结果并创建节点
```bash
curl -X POST http://localhost:3001/api/ai/v2/continuation/accept \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": 1,
    "optionIndex": 0
  }'
```

### 3. AI润色功能（同步）

#### 测试3.1：润色文字（简洁风格）
```bash
curl -X POST http://localhost:3001/api/ai/v2/polish \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "他走在路上，心里想着很多事情，感觉很复杂，不知道该怎么办才好。",
    "style": "concise"
  }'

# 预期响应（10-30秒内）：
{
  "taskId": 2,
  "original": "他走在路上...",
  "polished": "他走在路上，思绪万千，不知所措。",
  "style": "concise"
}
```

#### 测试3.2：润色文字（华丽风格）
```bash
curl -X POST http://localhost:3001/api/ai/v2/polish \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "月光很美。",
    "style": "elegant"
  }'
```

### 4. AI插图生成

#### 测试4.1：提交插图任务
```bash
curl -X POST http://localhost:3001/api/ai/v2/illustration/submit \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "storyId": 1,
    "nodeId": 5,
    "chapterTitle": "月下奇遇",
    "chapterContent": "月光洒在古老的森林中，树影婆娑..."
  }'

# 预期响应：
{
  "taskId": 3,
  "status": "pending",
  "message": "插图生成任务已提交，完成后将通知您"
}
```

#### 测试4.2：查看插图结果
```bash
# 等待1-2分钟后查询
curl -X GET http://localhost:3001/api/ai/v2/tasks/3 \
  -H "Authorization: Bearer YOUR_TOKEN"

# 完成后响应：
{
  "result": {
    "imageUrl": "https://...",
    "prompt": "Moonlight in ancient forest..."
  }
}
```

### 5. AI配额管理

#### 测试5.1：查看配额信息
```bash
curl -X GET http://localhost:3001/api/ai/v2/quota \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 测试5.2：超出配额测试
```bash
# 连续调用AI功能直到超出配额
# 应返回403错误和提示信息
```

### 6. 支付系统（模拟）

#### 测试6.1：获取套餐列表
```bash
curl -X GET http://localhost:3001/api/payment/plans
```

#### 测试6.2：创建订阅订单
```bash
curl -X POST http://localhost:3001/api/payment/subscription/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "monthly"
  }'

# 响应包含orderId和支付链接
```

#### 测试6.3：模拟支付成功
```bash
curl -X POST http://localhost:3001/api/payment/callback/mock \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "SUB_xxx",
    "success": true
  }'

# 然后查询用户信息，应该看到订阅已激活
```

#### 测试6.4：创建积分充值订单
```bash
curl -X POST http://localhost:3001/api/payment/points/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "packageId": "basic"
  }'
```

### 7. 通知系统

#### 测试7.1：查看通知列表
```bash
curl -X GET http://localhost:3001/api/notifications \
  -H "Authorization: Bearer YOUR_TOKEN"

# AI任务完成后应该收到通知
```

---

## 🖥️ 前端测试

### 1. 访问等级页面
打开浏览器访问：
```
http://localhost:3001/level
```

应该看到：
- 用户当前等级和积分
- 升级进度条
- AI功能配额使用情况
- 订阅状态
- 最近的AI任务列表

### 2. 测试交互功能
- 点击"升级会员"按钮
- 查看AI任务详情
- 刷新页面验证数据持久化

---

## 🐛 常见问题排查

### 问题1：Redis连接失败
```
错误: Error: connect ECONNREFUSED 127.0.0.1:6379
解决: 
1. 检查Redis是否运行: redis-cli ping
2. 检查端口是否正确: netstat -an | grep 6379
3. 检查环境变量配置
```

### 问题2：AI任务一直pending
```
原因: Worker可能未启动
解决:
1. 查看控制台是否有 "🤖 AI Worker已启动" 消息
2. 检查Redis队列: redis-cli
   > KEYS bull:*
3. 重启服务器
```

### 问题3：API Key无效
```
错误: Anthropic API error: Invalid API key
解决:
1. 检查.env文件中的API Key
2. 确保API Key有效且有余额
3. 测试API Key: curl https://api.anthropic.com/v1/messages \
     -H "x-api-key: YOUR_KEY" \
     -H "anthropic-version: 2023-06-01"
```

### 问题4：积分未扣除
```
原因: 可能是数据库事务失败
解决:
1. 查看控制台错误日志
2. 检查数据库完整性: npm run db:push
3. 查看point_transactions表
```

### 问题5：前端显示401未授权
```
原因: Token过期或无效
解决:
1. 重新登录获取新token
2. 检查localStorage中的token
3. 验证JWT_SECRET配置一致
```

---

## 📊 性能监控

### 1. 监控Redis队列
```bash
redis-cli
> KEYS bull:*
> LLEN bull:ai-continuation:waiting
> LLEN bull:ai-continuation:active
> LLEN bull:ai-continuation:completed
```

### 2. 监控数据库
```bash
# 查看AI任务统计
sqlite3 api/prisma/dev.db
> SELECT status, COUNT(*) FROM ai_tasks GROUP BY status;
> SELECT task_type, COUNT(*) FROM ai_tasks GROUP BY task_type;
```

### 3. 监控API响应时间
```bash
# 使用curl测试
time curl -X POST http://localhost:3001/api/ai/v2/polish \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "测试", "style": "concise"}'
```

---

## ✅ 测试通过标准

- [ ] Redis正常运行
- [ ] Worker正常启动
- [ ] 用户等级系统正常显示
- [ ] 每日签到功能正常
- [ ] AI续写任务可以提交和完成
- [ ] AI润色功能10-30秒内返回结果
- [ ] AI插图任务可以提交（如果有OpenAI Key）
- [ ] 配额限制正常工作
- [ ] 积分扣除正常
- [ ] 通知系统正常工作
- [ ] 支付订单创建正常
- [ ] 前端页面正常显示数据

---

## 📝 测试报告模板

```
测试日期：2026-03-05
测试人员：XXX
测试环境：开发环境

功能测试结果：
✅ 用户等级系统 - 通过
✅ 积分系统 - 通过
✅ AI续写（异步） - 通过
✅ AI润色（同步） - 通过
⚠️ AI插图 - 部分通过（需要OpenAI Key）
✅ 配额管理 - 通过
✅ 支付系统（模拟） - 通过
✅ 通知系统 - 通过
✅ 前端UI - 通过

性能指标：
- AI续写响应时间：5-10秒
- AI润色响应时间：10-20秒
- AI插图响应时间：30-60秒
- Redis队列延迟：<100ms

发现的问题：
1. 无

建议优化：
1. 添加Bull Dashboard可视化队列状态
2. 添加更详细的错误日志
3. 实现真实支付接口
```

---

**测试完成后，系统即可投入使用！** 🎉

