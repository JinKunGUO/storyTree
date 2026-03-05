# 切换到阿里云千问API配置指南

## 📋 修改内容概述

已将项目的AI功能从 Anthropic Claude API 切换到 **阿里云千问(Qwen)API**。

### ✅ 已修改的文件

1. **`api/src/routes/ai.ts`** - AI路由核心代码
   - 移除 `@anthropic-ai/sdk` 依赖
   - 使用 `openai` 包（千问支持OpenAI兼容接口）
   - 更新API调用逻辑
   - 更新Token计费逻辑

2. **`api/.env`** - 环境变量配置
   - 移除 `ANTHROPIC_API_KEY`
   - 添加 `QWEN_API_KEY`
   - 添加 `QWEN_MODEL` (模型选择)

3. **`test-qwen-api.js`** - 新增千问API测试脚本

---

## 🔑 获取千问API Key

### 步骤1: 访问阿里云DashScope
```
https://dashscope.console.aliyun.com/
```

### 步骤2: 登录/注册
- 使用阿里云账号登录
- 如果没有账号，需要先注册

### 步骤3: 获取API Key
1. 进入控制台后，点击左侧菜单的 **"API Key管理"**
2. 点击 **"创建新的API Key"**
3. 复制生成的API Key（格式：`sk-xxxxxxxxxx`）

### 步骤4: 充值（如需要）
- 千问API是按量付费
- 新用户通常有免费额度
- 可在控制台查看余额和充值

---

## ⚙️ 配置API Key

### 1. 编辑 `api/.env` 文件

```bash
# 阿里云千问 API Key (DashScope)
# 获取API Key: https://dashscope.console.aliyun.com/apiKey
QWEN_API_KEY="sk-你的API-Key"

# 千问模型选择 (可选：qwen-turbo, qwen-plus, qwen-max, qwen-max-longcontext)
# qwen-turbo: 快速响应，适合简单任务
# qwen-plus: 平衡性能和成本 (推荐)
# qwen-max: 最强性能
QWEN_MODEL="qwen-plus"
```

### 2. 测试API配置

运行测试脚本验证配置：

```bash
node test-qwen-api.js
```

**预期输出：**
```
🔍 阿里云千问API诊断工具

============================================================

1️⃣ 检查环境变量
   QWEN_API_KEY: 存在
   QWEN_MODEL: qwen-plus

2️⃣ 检查API Key格式
   长度: 48 字符
   前缀: sk-xxxxxxx...
   ✅ 格式正确 (以 sk- 开头)

3️⃣ 测试API连接
   正在调用阿里云千问API...
   模型: qwen-plus
   端点: https://dashscope.aliyuncs.com/compatible-mode/v1
   ✅ API调用成功！
   响应: 测试成功
   Token使用: 8 输入 + 4 输出 = 12 总计
   模型: qwen-plus

🎉 您的千问API配置正确，可以正常使用AI功能！
   💰 本次调用成本约: ¥0.0000 元
```

---

## 🚀 重启服务

配置完成后，需要重启API服务器：

```bash
# 停止当前服务
lsof -ti:3001 | xargs kill

# 重新启动
cd api && npm run dev
```

或者直接运行：
```bash
./start-ai.sh
```

---

## 📊 千问模型对比

| 模型 | 特点 | 价格（元/千tokens） | 推荐场景 |
|------|------|---------------------|----------|
| **qwen-turbo** | 快速响应 | ¥0.0008 | 简单对话、快速生成 |
| **qwen-plus** | 平衡性价比 | ¥0.002 | **推荐**，适合大多数场景 |
| **qwen-max** | 最强性能 | ¥0.02 | 复杂创作、高质量要求 |
| **qwen-max-longcontext** | 超长上下文 | ¥0.02 | 长文本处理 |

### 💡 成本对比

假设生成一次AI续写（约2000 tokens）：

- **qwen-turbo**: ¥0.0016 元
- **qwen-plus**: ¥0.004 元（推荐）
- **qwen-max**: ¥0.04 元

**Claude Haiku对比**（原方案）：
- 2000 tokens ≈ $0.003 USD ≈ ¥0.021 元

**结论**：千问-plus比Claude Haiku便宜约5倍！

---

## 🧪 测试AI功能

### 1. 前端测试

1. 登录系统
2. 访问写作页面：`http://localhost:3001/write?storyId=1`
3. 输入至少50字的内容
4. 点击 **"AI续写建议"** 按钮
5. 查看生成的3个不同风格的续写建议

### 2. API直接测试

```bash
# 获取token（先登录）
TOKEN="your-jwt-token"

# 调用AI生成API
curl -X POST http://localhost:3001/api/ai/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "storyId": 1,
    "context": "这是一个神秘的夜晚，月光洒在古老的城堡上...",
    "count": 3
  }'
```

---

## 🔧 技术细节

### API调用方式

千问支持OpenAI兼容接口，使用标准的Chat Completions格式：

```typescript
const response = await qwenClient.chat.completions.create({
  model: 'qwen-plus',
  messages: [
    {
      role: 'user',
      content: '你的提示词'
    }
  ],
  temperature: 0.8,
  max_tokens: 2000
});
```

### 响应格式

```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "AI生成的内容"
      }
    }
  ],
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 200,
    "total_tokens": 300
  },
  "model": "qwen-plus"
}
```

---

## ❓ 常见问题

### Q1: API Key无效？

**A:** 检查以下几点：
1. API Key是否正确复制（包括完整的 `sk-` 前缀）
2. 是否在DashScope控制台中激活
3. 账户是否有可用余额

### Q2: 模型不可用？

**A:** 确认 `QWEN_MODEL` 配置正确：
- 有效值：`qwen-turbo`, `qwen-plus`, `qwen-max`, `qwen-max-longcontext`
- 推荐使用：`qwen-plus`

### Q3: 请求失败或超时？

**A:** 可能的原因：
1. 网络连接问题
2. API配额用尽
3. 请求频率过高

查看控制台日志获取详细错误信息。

### Q4: 如何查看API使用情况？

**A:** 访问：
```
http://localhost:3001/api/ai/usage-stats
```

或在阿里云DashScope控制台查看详细的使用统计。

---

## 📚 相关文档

- **千问API文档**: https://help.aliyun.com/zh/dashscope/
- **OpenAI兼容接口**: https://help.aliyun.com/zh/dashscope/developer-reference/compatibility-of-openai-with-dashscope/
- **模型介绍**: https://help.aliyun.com/zh/dashscope/developer-reference/model-square/
- **计费说明**: https://help.aliyun.com/zh/dashscope/developer-reference/tongyi-qianwen-metering-and-billing/

---

## ✅ 切换完成检查清单

- [ ] 已获取千问API Key
- [ ] 已在 `api/.env` 中配置 `QWEN_API_KEY`
- [ ] 已选择合适的 `QWEN_MODEL`（推荐 qwen-plus）
- [ ] 运行 `node test-qwen-api.js` 测试通过
- [ ] 重启API服务器
- [ ] 在前端测试AI续写功能
- [ ] 确认生成的内容质量满足要求

---

## 🎉 完成！

现在您的StoryTree项目已经成功切换到阿里云千问API！

享受更快的响应速度和更低的成本吧！🚀

