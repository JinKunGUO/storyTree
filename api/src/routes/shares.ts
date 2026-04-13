import { Router } from 'express';
import { prisma } from '../index';
import { getUserId } from '../utils/middleware';
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

// 记录分享
router.post('/', async (req, res) => {
  const { story_id, node_id, platform } = req.body;

  if (!story_id || !platform) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const validPlatforms = ['copy', 'wechat', 'weibo', 'qq', 'qzone', 'twitter', 'facebook'];
  if (!validPlatforms.includes(platform)) {
    return res.status(400).json({ error: 'Invalid platform' });
  }

  try {
    // 获取用户ID（可选，未登录也可以分享）
    const userId = getUserId(req);

    // 验证故事是否存在
    const story = await prisma.stories.findUnique({
      where: { id: parseInt(story_id) }
    });

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    // 如果提供了node_id，验证节点是否存在
    if (node_id) {
      const node = await prisma.nodes.findUnique({
        where: { id: parseInt(node_id) }
      });

      if (!node) {
        return res.status(404).json({ error: 'Node not found' });
      }
    }

    // 记录分享
    const share = await prisma.shares.create({
      data: {
        story_id: parseInt(story_id),
        node_id: node_id ? parseInt(node_id) : null,
        user_id: userId || null,
        platform
      }
    });

    res.json({
      success: true,
      share
    });
  } catch (error) {
    console.error('记录分享错误:', error);
    res.status(500).json({ error: 'Failed to record share' });
  }
});

// 获取分享统计
router.get('/stats/:story_id', async (req, res) => {
  const { story_id } = req.params;

  try {
    // 总分享次数
    const totalShares = await prisma.shares.count({
      where: { story_id: parseInt(story_id) }
    });

    // 按平台统计
    const sharesByPlatform = await prisma.shares.groupBy({
      by: ['platform'],
      where: { story_id: parseInt(story_id) },
      _count: {
        id: true
      }
    });

    // 最近分享记录（最多10条）
    const recentShares = await prisma.shares.findMany({
      where: { story_id: parseInt(story_id) },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        }
      },
      orderBy: { created_at: 'desc' },
      take: 10
    });

    // 格式化平台统计
    const platformStats = sharesByPlatform.reduce((acc, item) => {
      acc[item.platform] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      total_shares: totalShares,
      by_platform: platformStats,
      recent_shares: recentShares
    });
  } catch (error) {
    console.error('获取分享统计错误:', error);
    res.status(500).json({ error: 'Failed to get share stats' });
  }
});

// 获取章节分享统计
router.get('/stats/node/:node_id', async (req, res) => {
  const { node_id } = req.params;

  try {
    const totalShares = await prisma.shares.count({
      where: { node_id: parseInt(node_id) }
    });

    const sharesByPlatform = await prisma.shares.groupBy({
      by: ['platform'],
      where: { node_id: parseInt(node_id) },
      _count: {
        id: true
      }
    });

    const platformStats = sharesByPlatform.reduce((acc, item) => {
      acc[item.platform] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      total_shares: totalShares,
      by_platform: platformStats
    });
  } catch (error) {
    console.error('获取章节分享统计错误:', error);
    res.status(500).json({ error: 'Failed to get node share stats' });
  }
});

// ============================================================
// 生成小程序码
// POST /api/shares/miniprogram-code
// body: { story_id?, node_id?, page?, scene? }
// ============================================================
router.post('/miniprogram-code', async (req, res) => {
  const { story_id, node_id, page = 'pages/index/index', scene } = req.body;

  const appId = process.env.WX_APPID;
  const appSecret = process.env.WX_APP_SECRET;

  if (!appId || !appSecret) {
    return res.status(503).json({
      error: '微信小程序未配置，无法生成小程序码',
      code: 'WX_NOT_CONFIGURED'
    });
  }

  try {
    // 1. 获取 access_token
    const tokenRes = await fetch(
      `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`
    );
    const tokenData = await tokenRes.json() as any;

    if (tokenData.errcode) {
      return res.status(400).json({ error: `获取 access_token 失败: ${tokenData.errmsg}` });
    }

    const accessToken = tokenData.access_token;

    // 2. 生成小程序码（wxacode/getunlimited，支持任意页面）
    const sceneStr = scene || (story_id ? `sid=${story_id}` : node_id ? `nid=${node_id}` : 'home=1');

    const codeRes = await fetch(
      `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene: sceneStr,
          page,
          width: 280,
          auto_color: false,
          line_color: { r: 0, g: 0, b: 0 },
          is_hyaline: true,
        }),
      }
    );

    const contentType = codeRes.headers.get('content-type') || '';

    if (contentType.includes('image')) {
      // 成功，返回图片 buffer（base64）
      const buffer = await codeRes.buffer();
      const base64 = buffer.toString('base64');

      // 记录分享（如果关联了故事）
      if (story_id) {
        const userId = getUserId(req);
        await prisma.shares.create({
          data: {
            story_id: parseInt(story_id),
            node_id: node_id ? parseInt(node_id) : null,
            user_id: userId || null,
            platform: 'miniprogram_code',
          }
        }).catch(() => {}); // 忽略记录失败
      }

      res.json({
        success: true,
        base64: `data:image/png;base64,${base64}`,
        scene: sceneStr,
      });
    } else {
      const errData = await codeRes.json() as any;
      console.error('生成小程序码失败:', errData);
      res.status(400).json({ error: `生成小程序码失败: ${errData.errmsg || '未知错误'}` });
    }
  } catch (error) {
    console.error('生成小程序码错误:', error);
    res.status(500).json({ error: '生成小程序码失败' });
  }
});

export default router;

