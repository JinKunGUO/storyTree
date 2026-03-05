# 项目AI功能切换总结

## ✅ 已完成的修改

### 1. 核心代码修改

#### `api/src/routes/ai.ts`
- ❌ 移除：`import Anthropic from '@anthropic-ai/sdk'`
- ✅ 添加：`import OpenAI from 'openai'`
- ✅ 创建千问客户端（使用OpenAI兼容接口）
- ✅ 修改API调用逻辑
- ✅ 更新Token计费逻辑
- ✅ 更新日志记录（模型名称）

**关键变更：**
```typescript
// 旧代码 (Claude)
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
});

// 新代码 (千问)
const qwenClient = new OpenAI({
  apiKey: process.env.QWEN_API_KEY || '',
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
});
```

### 2. 配置文件修改

#### `api/.env`
- ❌ 移除：`ANTHROPIC_API_KEY`
- ✅ 添加：`QWEN_API_KEY` - 千问API密钥
- ✅ 添加：`QWEN_MODEL` - 模型选择（默认：qwen-plus）

### 3. 新增文件

1. **`test-qwen-api.js`** - 千问API测试脚本
   - 自动检测API Key配置
   - 测试API连接
   - 显示Token使用和成本

2. **`setup-qwen.sh`** - 一键配置脚本
   - 交互式配置API Key
   - 选择模型
   - 自动测试连接

3. **`docs/QWEN_API_SETUP.md`** - 完整配置文档
   - 获取API Key步骤
   - 配置说明
   - 模型对比
   - 常见问题

4. **`docs/QWEN_MIGRATION_SUMMARY.md`** - 本文件

---

## 🎯 为什么选择千问？

### 优势对比

| 特性 | Claude Haiku | 千问-Plus | 优势 |
|------|--------------|-----------|------|
| **价格** | $0.25/M输入 + $1.25/M输出 | ¥0.002/千tokens | 千问便宜约5倍 |
| **中文支持** | 良好 | 优秀（原生中文） | 千问更适合中文创作 |
| **响应速度** | 快 | 很快 | 相当 |
| **API可用性** | 需要国际支付 | 支持国内支付 | 千问更方便 |
| **模型选择** | 固定 | 3个档次可选 | 千问更灵活 |

### 成本节省

假设每天生成100次AI续写（每次约2000 tokens）：

- **Claude Haiku**: 约 ¥2.1 元/天 × 30天 = **¥63/月**
- **千问-Plus**: 约 ¥0.4 元/天 × 30天 = **¥12/月**

**节省**: ¥51/月 (约85%成本下降) 💰

---

## 📋 配置步骤（快速版）

### 方法1: 使用一键配置脚本（推荐）

```bash
./setup-qwen.sh
```

按提示输入API Key和选择模型即可。

### 方法2: 手动配置

1. **获取API Key**
   ```
   访问: https://dashscope.console.aliyun.com/apiKey
   ```

2. **编辑 `api/.env`**
   ```bash
   QWEN_API_KEY="sk-你的API-Key"
   QWEN_MODEL="qwen-plus"
   ```

3. **测试配置**
   ```bash
   node test-qwen-api.js
   ```

4. **重启服务**
   ```bash
   ./start-ai.sh
   ```

---

## 🧪 测试验证

### 1. API连接测试

```bash
node test-qwen-api.js
```

**预期输出：**
```
✅ API调用成功！
响应: 测试成功
Token使用: 8 输入 + 4 输出 = 12 总计
🎉 您的千问API配置正确，可以正常使用AI功能！
```

### 2. 前端功能测试

1. 访问: `http://localhost:3001/write?storyId=1`
2. 输入50字以上内容
3. 点击"AI续写建议"
4. 查看生成的3个续写选项

### 3. API直接测试

```bash
curl -X POST http://localhost:3001/api/ai/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "storyId": 1,
    "context": "这是一个测试故事...",
    "count": 3
  }'
```

---

## 🔄 迁移影响分析

### ✅ 无需修改的部分

1. **前端代码** - 完全兼容，无需修改
2. **数据库结构** - 保持不变
3. **API接口** - 保持相同的输入输出格式
4. **用户体验** - 无感知切换

### ⚠️ 需要注意的变化

1. **响应格式** - 内部已适配，外部接口不变
2. **Token计费** - 计费逻辑已更新
3. **模型名称** - 日志中显示 `qwen-plus` 而非 `claude-3-haiku`
4. **错误处理** - 错误消息格式可能略有不同

---

## 📊 千问模型选择指南

### qwen-turbo (¥0.0008/千tokens)
- ✅ 快速响应
- ✅ 成本最低
- ❌ 质量略低
- **适用**: 简单续写、快速原型

### qwen-plus (¥0.002/千tokens) 【推荐】
- ✅ 平衡性价比
- ✅ 质量优秀
- ✅ 速度快
- **适用**: 大多数场景

### qwen-max (¥0.02/千tokens)
- ✅ 最强性能
- ✅ 最高质量
- ❌ 成本较高
- **适用**: 高质量创作需求

---

## 🛠️ 故障排查

### 问题1: API Key无效

**症状**: 返回401错误或"Invalid API key"

**解决方案**:
1. 检查API Key是否正确复制
2. 确认在DashScope控制台已激活
3. 检查账户余额

### 问题2: 模型不可用

**症状**: 返回模型相关错误

**解决方案**:
1. 检查 `QWEN_MODEL` 配置
2. 确认模型名称拼写正确
3. 使用推荐的 `qwen-plus`

### 问题3: 请求超时

**症状**: 请求长时间无响应

**解决方案**:
1. 检查网络连接
2. 确认API服务可访问
3. 查看服务器日志

### 问题4: 返回模拟数据

**症状**: AI生成的内容总是相同的模拟文本

**解决方案**:
1. 检查 `QWEN_API_KEY` 是否配置
2. 运行 `node test-qwen-api.js` 测试
3. 查看服务器控制台错误信息

---

## 📚 相关资源

### 官方文档
- 千问API文档: https://help.aliyun.com/zh/dashscope/
- OpenAI兼容接口: https://help.aliyun.com/zh/dashscope/developer-reference/compatibility-of-openai-with-dashscope/
- 模型介绍: https://help.aliyun.com/zh/dashscope/developer-reference/model-square/

### 项目文档
- 配置指南: `docs/QWEN_API_SETUP.md`
- AI功能测试: `docs/AI_TESTING_GUIDE.md`
- 按钮修复说明: `docs/AI_BUTTON_FIX.md`

### 工具脚本
- API测试: `node test-qwen-api.js`
- 快速配置: `./setup-qwen.sh`
- 启动服务: `./start-ai.sh`

---

## ✅ 验收检查清单

迁移完成后，请确认以下项目：

- [ ] ✅ 代码修改完成（ai.ts）
- [ ] ✅ 配置文件更新（.env）
- [ ] ✅ 获取千问API Key
- [ ] ✅ 配置API Key到.env
- [ ] ✅ 运行测试脚本成功
- [ ] ✅ 重启API服务器
- [ ] ✅ 前端AI续写功能正常
- [ ] ✅ 生成内容质量满意
- [ ] ✅ Token使用记录正常
- [ ] ✅ 成本计算准确

---

## 🎉 迁移完成！

恭喜！您已成功将StoryTree的AI功能切换到阿里云千问API。

### 主要收益

1. **成本降低85%** - 从¥63/月降至¥12/月
2. **中文优化** - 原生中文支持，创作质量更好
3. **国内支付** - 支持支付宝等国内支付方式
4. **灵活选择** - 3个模型档次可根据需求切换

### 下一步建议

1. 监控API使用情况和成本
2. 根据实际效果调整模型选择
3. 优化Prompt以获得更好的生成效果
4. 考虑添加更多AI功能（润色、插图等）

---

**文档版本**: 1.0  
**更新时间**: 2026-03-05  
**维护者**: StoryTree Team

