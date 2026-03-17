import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const router = Router();
const prisma = new PrismaClient();

// 生成随机邀请码
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去除易混淆字符
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 验证JWT中间件
async function authenticateToken(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this') as { userId: number };
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: '无效的认证令牌' });
  }
}

// 验证管理员权限
async function requireAdmin(req: any, res: any, next: any) {
  try {
    const user = await prisma.users.findUnique({
      where: { id: req.userId }
    });

    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: '需要管理员权限' });
    }

    next();
  } catch (error) {
    return res.status(500).json({ error: '验证权限失败' });
  }
}

// 1. 【公开】验证邀请码是否有效
router.get('/validate/:code', async (req, res) => {
  try {
    const { code } = req.params;

    const inviteCode = await prisma.invitation_codes.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        created_by: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    if (!inviteCode) {
      return res.status(404).json({ 
        valid: false, 
        error: '邀请码不存在' 
      });
    }

    if (!inviteCode.is_active) {
      return res.status(400).json({ 
        valid: false, 
        error: '邀请码已被禁用' 
      });
    }

    if (inviteCode.expires_at && new Date(inviteCode.expires_at) < new Date()) {
      return res.status(400).json({ 
        valid: false, 
        error: '邀请码已过期' 
      });
    }

    if (inviteCode.max_uses !== -1 && inviteCode.used_count >= inviteCode.max_uses) {
      return res.status(400).json({ 
        valid: false, 
        error: '邀请码已达到最大使用次数' 
      });
    }

    res.json({
      valid: true,
      code: inviteCode.code,
      bonusPoints: inviteCode.bonus_points,
      createdBy: inviteCode.created_by.username,
      type: inviteCode.type
    });
  } catch (error) {
    console.error('验证邀请码失败:', error);
    res.status(500).json({ error: '验证邀请码失败' });
  }
});

// 2. 【用户】获取我的邀请码
router.get('/my-codes', authenticateToken, async (req: any, res) => {
  try {
    const user = await prisma.users.findUnique({
      where: { id: req.userId },
      select: {
        invitation_code: true,
        can_generate_invite: true,
        word_count: true,
        badges: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 如果用户还没有邀请码，检查是否符合生成条件
    if (!user.invitation_code && user.can_generate_invite) {
      // 自动生成邀请码
      const newCode = generateInviteCode();
      
      await prisma.$transaction(async (tx) => {
        // 更新用户的邀请码
        await tx.users.update({
          where: { id: req.userId },
          data: { invitation_code: newCode }
        });

        // 创建邀请码记录
        await tx.invitation_codes.create({
          data: {
            code: newCode,
            created_by_id: req.userId,
            type: 'user',
            bonus_points: 50, // 默认奖励50积分
            max_uses: -1, // 无限使用
            is_active: true
          }
        });
      });

      user.invitation_code = newCode;
    }

    // 获取邀请统计
    const inviteStats = await prisma.invitation_records.findMany({
      where: { inviter_id: req.userId },
      include: {
        invitee: {
          select: {
            id: true,
            username: true,
            word_count: true,
            createdAt: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    // 计算总奖励
    const totalRewards = inviteStats.reduce((sum, record) => {
      let total = record.bonus_points;
      if (record.milestone_rewards) {
        try {
          const milestones = JSON.parse(record.milestone_rewards);
          total += milestones.reduce((s: number, m: any) => s + m.points, 0);
        } catch (e) {}
      }
      return sum + total;
    }, 0);

    res.json({
      invitationCode: user.invitation_code,
      canGenerate: user.can_generate_invite,
      totalInvites: inviteStats.length,
      totalRewards,
      inviteRecords: inviteStats.map(record => ({
        inviteeUsername: record.invitee.username,
        inviteeWordCount: record.invitee.word_count,
        bonusPoints: record.bonus_points,
        milestoneRewards: record.milestone_rewards,
        invitedAt: record.created_at
      }))
    });
  } catch (error) {
    console.error('获取邀请码失败:', error);
    res.status(500).json({ error: '获取邀请码失败' });
  }
});

// 3. 【管理员】批量生成邀请码
router.post('/admin/generate', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const { count = 10, bonusPoints = 100, maxUses = 1, expiresInDays = 30 } = req.body;

    if (count < 1 || count > 100) {
      return res.status(400).json({ error: '生成数量必须在1-100之间' });
    }

    const codes = [];
    const expiresAt = expiresInDays > 0 
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    for (let i = 0; i < count; i++) {
      let code = generateInviteCode();
      
      // 确保不重复
      while (await prisma.invitation_codes.findUnique({ where: { code } })) {
        code = generateInviteCode();
      }

      const inviteCode = await prisma.invitation_codes.create({
        data: {
          code,
          created_by_id: req.userId,
          type: 'admin',
          bonus_points: bonusPoints,
          max_uses: maxUses,
          expires_at: expiresAt,
          is_active: true
        }
      });

      codes.push(inviteCode);
    }

    res.json({
      success: true,
      count: codes.length,
      codes: codes.map(c => ({
        code: c.code,
        bonusPoints: c.bonus_points,
        maxUses: c.max_uses,
        expiresAt: c.expires_at
      }))
    });
  } catch (error) {
    console.error('批量生成邀请码失败:', error);
    res.status(500).json({ error: '批量生成邀请码失败' });
  }
});

// 4. 【管理员】获取所有邀请码
router.get('/admin/codes', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const { page = 1, limit = 20, type, status } = req.query;

    const where: any = {};
    if (type) where.type = type;
    if (status === 'active') where.is_active = true;
    if (status === 'inactive') where.is_active = false;

    const total = await prisma.invitation_codes.count({ where });
    const codes = await prisma.invitation_codes.findMany({
      where,
      include: {
        created_by: {
          select: {
            id: true,
            username: true
          }
        }
      },
      orderBy: { created_at: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit)
    });

    res.json({
      codes,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('获取邀请码列表失败:', error);
    res.status(500).json({ error: '获取邀请码列表失败' });
  }
});

// 5. 【管理员】禁用/启用邀请码
router.patch('/admin/codes/:code/toggle', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const { code } = req.params;

    const inviteCode = await prisma.invitation_codes.findUnique({
      where: { code: code.toUpperCase() }
    });

    if (!inviteCode) {
      return res.status(404).json({ error: '邀请码不存在' });
    }

    const updated = await prisma.invitation_codes.update({
      where: { code: code.toUpperCase() },
      data: { is_active: !inviteCode.is_active }
    });

    res.json({
      success: true,
      code: updated.code,
      isActive: updated.is_active
    });
  } catch (error) {
    console.error('切换邀请码状态失败:', error);
    res.status(500).json({ error: '切换邀请码状态失败' });
  }
});

// 6. 【管理员】获取邀请统计
router.get('/admin/stats', authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const totalCodes = await prisma.invitation_codes.count();
    const activeCodes = await prisma.invitation_codes.count({
      where: { is_active: true }
    });
    const totalInvites = await prisma.invitation_records.count();
    
    // 最近30天的邀请趋势
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentInvites = await prisma.invitation_records.count({
      where: {
        created_at: { gte: thirtyDaysAgo }
      }
    });

    // Top邀请者
    const topInviters = await prisma.invitation_records.groupBy({
      by: ['inviter_id'],
      _count: { invitee_id: true },
      orderBy: { _count: { invitee_id: 'desc' } },
      take: 10
    });

    const topInvitersWithInfo = await Promise.all(
      topInviters.map(async (item) => {
        const user = await prisma.users.findUnique({
          where: { id: item.inviter_id },
          select: { username: true }
        });
        return {
          userId: item.inviter_id,
          username: user?.username,
          inviteCount: item._count.invitee_id
        };
      })
    );

    res.json({
      totalCodes,
      activeCodes,
      totalInvites,
      recentInvites,
      topInviters: topInvitersWithInfo
    });
  } catch (error) {
    console.error('获取邀请统计失败:', error);
    res.status(500).json({ error: '获取邀请统计失败' });
  }
});

export default router;

