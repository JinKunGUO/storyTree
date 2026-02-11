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
import adminRoutes from './routes/admin';
import userRoutes from './routes/users';
import uploadRoutes from './routes/upload';
import searchRoutes from './routes/search';
import notificationRoutes from './routes/notifications';

dotenv.config();

const app = express();
export const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// 静态文件服务 - 提供上传的图片
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/nodes', nodeRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationRoutes);

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

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 StoryTree API running on port ${PORT}`);
  console.log(`📦 Version: http://localhost:${PORT}/api/version`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
