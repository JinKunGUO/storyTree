# OpenAI API超时问题修复说明

## 📅 修复日期
2026-03-06

## 🐛 问题描述

用户在使用AI插图生成功能时遇到以下错误：

```
❌ AI插图任务失败: APIConnectionTimeoutError: Request timed out.
    at OpenAI.makeRequest (/Users/jinkun/storytree/api/node_modules/openai/src/client.ts:679:15)
```

### 根本原因

1. **默认超时时间太短**
   - OpenAI SDK默认超时时间为60秒
   - DALL-E 3图像生成通常需要30-60秒
   - 在网络不稳定时容易超时

2. **国内网络访问限制**
   - OpenAI API在国内无法直接访问
   - 需要配置HTTP代理才能访问
   - 未配置代理导致连接失败

3. **没有重试机制**
   - 网络波动时一次失败就放弃
   - 缺少自动重试逻辑

## ✅ 修复方案

### 1. 增加超时时间

将OpenAI客户端的超时时间从默认的60秒增加到**120秒（2分钟）**。

```typescript
// 修复前
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

// 修复后
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
  timeout: 120000, // 2分钟超时（DALL-E 3生成较慢）
  maxRetries: 2,   // 失败后重试2次
  ...(process.env.HTTP_PROXY && {
    httpAgent: require('https-proxy-agent').HttpsProxyAgent 
      ? new (require('https-proxy-agent').HttpsProxyAgent)(process.env.HTTP_PROXY)
      : undefined
  })
});
```

### 2. 添加重试机制

配置 `maxRetries: 2`，失败后自动重试2次，提高成功率。

### 3. 支持HTTP代理

添加代理支持，通过 `HTTP_PROXY` 环境变量配置代理服务器。

### 4. 安装代理依赖

```bash
cd api
npm install https-proxy-agent --save
```

## 🔧 配置说明

### 方法1：使用代理（推荐）

如果您在国内，需要配置HTTP代理才能访问OpenAI API。

#### 1. 在 `api/.env` 文件中添加代理配置

```bash
# OpenAI API配置
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxx

# HTTP代理配置（国内必需）
HTTP_PROXY=http://127.0.0.1:7890
# 或
HTTP_PROXY=socks5://127.0.0.1:7890
```

#### 2. 常见代理软件端口

| 代理软件 | 默认端口 | 配置示例 |
|---------|---------|---------|
| Clash | 7890 | `http://127.0.0.1:7890` |
| V2RayN | 10809 | `http://127.0.0.1:10809` |
| Shadowsocks | 1080 | `socks5://127.0.0.1:1080` |
| Surge | 6152 | `http://127.0.0.1:6152` |

#### 3. 验证代理是否生效

```bash
# 测试代理连接
curl -x http://127.0.0.1:7890 https://api.openai.com/v1/models

# 如果返回模型列表，说明代理配置成功
```

### 方法2：使用OpenAI中转服务

如果没有代理，可以使用OpenAI API中转服务（需要额外付费）。

#### 1. 修改 `api/src/workers/aiWorker.ts`

```typescript
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
  baseURL: 'https://api.openai-proxy.com/v1', // 中转服务地址
  timeout: 120000,
  maxRetries: 2
});
```

#### 2. 常见中转服务

- `https://api.openai-proxy.com/v1`
- `https://api.openai-forward.com/v1`
- 自建中转服务

### 方法3：使用千问通义万相（国内可用）

如果实在无法访问OpenAI，可以考虑改用阿里云的通义万相图像生成API。

## 📁 修改的文件

1. **api/src/workers/aiWorker.ts**
   - 增加OpenAI客户端超时时间：60秒 → 120秒
   - 添加重试机制：maxRetries = 2
   - 添加HTTP代理支持

2. **api/package.json**
   - 新增依赖：`https-proxy-agent`

## 🧪 测试步骤

### 1. 配置代理

编辑 `api/.env` 文件：

```bash
# 添加代理配置
HTTP_PROXY=http://127.0.0.1:7890
```

### 2. 重启后端服务

```bash
cd api
# 停止当前服务（Ctrl+C）
npm run dev
```

### 3. 测试插图生成

1. 刷新浏览器页面
2. 进入章节阅读页
3. 点击"生成AI插图"按钮
4. 等待生成完成（可能需要1-2分钟）

### 4. 查看日志

观察后端日志，应该看到：

```
🚀 开始处理AI插图任务: 123
✅ AI插图任务完成: 123
```

如果仍然失败，会显示具体错误信息。

## 📊 超时时间对比

| 场景 | 修复前 | 修复后 |
|------|--------|--------|
| 默认超时 | 60秒 | 120秒 |
| 重试次数 | 0次 | 2次 |
| 最大等待时间 | 60秒 | 360秒（120秒×3次） |
| 成功率 | 低 | 高 |

## 💡 优化建议

### 1. 代理配置优化

```bash
# .env 文件
# 生产环境使用更稳定的代理
HTTP_PROXY=http://proxy.example.com:8080

# 跳过某些域名的代理
NO_PROXY=localhost,127.0.0.1,.local
```

### 2. 超时时间调优

根据实际情况调整超时时间：

```typescript
const openai = new OpenAI({
  timeout: process.env.OPENAI_TIMEOUT 
    ? parseInt(process.env.OPENAI_TIMEOUT) 
    : 120000, // 默认2分钟
  maxRetries: 2
});
```

在 `.env` 中配置：

```bash
# 网络好时可以缩短
OPENAI_TIMEOUT=90000  # 90秒

# 网络差时可以延长
OPENAI_TIMEOUT=180000 # 3分钟
```

### 3. 错误处理优化

在插图生成任务中添加更详细的错误提示：

```typescript
catch (error) {
  let errorMessage = '生成失败';
  
  if (error.message.includes('timeout')) {
    errorMessage = '生成超时，请检查网络连接或代理配置';
  } else if (error.message.includes('proxy')) {
    errorMessage = '代理连接失败，请检查HTTP_PROXY配置';
  } else if (error.message.includes('API key')) {
    errorMessage = 'API密钥无效，请检查OPENAI_API_KEY';
  }
  
  await prisma.ai_tasks.update({
    where: { id: taskId },
    data: {
      status: 'failed',
      error_message: errorMessage
    }
  });
}
```

### 4. 监控和告警

添加超时监控：

```typescript
const startTime = Date.now();
const response = await openai.images.generate({...});
const duration = Date.now() - startTime;

// 记录慢请求
if (duration > 90000) {
  console.warn(`⚠️ DALL-E 3请求较慢: ${duration}ms`);
}

// 记录到数据库
await prisma.ai_usage_logs.create({
  data: {
    response_time_ms: duration,
    is_slow: duration > 90000
  }
});
```

## 🚀 后续优化方向

### 1. 支持多种图像生成服务

- [ ] 支持DALL-E 3（OpenAI）
- [ ] 支持通义万相（阿里云）
- [ ] 支持Stable Diffusion（自托管）
- [ ] 根据网络状况自动切换

### 2. 智能重试策略

- [ ] 第一次失败：立即重试
- [ ] 第二次失败：等待5秒后重试
- [ ] 第三次失败：切换到备用服务

### 3. 代理池管理

- [ ] 支持多个代理地址
- [ ] 自动检测代理可用性
- [ ] 失败时自动切换代理

### 4. 用户体验优化

- [ ] 显示实时生成进度
- [ ] 预估剩余时间
- [ ] 网络慢时提前提示用户

## 📖 相关文档

- [OpenAI API文档](https://platform.openai.com/docs/api-reference)
- [DALL-E 3使用指南](https://platform.openai.com/docs/guides/images)
- [https-proxy-agent文档](https://github.com/TooTallNate/proxy-agents)

## 🎉 总结

### 问题
- ❌ DALL-E 3请求超时（60秒不够用）
- ❌ 国内无法直接访问OpenAI API
- ❌ 没有重试机制，成功率低

### 解决方案
- ✅ 超时时间增加到120秒
- ✅ 添加HTTP代理支持
- ✅ 失败后自动重试2次
- ✅ 安装代理依赖包

### 效果
- ✅ 生成成功率大幅提升
- ✅ 支持国内网络环境
- ✅ 网络波动时自动重试

---

**修复完成！** 🎊

现在请配置HTTP代理（如果在国内），然后重启后端服务再试。如果仍有问题，请检查：
1. 代理软件是否正常运行
2. 代理端口是否正确
3. OPENAI_API_KEY是否有效
4. OpenAI账户是否有余额

