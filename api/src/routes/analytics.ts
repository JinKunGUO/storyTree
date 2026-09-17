import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../index';
import { verifyJWT } from '../utils/auth';
import { authenticateToken, requireAdmin, safeParsePage, safeParseLimit } from '../utils/middleware';

const router = Router();

// 允许的事件名白名单，防止脏数据写入
const ALLOWED_EVENTS = new Set([
  'page_view',        // 页面访问
  'register',         // 注册成功
  'login',            // 登录成功
  'story_created',    // 创建故事
  'chapter_created',  // 创建章节/分支
  'ai_continue',      // 使用AI续写
  'share_click',      // 点击分享
  'invite_used',      // 使用邀请码
]);

// 采集端点限流：每 IP 每分钟最多 60 次（正常浏览足够，防止刷库）
const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁' },
});

/**
 * 上报埋点事件（批量）
 * POST /api/analytics/track
 * Body: { events: [{ event, page, referrer, utm_source?, utm_medium?, utm_campaign?, properties? }] }
 * 无鉴权（需记录未登录用户访问），若带有效 token 则关联 user_id
 */
router.post('/track', trackLimiter, async (req, res) => {
  try {
    const events = req.body?.events;
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'events 不能为空' });
    }
    if (events.length > 20) {
      return res.status(400).json({ error: '单次最多上报 20 条事件' });
    }

    // 可选鉴权：有 token 则关联用户
    let userId: number | null = null;
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const decoded = verifyJWT(token);
      userId = decoded?.userId ?? null;
    }

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;
    const userAgent = (req.headers['user-agent'] || '').slice(0, 500) || null;

    const rows = [];
    for (const e of events) {
      if (!e || typeof e.event !== 'string' || !ALLOWED_EVENTS.has(e.event)) {
        continue; // 跳过非法事件，不整体报错（容忍前端旧版本）
      }
      rows.push({
        event: e.event,
        user_id: userId,
        page: typeof e.page === 'string' ? e.page.slice(0, 500) : null,
        referrer: typeof e.referrer === 'string' ? e.referrer.slice(0, 1000) : null,
        utm_source: typeof e.utm_source === 'string' ? e.utm_source.slice(0, 100) : null,
        utm_medium: typeof e.utm_medium === 'string' ? e.utm_medium.slice(0, 100) : null,
        utm_campaign: typeof e.utm_campaign === 'string' ? e.utm_campaign.slice(0, 100) : null,
        properties: e.properties && typeof e.properties === 'object'
          ? JSON.stringify(e.properties).slice(0, 2000)
          : null,
        ip,
        user_agent: userAgent,
      });
    }

    if (rows.length === 0) {
      return res.status(400).json({ error: '无有效事件' });
    }

    await prisma.analytics_events.createMany({ data: rows });
    res.json({ success: true, received: rows.length });
  } catch (error) {
    console.error('埋点上报失败:', error);
    res.status(500).json({ error: '上报失败' });
  }
});

/**
 * 管理端：渠道来源统计
 * GET /api/admin/analytics/sources?days=7
 */
router.get('/sources', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days as string) || 7, 1), 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const events = await prisma.analytics_events.findMany({
      where: { created_at: { gte: since } },
      select: { event: true, utm_source: true, user_id: true, created_at: true },
    });

    // 按渠道聚合：访问量、注册数、注册转化率
    const bySource: Record<string, { views: number; registers: number; creates: number }> = {};
    for (const e of events) {
      const src = e.utm_source || '(直接访问)';
      if (!bySource[src]) bySource[src] = { views: 0, registers: 0, creates: 0 };
      if (e.event === 'page_view') bySource[src].views++;
      if (e.event === 'register') bySource[src].registers++;
      if (e.event === 'story_created') bySource[src].creates++;
    }

    res.json({ days, since, sources: bySource, totalEvents: events.length });
  } catch (error) {
    console.error('渠道统计失败:', error);
    res.status(500).json({ error: '统计失败' });
  }
});

/**
 * 管理端：转化漏斗
 * GET /api/admin/analytics/funnel?days=7
 */
router.get('/funnel', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days as string) || 7, 1), 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const events = await prisma.analytics_events.findMany({
      where: { created_at: { gte: since } },
      select: { event: true, user_id: true, ip: true },
    });

    // 按用户（user_id 或 ip 兜底）去重统计各环节人数
    const funnel: Record<string, Set<string>> = {
      page_view: new Set(),
      register: new Set(),
      story_created: new Set(),
      ai_continue: new Set(),
    };
    for (const e of events) {
      if (!(e.event in funnel)) continue;
      const key = e.user_id != null ? `u:${e.user_id}` : `ip:${e.ip}`;
      funnel[e.event].add(key);
    }

    res.json({
      days,
      funnel: Object.fromEntries(Object.entries(funnel).map(([k, v]) => [k, v.size])),
    });
  } catch (error) {
    console.error('漏斗统计失败:', error);
    res.status(500).json({ error: '统计失败' });
  }
});

export default router;
