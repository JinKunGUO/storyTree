import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../index';
import { getMembershipTier, MEMBERSHIP_TIERS } from '../utils/membership';
import { authenticateToken, getActiveUserIdFromReq } from '../utils/middleware';
import { createNotification } from './notifications';

const router = Router();
const getUserId = (req: any): Promise<number | null> => getActiveUserIdFromReq(req);

const MAX_TEAM_SIZE = 5;

// ========== 邀请链接 ==========

/**
 * POST /api/team/invite
 * 生成邀请链接（仅企业版主账号）
 */
router.post('/invite', authenticateToken, async (req: any, res) => {
  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: '未登录' });

  try {
    const membership = await getMembershipTier(userId);
    if (!membership.isActive || membership.tier !== 'enterprise') {
      return res.status(403).json({ error: '仅企业版用户可邀请团队成员' });
    }

    // 检查当前席位
    const activeCount = await prisma.team_memberships.count({
      where: { owner_user_id: userId, status: { in: ['active', 'pending'] } }
    });

    if (activeCount >= MAX_TEAM_SIZE) {
      return res.status(403).json({ error: `团队席位已满（${MAX_TEAM_SIZE}/${MAX_TEAM_SIZE}）` });
    }

    const { email } = req.body;
    if (email && typeof email !== 'string') {
      return res.status(400).json({ error: '邮箱格式无效' });
    }

    // 检查是否已邀请过该邮箱
    if (email) {
      const existing = await prisma.team_memberships.findFirst({
        where: { owner_user_id: userId, invited_email: email, status: { in: ['active', 'pending'] } }
      });
      if (existing) {
        return res.status(400).json({ error: '该邮箱已被邀请或已是团队成员' });
      }
    }

    // 检查是否已是自己的子账号
    if (email) {
      const existingUser = await prisma.users.findUnique({ where: { email } });
      if (existingUser) {
        const alreadyMember = await prisma.team_memberships.findFirst({
          where: { owner_user_id: userId, member_user_id: existingUser.id, status: 'active' }
        });
        if (alreadyMember) {
          return res.status(400).json({ error: '该用户已是团队成员' });
        }
        if (existingUser.id === userId) {
          return res.status(400).json({ error: '不能邀请自己' });
        }
      }
    }

    const inviteToken = crypto.randomBytes(16).toString('hex');

    await prisma.team_memberships.create({
      data: {
        owner_user_id: userId,
        member_user_id: userId, // 占位，接受邀请时更新
        status: 'pending',
        invited_email: email || null,
        invite_token: inviteToken,
        invited_at: new Date()
      }
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const inviteLink = `${frontendUrl}/register.html?teamInvite=${inviteToken}`;

    res.json({ inviteLink, inviteToken, remainingSlots: MAX_TEAM_SIZE - activeCount - 1 });
  } catch (error) {
    console.error('生成邀请链接失败:', error);
    res.status(500).json({ error: '生成邀请链接失败' });
  }
});

// ========== 接受邀请 ==========

/**
 * POST /api/team/accept-invite
 * 接受团队邀请（注册时或登录后调用）
 */
router.post('/accept-invite', authenticateToken, async (req: any, res) => {
  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: '未登录' });

  const { inviteToken } = req.body;
  if (!inviteToken) return res.status(400).json({ error: '缺少邀请令牌' });

  try {
    const invitation = await prisma.team_memberships.findUnique({
      where: { invite_token: inviteToken }
    });

    if (!invitation) {
      return res.status(404).json({ error: '邀请链接不存在' });
    }
    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: '邀请已失效或已被使用' });
    }

    // 不能接受自己的邀请
    if (invitation.owner_user_id === userId) {
      return res.status(400).json({ error: '不能接受自己的邀请' });
    }

    // 检查是否已是其他团队的子账号
    const alreadyMember = await prisma.team_memberships.findFirst({
      where: { member_user_id: userId, status: 'active' }
    });
    if (alreadyMember) {
      return res.status(400).json({ error: '您已是其他团队的成员，请先退出再接受新邀请' });
    }

    // 检查邮箱匹配（如果邀请时指定了邮箱）
    if (invitation.invited_email) {
      const user = await prisma.users.findUnique({ where: { id: userId }, select: { email: true } });
      if (user?.email !== invitation.invited_email) {
        return res.status(403).json({ error: '您的邮箱与邀请邮箱不匹配，请使用被邀请的邮箱登录' });
      }
    }

    // 检查主账号是否仍是企业版
    const ownerMembership = await getMembershipTier(invitation.owner_user_id);
    if (!ownerMembership.isActive || ownerMembership.tier !== 'enterprise') {
      return res.status(400).json({ error: '邀请人的企业版已过期，无法加入团队' });
    }

    // 检查席位
    const activeCount = await prisma.team_memberships.count({
      where: { owner_user_id: invitation.owner_user_id, status: 'active' }
    });
    if (activeCount >= MAX_TEAM_SIZE) {
      return res.status(400).json({ error: '团队席位已满' });
    }

    // 接受邀请：更新记录
    await prisma.team_memberships.update({
      where: { invite_token: inviteToken },
      data: {
        member_user_id: userId,
        status: 'active',
        accepted_at: new Date()
      }
    });

    await createNotification(
      userId,
      'team_joined',
      '已加入团队',
      '您已成功加入团队，享有企业版全部权益',
      '/profile.html'
    );

    await createNotification(
      invitation.owner_user_id,
      'team_member_joined',
      '新成员加入',
      '有新成员接受了您的团队邀请',
      '/profile.html'
    );

    res.json({ success: true, message: '已成功加入团队' });
  } catch (error) {
    console.error('接受邀请失败:', error);
    res.status(500).json({ error: '接受邀请失败' });
  }
});

// ========== 团队管理 ==========

/**
 * GET /api/team/members
 * 获取团队成员列表（仅主账号）
 */
router.get('/members', authenticateToken, async (req: any, res) => {
  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: '未登录' });

  try {
    const membership = await getMembershipTier(userId);
    if (!membership.isActive || membership.tier !== 'enterprise') {
      return res.status(403).json({ error: '仅企业版用户可查看团队' });
    }

    const members = await prisma.team_memberships.findMany({
      where: { owner_user_id: userId },
      include: {
        member: {
          select: { id: true, username: true, avatar: true, email: true, level: true, points: true }
        }
      },
      orderBy: { invited_at: 'desc' }
    });

    res.json({
      members: members.map(m => ({
        id: m.id,
        userId: m.member_user_id,
        username: m.member.username,
        avatar: m.member.avatar,
        email: m.member.email,
        level: m.member.level,
        points: m.member.points,
        status: m.status,
        invitedEmail: m.invited_email,
        invitedAt: m.invited_at,
        acceptedAt: m.accepted_at
      })),
      totalSlots: MAX_TEAM_SIZE,
      usedSlots: members.filter(m => m.status === 'active').length
    });
  } catch (error) {
    console.error('获取团队成员失败:', error);
    res.status(500).json({ error: '获取团队成员失败' });
  }
});

/**
 * DELETE /api/team/members/:memberId
 * 移除子账号（仅主账号）
 */
router.delete('/members/:memberId', authenticateToken, async (req: any, res) => {
  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: '未登录' });

  try {
    const membership = await getMembershipTier(userId);
    if (!membership.isActive || membership.tier !== 'enterprise') {
      return res.status(403).json({ error: '仅企业版用户可管理团队' });
    }

    const record = await prisma.team_memberships.findFirst({
      where: { id: parseInt(req.params.memberId), owner_user_id: userId }
    });

    if (!record) {
      return res.status(404).json({ error: '成员不存在' });
    }

    await prisma.team_memberships.update({
      where: { id: record.id },
      data: { status: 'removed' }
    });

    await createNotification(
      record.member_user_id,
      'team_removed',
      '已被移出团队',
      '您已被移出团队，企业版权益已失效，降级为免费用户',
      '/membership.html'
    );

    res.json({ success: true });
  } catch (error) {
    console.error('移除成员失败:', error);
    res.status(500).json({ error: '移除成员失败' });
  }
});

/**
 * GET /api/team/member-stories/:memberUserId
 * 主账号查看子账号的故事（只读）
 */
router.get('/member-stories/:memberUserId', authenticateToken, async (req: any, res) => {
  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: '未登录' });

  try {
    const membership = await getMembershipTier(userId);
    if (!membership.isActive || membership.tier !== 'enterprise') {
      return res.status(403).json({ error: '仅企业版用户可查看团队成员内容' });
    }

    const memberUserId = parseInt(req.params.memberUserId);

    // 确认是团队成员
    const memberRecord = await prisma.team_memberships.findFirst({
      where: { owner_user_id: userId, member_user_id: memberUserId, status: 'active' }
    });
    if (!memberRecord) {
      return res.status(403).json({ error: '该用户不是您的团队成员' });
    }

    const stories = await prisma.stories.findMany({
      where: { author_id: memberUserId },
      include: {
        _count: { select: { nodes: true, followers: true } }
      },
      orderBy: { updated_at: 'desc' },
      take: 50
    });

    res.json({ stories });
  } catch (error) {
    console.error('查看成员故事失败:', error);
    res.status(500).json({ error: '查看成员故事失败' });
  }
});

/**
 * GET /api/team/status
 * 获取当前用户的团队状态（主账号/子账号/非团队）
 */
router.get('/status', authenticateToken, async (req: any, res) => {
  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: '未登录' });

  try {
    // 检查是否是主账号
    const asOwner = await prisma.team_memberships.findFirst({
      where: { owner_user_id: userId, status: { in: ['active', 'pending'] } }
    });

    // 检查是否是子账号
    const asMember = await prisma.team_memberships.findFirst({
      where: { member_user_id: userId, status: 'active' },
      include: {
        owner: { select: { id: true, username: true } }
      }
    });

    if (asOwner) {
      const activeCount = await prisma.team_memberships.count({
        where: { owner_user_id: userId, status: 'active' }
      });
      res.json({
        role: 'owner',
        activeMembers: activeCount,
        totalSlots: MAX_TEAM_SIZE
      });
    } else if (asMember) {
      res.json({
        role: 'member',
        owner: { id: asMember.owner.id, username: asMember.owner.username }
      });
    } else {
      res.json({ role: 'none' });
    }
  } catch (error) {
    console.error('获取团队状态失败:', error);
    res.status(500).json({ error: '获取团队状态失败' });
  }
});

export default router;
