import express from 'express';
import cors from 'cors';
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

/**
 * 创建并配置 Express 应用实例
 * 分离出来以便于测试
 */
export function createApp() {
  const app = express();

  // 健康检查端点 - 放在所有中间件之前，确保部署检查不受 CORS/解析器影响
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

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
  app.use('/api/system', systemRoutes);
  app.use('/api/collaboration-requests', collaborationRequestRoutes);
  app.use('/api/badges', badgesRoutes);
  app.use('/api/invitations', invitationRoutes);
  app.use('/api/checkin', checkinRoutes);
  app.use('/api/withdrawals', withdrawalRoutes);
  app.use('/api/points-features', pointsFeaturesRoutes);
  app.use('/api/admin/users', adminUsersRoutes);
  app.use('/api/admin/content', adminContentRoutes);
  app.use('/api/admin/points', adminPointsRoutes);
  app.use('/api/admin/dashboard', adminDashboardRoutes);

  // 版本信息端点 - 读取 VERSION.json
  app.get('/api/version', (_req, res) => {
    try {
      // 尝试从项目根目录读取
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
        res.status(404).json({ error: 'Version file not found' });
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

  return app;
}
