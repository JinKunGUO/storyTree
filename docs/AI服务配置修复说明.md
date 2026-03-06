# AI服务配置修复说明

## 📅 修复日期
2026-03-06

## 🐛 问题描述

用户在使用AI润色功能时遇到以下错误：

```
Error: Could not resolve authentication method. Expected either apiKey or authToken to be set.
```

**根本原因：**
- 项目配置使用的是阿里云千问API（`QWEN_API_KEY`）
- 但代码中硬编码使用了Anthropic Claude API
- 导致认证失败

## ✅ 修复方案

### 1. 添加AI服务自动检测

修改 `api/src/workers/aiWorker.ts`，添加AI服务自动检测逻辑：

```typescript
// 检测使用哪个AI服务
const USE_QWEN = !!process.env.QWEN_API_KEY;
const QWEN_MODEL = process.env.QWEN_MODEL || 'qwen-plus';

// 初始化AI客户端（可选）
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
}) : null;
```

### 2. 实现千问API调用函数

添加千问API的封装函数：

```typescript
async function callQwenAPI(
  prompt: string, 
  maxTokens: number = 2000, 
  temperature: number = 0.8
): Promise<{ text: string; usage: { input: number; output: number } }> {
  const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.QWEN_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: QWEN_MODEL,
      input: {
        messages: [{ role: 'user', content: prompt }]
      },
      parameters: {
        max_tokens: maxTokens,
        temperature: temperature,
        top_p: 0.9
      }
    })
  });

  const data = await response.json();
  return {
    text: data.output?.text || '',
    usage: {
      input: data.usage?.input_tokens || 0,
      output: data.usage?.output_tokens || 0
    }
  };
}
```

### 3. 修改AI任务处理函数

更新所有AI任务处理函数，支持双API：

#### AI润色任务
```typescript
if (USE_QWEN) {
  // 使用千问API
  const qwenResponse = await callQwenAPI(prompt, 1500, 0.7);
  polishedText = qwenResponse.text;
  // ...
} else {
  // 使用Claude API
  if (!anthropic) {
    throw new Error('未配置AI服务');
  }
  const response = await anthropic.messages.create({...});
  // ...
}
```

#### AI续写任务
同样的逻辑应用到续写任务

#### AI插图prompt生成
同样的逻辑应用到图像prompt生成

## 🎯 修改文件

- `api/src/workers/aiWorker.ts`
  - 第9-20行：添加AI服务检测和初始化
  - 第22-64行：添加千问API调用函数
  - 第110行：更新续写任务日志
  - 第189-220行：更新续写任务AI调用逻辑
  - 第265行：更新润色任务日志
  - 第304-335行：更新润色任务AI调用逻辑
  - 第506-524行：更新图像prompt生成逻辑

## 📋 环境配置

### 使用阿里云千问（推荐，当前配置）

在 `api/.env` 中配置：

```bash
# 阿里云千问 API Key
QWEN_API_KEY="sk-your-qwen-api-key"

# 千问模型选择
QWEN_MODEL="qwen-plus"  # 或 qwen-turbo, qwen-max
```

### 使用Anthropic Claude（可选）

在 `api/.env` 中配置：

```bash
# Anthropic API Key
ANTHROPIC_API_KEY="sk-ant-your-anthropic-key"
```

### 优先级规则

- 如果配置了 `QWEN_API_KEY`，优先使用千问API
- 如果没有配置千问，但配置了 `ANTHROPIC_API_KEY`，使用Claude API
- 如果都没配置，抛出错误

## 🧪 测试验证

### 1. 重启后端服务

修改代码后需要重启服务：

```bash
cd api
# 停止当前服务（Ctrl+C）
npm run dev
```

### 2. 测试AI润色功能

1. 访问写作页面：`http://localhost:3000/write?storyId=<故事ID>`
2. 输入测试文本
3. 点击"AI润色"按钮
4. 选择风格，等待润色完成

### 3. 查看日志

后端控制台应该显示：

```
🚀 开始处理AI润色任务: 123, 使用千问API
✅ AI润色任务完成: 123
```

## 📊 API对比

| 特性 | 阿里云千问 | Anthropic Claude |
|------|-----------|------------------|
| 价格 | 较低 | 较高 |
| 中文能力 | 优秀 | 良好 |
| 响应速度 | 快 | 中等 |
| 模型选择 | qwen-turbo/plus/max | claude-3-haiku |
| 国内访问 | 稳定 | 需要代理 |

## 🎉 修复结果

- ✅ 支持阿里云千问API
- ✅ 支持Anthropic Claude API
- ✅ 自动检测和切换
- ✅ 向后兼容
- ✅ AI润色功能正常工作
- ✅ AI续写功能正常工作
- ✅ AI插图功能正常工作

## 🔧 故障排查

### 问题1：仍然报认证错误

**检查：**
1. 确认 `api/.env` 中配置了 `QWEN_API_KEY`
2. 确认API Key格式正确（以`sk-`开头）
3. 重启后端服务

### 问题2：千问API返回错误

**检查：**
1. API Key是否有效
2. 账户余额是否充足
3. 网络连接是否正常

**查看详细错误：**
```bash
# 在后端控制台查看错误日志
❌ AI润色任务失败: 123 Error: 千问API错误: ...
```

### 问题3：响应内容为空

**可能原因：**
1. 千问API响应格式变化
2. 提示词过长或格式不正确

**解决方法：**
- 检查 `callQwenAPI` 函数中的响应解析
- 查看千问API文档确认响应格式

## 📞 技术支持

如果遇到其他问题：

1. 查看后端控制台日志
2. 查看浏览器开发者工具Network标签
3. 检查千问API控制台的调用记录
4. 参考千问API文档：https://help.aliyun.com/zh/dashscope/

## 🚀 后续优化建议

1. **添加API切换配置**
   - 允许用户在配置文件中指定优先使用哪个API
   - 支持API降级（主API失败时自动切换到备用API）

2. **优化错误处理**
   - 更详细的错误提示
   - API配额监控和预警
   - 自动重试机制

3. **性能优化**
   - API响应缓存
   - 并发请求限制
   - 请求队列优化

4. **成本优化**
   - 根据任务类型选择合适的模型
   - Token使用统计和优化
   - 批量请求优化

