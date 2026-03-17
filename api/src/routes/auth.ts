import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';
import {
  hashPassword,
  verifyPassword,
  generateJWT,
  generateToken,
  sendVerificationEmail,
  sendPasswordResetEmail,
  isValidEmail,
  isValidPassword,
  isValidUsername,
} from '../utils/auth';

const router = Router();

// 用户注册
router.post('/register', async (req, res) => {
  const { username, email, password, invitationCode } = req.body;

  // 验证输入
  if (!username || !email || !password) {
    return res.status(400).json({ error: '请填写所有必填字段' });
  }

  // 验证邮箱格式
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: '请输入有效的邮箱地址' });
  }

  // 验证用户名格式
  const usernameValid = isValidUsername(username);
  if (!usernameValid.valid) {
    return res.status(400).json({ error: usernameValid.message });
  }

  // 验证密码强度
  const passwordValid = isValidPassword(password);
  if (!passwordValid.valid) {
    return res.status(400).json({ error: passwordValid.message });
  }

  try {
    // 检查用户名和邮箱是否已存在
    const existingUser = await prisma.users.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ]
      }
    });

    if (existingUser) {
      if (existingUser.username === username) {
        return res.status(400).json({ error: '用户名已被使用' });
      }
      if (existingUser.email === email) {
        return res.status(400).json({ error: '邮箱已被注册' });
      }
    }

// 加密密码
    const hashedPassword = await hashPassword(password);

    // 生成邮箱验证 token
    const verificationToken = generateToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 小时

    // 验证邀请码（如果提供）
    let inviteCodeData = null;
    let inviterUser = null;
    if (invitationCode) {
      inviteCodeData = await prisma.invitation_codes.findUnique({
        where: { code: invitationCode.toUpperCase() }
      });

      if (!inviteCodeData) {
        return res.status(400).json({ error: '邀请码不存在' });
      }

      if (!inviteCodeData.is_active) {
        return res.status(400).json({ error: '邀请码已被禁用' });
      }

      if (inviteCodeData.expires_at && new Date(inviteCodeData.expires_at) < new Date()) {
        return res.status(400).json({ error: '邀请码已过期' });
      }

      // 检查使用次数（在事务中再次检查，防止并发）
      if (inviteCodeData.max_uses !== -1 && inviteCodeData.used_count >= inviteCodeData.max_uses) {
        return res.status(400).json({ error: '邀请码已达到最大使用次数' });
      }

      // 获取邀请人信息
      inviterUser = await prisma.users.findUnique({
        where: { id: inviteCodeData.created_by_id }
      });
    }

    // 使用事务创建用户并处理邀请奖励
    const result = await prisma.$transaction(async (tx) => {
      // 创建用户
      const user = await tx.users.create({
        data: {
          username,
          email,
          password: hashedPassword,
          emailVerificationToken: verificationToken,
          emailVerificationExpires: verificationExpires,
          invited_by_code: invitationCode?.toUpperCase() || null,
          points: inviteCodeData ? inviteCodeData.bonus_points : 0, // 新用户获得奖励积分
          updatedAt: new Date(),
        },
        select: {
          id: true,
          username: true,
          email: true,
          avatar: true,
          bio: true,
          emailVerified: true,
          points: true,
          createdAt: true,
        }
      });

      // 如果使用了邀请码，处理邀请奖励
      if (inviteCodeData && inviterUser) {
        // 使用乐观锁更新邀请码使用次数
        try {
          await tx.invitation_codes.update({
            where: { 
              code: inviteCodeData.code,
              used_count: inviteCodeData.used_count // 乐观锁：确保使用次数未变
            },
            data: { 
              used_count: { increment: 1 }
            }
          });
        } catch (error: any) {
          // 如果更新失败（可能是并发导致），再次检查
          if (error?.code === 'P2025') {
            const recheck = await tx.invitation_codes.findUnique({
              where: { code: inviteCodeData.code }
            });
            if (recheck && recheck.max_uses !== -1 && recheck.used_count >= recheck.max_uses) {
              throw new Error('邀请码已达到最大使用次数');
            }
          }
          throw error;
        }

        // 给邀请人奖励积分（新用户奖励的 50%）
        const inviterReward = Math.floor(inviteCodeData.bonus_points * 0.5);
        await tx.users.update({
          where: { id: inviterUser.id },
          data: { points: { increment: inviterReward } }
        });

        // 记录邀请关系
        await tx.invitation_records.create({
          data: {
            inviter_id: inviterUser.id,
            invitee_id: user.id,
            invitation_code: inviteCodeData.code,
            bonus_points: inviteCodeData.bonus_points
          }
        });

        // 给邀请人发送通知
        await tx.notifications.create({
          data: {
            user_id: inviterUser.id,
            type: 'invitation_success',
            title: '邀请成功',
            content: `用户 ${username} 通过你的邀请码注册成功，你获得了 ${inviterReward} 积分奖励！`,
            link: '/profile'
          }
        });

        // 记录邀请人的积分交易
        await tx.point_transactions.create({
          data: {
            user_id: inviterUser.id,
            amount: inviterReward,
            type: 'invitation_reward',
            description: `邀请用户 ${username} 注册`,
            reference_id: user.id
          }
        });

        // 记录新用户的积分交易
        await tx.point_transactions.create({
          data: {
            user_id: user.id,
            amount: inviteCodeData.bonus_points,
            type: 'registration_bonus',
            description: `使用邀请码 ${inviteCodeData.code} 注册`,
            reference_id: inviterUser.id
          }
        });
      }

      return user;
    });

    // 发送验证邮件（异步，不阻塞响应）
    sendVerificationEmail(email, verificationToken).catch(err => {
      console.error('发送验证邮件失败:', err);
    });

    res.status(201).json({
      message: inviteCodeData 
        ? `注册成功！你获得了 ${inviteCodeData.bonus_points} 积分奖励，请查收验证邮件`
        : '注册成功，请查收验证邮件',
      user: result,
      token: generateJWT(result.id, result.username)
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ error: '注册失败，请稍后重试' });
  }
});

// 用户登录
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: '请填写邮箱和密码' });
  }

  try {
    const user = await prisma.users.findUnique({
      where: { email },
      select: {
        id: true,
        username: true,
        email: true,
        password: true,
        avatar: true,
        bio: true,
        emailVerified: true,
        createdAt: true,
      }
    });

    if (!user) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    const isPasswordValid = await verifyPassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    res.json({
      message: '登录成功',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
      token: generateJWT(user.id, user.username)
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

// 获取当前用户信息
router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this') as { userId: number };
    
    const user = await prisma.users.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        bio: true,
        emailVerified: true,
        points: true,
        word_count: true,
        makeup_chances: true,
        badges: true,
        level: true,
        createdAt: true,
      }
    });

    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }

    res.json({ user });
  } catch (error) {
    return res.status(401).json({ error: '无效的认证令牌' });
  }
});

// 密码重置 - 发送重置邮件
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: '请提供邮箱地址' });
  }

  try {
    const user = await prisma.users.findUnique({
      where: { email }
    });

    if (!user) {
      // 不暴露用户是否存在
      return res.json({ message: '如果邮箱存在，重置邮件已发送' });
    }

    const resetToken = generateToken();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1小时

    await prisma.users.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      }
    });

    await sendPasswordResetEmail(email, resetToken);

    res.json({ message: '重置邮件已发送，请检查邮箱' });
  } catch (error) {
    console.error('密码重置错误:', error);
    res.status(500).json({ error: '发送邮件失败，请稍后重试' });
  }
});

// 密码重置 - 验证token并重置密码
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: '请提供重置令牌和新密码' });
  }

  // 验证密码强度
  const passwordValid = isValidPassword(newPassword);
  if (!passwordValid.valid) {
    return res.status(400).json({ error: passwordValid.message });
  }

  try {
    const user = await prisma.users.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: {
          gt: new Date()
        }
      }
    });

    if (!user) {
      return res.status(400).json({ error: '重置链接无效或已过期' });
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.users.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      }
    });

    res.json({ message: '密码重置成功' });
  } catch (error) {
    console.error('重置密码错误:', error);
    res.status(500).json({ error: '密码重置失败，请稍后重试' });
  }
});

// 邮箱验证 - 验证token
router.post('/verify-email', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: '请提供验证令牌' });
  }

  try {
    const user = await prisma.users.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: {
          gt: new Date()
        }
      }
    });

    if (!user) {
      return res.status(400).json({ error: '验证链接无效或已过期' });
    }

    // 如果已经验证过，直接返回成功
    if (user.emailVerified) {
      return res.json({ message: '邮箱已验证' });
    }

    // 更新用户邮箱验证状态
    await prisma.users.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      }
    });

    res.json({ message: '邮箱验证成功' });
  } catch (error) {
    console.error('邮箱验证错误:', error);
    res.status(500).json({ error: '邮箱验证失败，请稍后重试' });
  }
});

// 重新发送验证邮件
router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: '请提供邮箱地址' });
  }

  try {
    const user = await prisma.users.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: '邮箱已验证，无需重复验证' });
    }

    // 生成新的验证token
    const verificationToken = generateToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时

    await prisma.users.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      }
    });

    await sendVerificationEmail(email, verificationToken);

    res.json({ message: '验证邮件已重新发送，请检查邮箱' });
  } catch (error) {
    console.error('重发验证邮件错误:', error);
    res.status(500).json({ error: '发送邮件失败，请稍后重试' });
  }
});

export default router;