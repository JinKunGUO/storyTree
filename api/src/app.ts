import express from 'express';
import cors from 'cors';
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from './db';
import authRoutes from './routes/auth';
import storyRoutes from './routes/stories';
import nodeRoutes from './routes/nodes';
import aiRoutes from './routes/ai';
import aiV2Routes from './routes/ai-v2';
import aiCreationRoutes from './routes/ai-creation';
import aiStreamRoutes from './routes/ai-stream';
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
import analyticsRoutes from './routes/analytics';

/**
 * 转义 HTML 特殊字符，防止注入
 */
function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 为 story 页动态注入 OG meta，供搜索引擎和社交分享抓取
 * 读取故事标题/描述/封面，替换 HTML 中的 <title> 并注入 og:* meta 标签
 */
async function serveStoryWithMeta(
  req: express.Request,
  res: express.Response,
  filePath: string,
): Promise<void> {
  const host = process.env.API_BASE_URL || 'https://storytree.online';
  const defaultTitle = '故事详情 - StoryTree';
  const defaultDesc = '在 StoryTree 阅读并创作分支式互动小说，每个选择都通向不同结局。';
  const defaultImage = `${host}/assets/logo.png`;

  let ogTags = '';
  let title = defaultTitle;

  try {
    const storyId = parseInt(req.query.id as string, 10);
    if (!Number.isNaN(storyId)) {
      // 仅公开故事注入 OG meta，避免私密故事标题/描述泄漏给爬虫
      const story = await prisma.stories.findFirst({
        where: { id: storyId, visibility: 'public' },
        select: { title: true, description: true, cover_image: true },
      });
      if (story) {
        title = story.title || defaultTitle;
        const desc = (story.description || defaultDesc).slice(0, 200);
        let image = story.cover_image || defaultImage;
        // 相对路径补全为绝对 URL
        if (image.startsWith('/')) {
          image = `${host}${image}`;
        }
        ogTags = `
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(desc)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:url" content="${escapeHtml(`${host}/story?id=${storyId}`)}">
  <meta name="description" content="${escapeHtml(desc)}">`;
      }
    }
  } catch (error) {
    console.error('注入 OG meta 失败，回退到默认值:', error);
  }

  try {
    let html = fs.readFileSync(filePath, 'utf8');
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
    if (ogTags) {
      // 注入到 </head> 之前
      html = html.replace('</head>', `${ogTags}\n</head>`);
    }
    res.type('html').send(html);
  } catch (error) {
    console.error('读取 story.html 失败:', error);
    res.sendFile(filePath);
  }
}

/**
 * 创建并配置 Express 应用实例
 * 分离出来以便于测试
 */
export function createApp() {
  const app = express();

  // 健康检查端点 - 放在所有中间件之前，确保部署检查不受 CORS/解析器影响
  // 同时注册 /health 和 /api/health，兼容直连和 Nginx 代理两种场景
  const healthHandler = (_req: express.Request, res: express.Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  };
  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  // 安全 HTTP 头（等效 helmet 核心功能）
  app.use((_req: express.Request, res: express.Response, next: express.NextFunction) => {
    // 防止 MIME 类型嗅探
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // 防止点击劫持
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    // XSS 过滤（旧浏览器）
    res.setHeader('X-XSS-Protection', '0');
    // 控制 Referrer 信息泄露
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // 禁止嗅探服务器信息
    res.removeHeader('X-Powered-By');
    // 权限策略：限制敏感 API
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
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

  // story 页动态 OG meta 注入（必须注册在 express.static 之前，
  // 否则 /story.html?id=N 会被静态中间件直接拦截，注入不生效）
  app.get(['/story', '/story.html'], async (req, res, next) => {
    const filePath = path.join(__dirname, '../../web', 'story.html');
    if (!fs.existsSync(filePath)) {
      return next();
    }
    return serveStoryWithMeta(req, res, filePath);
  });

  // 静态文件服务 - 提供前端页面
  app.use(express.static(path.join(__dirname, '../../web')));

  // Routes - 必须在通配符路由之前
  app.use('/api/auth', authRoutes);
  app.use('/api/stories', storyRoutes);
  app.use('/api/nodes', nodeRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/ai/v2', aiV2Routes);
  app.use('/api/ai/stream', aiStreamRoutes);
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
  app.use('/api/analytics', analyticsRoutes);

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

  // robots.txt - 允许搜索引擎抓取
  app.get('/robots.txt', (_req, res) => {
    const host = process.env.API_BASE_URL || 'https://storytree.online';
    res.type('text/plain');
    res.send(
      `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /profile\nDisallow: /write\n\nSitemap: ${host}/sitemap.xml\n`
    );
  });

  // sitemap.xml - 动态生成已发布故事的 URL 列表
  app.get('/sitemap.xml', async (_req, res) => {
    try {
      const host = process.env.API_BASE_URL || 'https://storytree.online';
      const stories = await prisma.stories.findMany({
        where: { visibility: 'public', nodes: { some: { parent_id: null } } },
        select: { id: true, updated_at: true },
        orderBy: { updated_at: 'desc' },
        take: 5000,
      });
      const urls = stories
        .map((s) => {
          const lastmod = s.updated_at ? new Date(s.updated_at).toISOString().slice(0, 10) : '';
          return `  <url>\n    <loc>${host}/story?id=${s.id}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n  </url>`;
        })
        .join('\n');
      res.type('application/xml');
      res.send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
      );
    } catch (error) {
      console.error('生成 sitemap 失败:', error);
      res.status(500).type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
    }
  });

  // SPA路由 - 必须放在最后，处理HTML5路由
  // 注意：story 页的 OG meta 注入已由 express.static 之前的显式路由处理，此处不再重复
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API not found' });
    }

    // 检查请求的路径（不带扩展名）
    const requestedPath = req.path.slice(1); // 去掉开头的 /
    const possiblePages = [
      'register', 'login', 'create', 'discover', 'profile', 'admin',
      'story', 'chapter', 'write', 'debug', 'level', 'payment',
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

  // 全局错误处理中间件 — 捕获路由中未处理的异常，返回统一格式
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // Prisma 验证错误（如 parseInt 产生 NaN 传入 where.id）→ 400
    if (err.constructor?.name === 'PrismaClientValidationError') {
      return res.status(400).json({ error: '请求参数无效' });
    }
    // Prisma 已知请求错误（如记录不存在的 P2025）→ 404/400
    if ((err as any).code === 'P2025') {
      return res.status(404).json({ error: '资源不存在' });
    }

    console.error('🔥 Express 全局错误:', err.message);
    console.error(err.stack);

    const statusCode = (err as any).statusCode || 500;
    const message = process.env.NODE_ENV === 'production'
      ? '服务器内部错误'
      : err.message;

    res.status(statusCode).json({ error: message });
  });

  return app;
}
