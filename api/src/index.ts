import dotenv from 'dotenv';
import { createServer } from 'http';
export { prisma } from './db';
import { prisma } from './db';
import { createApp } from './app';
import { closeQueues } from './utils/queue';
import { wsServer } from './utils/websocket';

// 根据 NODE_ENV 加载对应的 .env 文件，fallback 到 .env
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
dotenv.config({ path: envFile });

// ============================================================
// 安全检查：JWT_SECRET 不能使用默认值
// ============================================================
const DEFAULT_JWT_SECRETS = [
  'your-secret-key-change-this',
  'secret',
  'jwt-secret',
  'your-jwt-secret',
];

const jwtSecret = process.env.JWT_SECRET || '';
if (!jwtSecret || DEFAULT_JWT_SECRETS.includes(jwtSecret)) {
  console.error('❌ 安全错误：JWT_SECRET 未配置或使用了默认值！');
  console.error('   请在 .env 文件中设置一个安全的随机密钥。');
  console.error('   建议使用: openssl rand -base64 32');
  
  // 生产环境直接退出
  if (process.env.NODE_ENV === 'production') {
    console.error('   生产环境不允许使用默认 JWT_SECRET，服务启动失败。');
    process.exit(1);
  } else {
    console.warn('⚠️  开发环境允许继续运行，但请尽快配置安全的 JWT_SECRET。');
  }
}

// ============================================================
// 环境变量检查：FRONTEND_URL 在生产环境必须配置
// ============================================================
if (process.env.NODE_ENV === 'production') {
  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) {
    console.error('❌ 配置错误：生产环境必须设置 FRONTEND_URL 环境变量！');
    console.error('   FRONTEND_URL 用于生成邮箱验证链接、密码重置链接等。');
    console.error('   示例：FRONTEND_URL=https://storytree.online');
    process.exit(1);
  }
  
  // 验证 URL 格式
  try {
    const url = new URL(frontendUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('协议必须是 http 或 https');
    }
    console.log(`✅ FRONTEND_URL 已配置: ${frontendUrl}`);
  } catch (error) {
    console.error('❌ 配置错误：FRONTEND_URL 格式无效！');
    console.error(`   当前值: ${frontendUrl}`);
    console.error(`   错误: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
} else {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
  console.log(`ℹ️  开发环境 FRONTEND_URL: ${frontendUrl}`);
}

// 启动 AI Worker
import './workers/aiWorker';

// 启动会员 Worker
import './workers/membershipWorker';

// 启动置顶清理 Worker
import './workers/pinCleanupWorker';

// 创建 Express 应用实例
const app = createApp();

const PORT = process.env.PORT || 3001;

// 创建 HTTP Server（用于同时挂载 Express 和 WebSocket）
const server = createServer(app);

// 挂载 WebSocket 服务
wsServer.init(server);

server.listen(PORT, () => {
  console.log(`🚀 StoryTree API running on port ${PORT}`);
  console.log(`🔌 WebSocket available at ws://localhost:${PORT}/api/ws`);
  console.log(`📦 Version: http://localhost:${PORT}/api/version`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 收到SIGTERM信号，开始优雅关闭...');
  await wsServer.close();
  await closeQueues();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 收到SIGINT信号，开始优雅关闭...');
  await wsServer.close();
  await closeQueues();
  await prisma.$disconnect();
  process.exit(0);
});
