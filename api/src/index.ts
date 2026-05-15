import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
export { prisma } from './db';
import { prisma } from './db';
import * as fs from 'fs';
import * as path from 'path';
import authRoutes from './routes/auth';
import storyRoutes from './routes/stories';
import nodeRoutes from './routes/nodes';
import aiRoutes from './routes/ai';
import aiV2Routes from './routes/ai-v2';
import aiCreationRoutes from './routes/ai-creation';
import adminRoutes from './routes/admin';
import userRoutes from './routes/users';
import uploadRoutes from './routes/upload';
import searchRoutes from './routes/search';
import notificationRoutes from './routes/notifications';
import commentRoutes from './routes/comments';
import bookmarksRoutes from './routes/bookmarks';
import shareRoutes from './routes/shares';
import pointsRoutes from './routes/points';
import paymentRoutes from './routes/payment';
import membershipRoutes from './routes/membership';
import adminMembershipRoutes from './routes/admin-membership';
import systemRoutes from './routes/system';
import collaborationRequestRoutes from './routes/collaboration-requests';
import badgesRoutes from './routes/badges';
import invitationRoutes from './routes/invitations';
import checkinRoutes from './routes/checkin';
import withdrawalRoutes from './routes/withdrawals';
import pointsFeaturesRoutes from './routes/points-features';
import adminUsersRoutes from './routes/admin-users';
import adminContentRoutes from './routes/admin-content';
import adminPointsRoutes from './routes/admin-points';
import adminDashboardRoutes from './routes/admin-dashboard';
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

// 启动 AI Worker
import './workers/aiWorker';

// 启动会员 Worker
import './workers/membershipWorker';

// 启动置顶清理 Worker
import './workers/pinCleanupWorker';

const app = express();

// CORS 配置 - 只允许白名单内的来源
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3000', 'http://localhost:3001'];

app.use(cors({
  origin: function(origin, callback) {
    // 允许没有 origin 的请求（如移动应用、curl请求）
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS 拒绝来源: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());

// 静态文件服务 - 提供上传的图片
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 静态文件服务 - 提供前端页面
app.use(express.static(path.join(__dirname, '../../web')));

// Routes - 必须在通配符路由之前
app.use('/api/auth', authRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/nodes', nodeRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ai/v2', aiV2Routes);
app.use('/api/ai/creation', aiCreationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/bookmarks', bookmarksRoutes);
app.use('/api/shares', shareRoutes);
app.use('/api/points', pointsRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/membership', membershipRoutes);
app.use('/api/admin/membership', adminMembershipRoutes);
app.use('/api/admin/users', adminUsersRoutes);
app.use('/api/admin/content', adminContentRoutes);
app.use('/api/admin/points', adminPointsRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/collaboration-requests', collaborationRequestRoutes);
app.use('/api/badges', badgesRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/points-features', pointsFeaturesRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Version endpoint - read from root VERSION.json
app.get('/api/version', (req, res) => {
  try {
    // Try to read from parent directory (project root)
    const rootVersionPath = path.join(__dirname, '../../VERSION.json');
    const apiVersionPath = path.join(__dirname, '../VERSION.json');

    let versionPath = rootVersionPath;
    if (!fs.existsSync(rootVersionPath)) {
      versionPath = apiVersionPath;
    }

    if (fs.existsSync(versionPath)) {
      const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
      res.json(versionData);
    } else {
      res.json({
        version: '1.0.0',
        codename: 'M1-Seed',
        stage: 'MVP',
        error: 'VERSION.json not found'
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to read version info' });
  }
});

// SPA路由 - 必须放在最后，处理HTML5路由
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API not found' });
    }
    
    // 检查请求的路径（不带扩展名）
    const requestedPath = req.path.slice(1); // 去掉开头的 /
    const possiblePages = [
        'register', 'login', 'create', 'discover', 'profile', 'admin', 
        'story', 'story-tree', 'chapter', 'write', 'debug', 'level', 'payment',
        'reset-password', 'verify-email', 'forgot-password', 'ai-tasks'
    ];
    
    // 如果请求的是这些页面之一，提供对应的HTML文件
    if (possiblePages.includes(requestedPath)) {
        const filePath = path.join(__dirname, '../../web', `${requestedPath}.html`);
        if (fs.existsSync(filePath)) {
            return res.sendFile(filePath);
        }
    }
    
    // 默认提供index.html
    res.sendFile(path.join(__dirname, '../../web/index.html'));
});

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