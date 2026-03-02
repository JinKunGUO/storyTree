# 🧪 AI API 测试指南

## 📋 测试前准备

### 1. 启动API服务

```bash
# 在项目根目录
cd api
npm run dev

# 或使用项目提供的启动脚本
./start.sh
```

### 2. 确认服务运行

访问: http://localhost:3001/api/stories

如果看到JSON响应，说明服务正常运行。

---

## 🔑 获取测试所需的参数

### 获取Token

1. 访问 http://localhost:3001/login
2. 登录你的账号
3. 打开浏览器开发者工具（F12）
4. 在Console中执行：
   ```javascript
   localStorage.getItem('token')
   ```
5. 复制返回的token字符串

### 获取NodeId

1. 访问任意章节页面，例如: http://localhost:3001/chapter?id=1
2. URL中的 `id` 参数就是 `nodeId`
3. 或者访问故事详情页，点击任意章节，查看URL

---

## 🚀 方法1: 使用测试脚本（推荐）

### 快速检查

```bash
./test-ai-quick.sh
```

这会检查服务状态并显示测试说明。

### 完整测试

```bash
./test-ai-api.sh
```

按照提示输入：
1. Token（从浏览器获取）
2. NodeId（章节ID）

脚本会自动测试：
- ✅ 用户认证
- ✅ AI生成续写（3个选项）
- ✅ 接受AI续写（创建新节点）

---

## 🛠️ 方法2: 手动测试

### 测试1: 生成AI续写

```bash
# 替换 YOUR_TOKEN 和 NODE_ID
curl -X POST http://localhost:3001/api/ai/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"nodeId": NODE_ID, "count": 3}' \
  | jq '.'
```

**预期响应**:

```json
{
  "options": [
    {
      "title": "深夜的脚步声",
      "content": "夜色渐深，窗外的月光...",
      "style": "悬疑向"
    },
    {
      "title": "老照片的秘密",
      "content": "收拾旧物时，我在抽屉...",
      "style": "温情向"
    },
    {
      "title": "醒来变成一只猫",
      "content": "我睁开眼睛，第一反应...",
      "style": "脑洞向"
    }
  ],
  "raw": "【方向1：悬疑向】\n标题：..."
}
```

### 测试2: 接受AI续写

```bash
# 使用上面返回的第一个选项
curl -X POST http://localhost:3001/api/ai/accept \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "parentNodeId": NODE_ID,
    "title": "深夜的脚步声",
    "content": "夜色渐深，窗外的月光被乌云遮蔽..."
  }' \
  | jq '.'
```

**预期响应**:

```json
{
  "node": {
    "id": 123,
    "title": "深夜的脚步声",
    "content": "夜色渐深...",
    "aiGenerated": true,
    "path": "1.2",
    "storyId": 5,
    "authorId": 1,
    "createdAt": "2026-02-16T15:30:00.000Z"
  }
}
```

---

## 🔍 测试场景

### 场景1: 正常流程

1. ✅ 用户已登录
2. ✅ 请求已有的nodeId
3. ✅ 返回3个续写选项
4. ✅ 接受一个选项，创建新节点

### 场景2: 无API密钥（Mock模式）

如果 `ANTHROPIC_API_KEY` 为空，API会返回预设的mock数据：

```javascript
// api/src/routes/ai.ts 第99行
// 当API调用失败时，返回mock响应
aiResponse = `【方向1：悬疑向】
标题：深夜的脚步声
内容：
夜色渐深，窗外的月光被乌云遮蔽...
`;
```

这对于开发和测试非常有用！

### 场景3: 错误处理

#### 未登录
```bash
curl -X POST http://localhost:3001/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{"nodeId": 1, "count": 3}'
```

**预期**: `401 Unauthorized`

#### 节点不存在
```bash
curl -X POST http://localhost:3001/api/ai/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"nodeId": 99999, "count": 3}'
```

**预期**: `404 Node not found`

#### 缺少参数
```bash
curl -X POST http://localhost:3001/api/ai/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{}'
```

**预期**: `400 nodeId is required`

---

## 📊 验证结果

### 检查生成的节点

访问新创建的章节：

```
http://localhost:3001/chapter?id=NEW_NODE_ID
```

应该看到：
- ✅ AI生成的内容
- ✅ 标记为"AI生成"（如果前端有显示）
- ✅ 正确的父子关系
- ✅ 正确的path路径

### 检查数据库

```bash
cd api
npx prisma studio
```

在 `nodes` 表中查看：
- `ai_generated` 字段应该为 `true`
- `parent_id` 应该指向正确的父节点
- `path` 应该是正确的路径格式

---

## 🐛 常见问题

### Q1: API返回401 Unauthorized

**原因**: Token无效或已过期

**解决**: 重新登录获取新的token

### Q2: API返回404 Node not found

**原因**: nodeId不存在

**解决**: 
1. 访问 http://localhost:3001/api/stories 查看可用的故事
2. 访问故事详情页，找到有效的章节ID

### Q3: AI生成的内容都一样

**原因**: 使用的是mock数据（ANTHROPIC_API_KEY未配置）

**解决**: 
1. 获取Anthropic API密钥
2. 在 `api/.env` 中配置：
   ```
   ANTHROPIC_API_KEY="sk-ant-..."
   ```
3. 重启服务

### Q4: 生成很慢

**原因**: Claude API响应需要时间

**正常**: 通常需要3-10秒

**优化**: 前端应显示加载状态

---

## ✅ 测试清单

完成以下测试项：

- [ ] API服务正常启动
- [ ] 用户可以登录
- [ ] 可以获取有效的token
- [ ] 可以找到有效的nodeId
- [ ] `POST /api/ai/generate` 返回3个选项
- [ ] 每个选项都有 title、content、style
- [ ] `POST /api/ai/accept` 成功创建节点
- [ ] 新节点的 `aiGenerated` 为 true
- [ ] 可以访问新创建的章节页面
- [ ] 错误情况得到正确处理

---

## 📝 测试报告模板

```markdown
# AI API测试报告

**测试时间**: 2026-02-16 23:30
**测试人员**: [你的名字]
**环境**: 本地开发环境

## 测试结果

### API生成测试
- Status: ✅ Pass / ❌ Fail
- Response Time: [X]秒
- Options Count: 3
- Notes: [备注]

### API接受测试
- Status: ✅ Pass / ❌ Fail
- Node Created: Yes/No
- Node ID: [新节点ID]
- AI Generated Flag: true/false
- Notes: [备注]

### 错误处理测试
- 401 Test: ✅ Pass / ❌ Fail
- 404 Test: ✅ Pass / ❌ Fail
- 400 Test: ✅ Pass / ❌ Fail

## 发现的问题

1. [问题描述]
2. [问题描述]

## 建议

1. [改进建议]
2. [改进建议]
```

---

## 🎯 下一步

测试通过后，继续：

1. ✅ 在写作页面添加AI续写UI
2. ✅ 在章节页面添加快速续写
3. ✅ 添加权限控制
4. ✅ 优化用户体验

---

**准备好了吗？运行测试脚本开始吧！** 🚀

```bash
./test-ai-api.sh
```

