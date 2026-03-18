import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import authRoutes from './routes/auth';
import storyRoutes from './routes/stories';
import nodeRoutes from './routes/nodes';
import aiRoutes from './routes/ai';
import aiV2Routes from './routes/ai-v2';
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
import { closeQueues } from './utils/queue';

dotenv.config();

// 启动 AI Worker
import './workers/aiWorker';

// 启动会员 Worker
import './workers/membershipWorker';

// 启动置顶清理 Worker
import './workers/pinCleanupWorker';

const app = express();
export const prisma = new PrismaClient();

app.use(cors());
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

app.listen(PORT, () => {
  console.log(`🚀 StoryTree API running on port ${PORT}`);
  console.log(`📦 Version: http://localhost:${PORT}/api/version`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 收到SIGTERM信号，开始优雅关闭...');
  await closeQueues();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 收到SIGINT信号，开始优雅关闭...');
  await closeQueues();
  await prisma.$disconnect();
  process.exit(0);
});