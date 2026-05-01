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

  // 验证必填字段：用户名必须提供；email/password 为可选（微信用户可不填）
  if (!username) {
    return res.status(400).json({ error: '请填写用户名' });
  }

  // 如果提供了邮箱，必须同时提供密码，且格式合法
  if (email && !password) {
    return res.status(400).json({ error: '使用邮箱注册时请同时填写密码' });
  }
  if (!email && password) {
    return res.status(400).json({ error: '使用密码注册时请同时填写邮箱' });
  }

  // 验证邮箱格式
  if (email && !isValidEmail(email)) {
    return res.status(400).json({ error: '请输入有效的邮箱地址' });
  }

  // 验证用户名格式
  const usernameValid = isValidUsername(username);
  if (!usernameValid.valid) {
    return res.status(400).json({ error: usernameValid.message });
  }

  // 验证密码强度
  if (password) {
    const passwordValid = isValidPassword(password);
    if (!passwordValid.valid) {
      return res.status(400).json({ error: passwordValid.message });
    }
  }

  try {
    // 检查用户名是否已存在
    const existingByUsername = await prisma.users.findUnique({ where: { username } });
    if (existingByUsername) {
      return res.status(400).json({ error: '用户名已被使用' });
    }

    // 检查邮箱是否已存在（仅当提供了邮箱时）
    if (email) {
      const existingByEmail = await prisma.users.findUnique({ where: { email } });
      if (existingByEmail) {
        return res.status(400).json({ error: '邮箱已被注册' });
      }
    }

    // 加密密码（仅当提供了密码时）
    const hashedPassword = password ? await hashPassword(password) : null;

    // 生成邮箱验证 token（仅当提供了邮箱时）
    const verificationToken = email ? generateToken() : null;
    const verificationExpires = email ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null; // 24 小时

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
          email: email || null,
          password: hashedPassword,
          emailVerified: !email, // 无邮箱用户直接标记为已验证
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

    // 发送验证邮件（仅当提供了邮箱时，异步，不阻塞响应）
    if (email && verificationToken) {
      sendVerificationEmail(email, verificationToken).catch(err => {
        console.error('发送验证邮件失败:', err);
      });
    }

    res.status(201).json({
      message: inviteCodeData
        ? `注册成功！你获得了 ${inviteCodeData.bonus_points} 积分奖励${email ? '，请查收验证邮件' : ''}`
        : email ? '注册成功，请查收验证邮件' : '注册成功',
      user: result,
      token: await (async () => {
        const t = generateJWT(result.id, result.username, false, 'web');
        await prisma.users.update({ where: { id: result.id }, data: { active_token: t } });
        return t;
      })()
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
        emailVerificationToken: true,
        emailVerificationExpires: true,
        points: true,
        word_count: true,
        consecutive_days: true,
        makeup_chances: true,
        badges: true,
        level: true,
        membership_tier: true,
        membership_expires_at: true,
        isAdmin: true,
        createdAt: true,
      }
    });

    if (!user) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    const isPasswordValid = await verifyPassword(password, user.password!);
    if (!isPasswordValid) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    // 检查邮箱是否已验证
    if (!user.emailVerified) {
      // 检查是否已有未过期的验证 token，有则复用，避免覆盖导致用户手中的旧链接失效
      const hasValidToken = user.emailVerificationToken && 
        user.emailVerificationExpires && 
        new Date(user.emailVerificationExpires) > new Date();

      let tokenToSend: string;

      if (hasValidToken) {
        // 复用已有的未过期 token，直接重发邮件
        tokenToSend = user.emailVerificationToken!;
      } else {
        // token 不存在或已过期，生成新的
        tokenToSend = generateToken();
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时
        await prisma.users.update({
          where: { id: user.id },
          data: {
            emailVerificationToken: tokenToSend,
            emailVerificationExpires: verificationExpires,
          }
        });
      }

      // 异步发送验证邮件，不阻塞响应
      sendVerificationEmail(user.email!, tokenToSend).catch(err => {
        console.error('重发验证邮件失败:', err);
      });

      return res.status(403).json({
        error: '邮箱尚未验证，请查收验证邮件后再登录',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
      });
    }

    // 生成新 token 并写入 active_token（同时使其他端旧 token 失效）
    const token = generateJWT(user.id, user.username, user.isAdmin, 'web');
    await prisma.users.update({ where: { id: user.id }, data: { active_token: token } });

    res.json({
      message: '登录成功',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        emailVerified: user.emailVerified,
        points: user.points,
        word_count: user.word_count,
        consecutive_days: user.consecutive_days,
        makeup_chances: user.makeup_chances,
        badges: user.badges,
        level: user.level,
        membership_tier: user.membership_tier,
        membership_expires_at: user.membership_expires_at,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt,
      },
      token
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
        consecutive_days: true,
        makeup_chances: true,
        badges: true,
        level: true,
        membership_tier: true,
        membership_expires_at: true,
        isAdmin: true,
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
      },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        bio: true,
        emailVerified: true,
        isAdmin: true,
        points: true,
        level: true,
        membership_tier: true,
        membership_expires_at: true,
        createdAt: true,
      }
    });

    if (!user) {
      return res.status(400).json({ error: '验证链接无效或已过期' });
    }

    // 如果已经验证过，也生成 token 让用户直接登录
    if (!user.emailVerified) {
      // 更新用户邮箱验证状态
      await prisma.users.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
        }
      });
    }

    // 生成 JWT token，让用户验证邮箱后直接以已登录状态进入
    const jwtToken = generateJWT(user.id, user.username, user.isAdmin, 'web');
    await prisma.users.update({
      where: { id: user.id },
      data: { active_token: jwtToken }
    });

    res.json({
      message: '邮箱验证成功',
      token: jwtToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        emailVerified: true,
        points: user.points,
        level: user.level,
        membership_tier: user.membership_tier,
        membership_expires_at: user.membership_expires_at,
        createdAt: user.createdAt,
      }
    });
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

// ============================================================
// 微信小程序登录
// POST /api/auth/wx-login
// body: { code, invitationCode? }
// 流程：code → 微信换取 openid → 查找/创建用户 → 返回 JWT
// ============================================================
router.post('/wx-login', async (req, res) => {
  const { code, invitationCode } = req.body;

  if (!code) {
    return res.status(400).json({ error: '缺少微信登录 code' });
  }

  const appId = process.env.WX_APPID;
  const appSecret = process.env.WX_APP_SECRET;

  if (!appId || !appSecret) {
    return res.status(500).json({ error: '服务端未配置微信 AppID/AppSecret' });
  }

  try {
    // 1. 用 code 换取 openid + session_key
    const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;
    const wxRes = await fetch(wxUrl);
    const wxData = await wxRes.json() as any;

    if (wxData.errcode) {
      console.error('微信 code2session 失败:', wxData);
      return res.status(400).json({ error: `微信登录失败: ${wxData.errmsg || wxData.errcode}` });
    }

    const { openid, unionid } = wxData;

    // 2. 查找已绑定该 openid 的用户
    let user = await prisma.users.findUnique({
      where: { wx_openid: openid },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        bio: true,
        emailVerified: true,
        points: true,
        level: true,
        membership_tier: true,
        membership_expires_at: true,
        createdAt: true,
      }
    });

    let isNewUser = false;

    if (!user) {
      // 3. 新用户：自动注册
      isNewUser = true;

      // 生成唯一用户名（wx_ + openid 后8位）
      const baseUsername = `wx_${openid.slice(-8)}`;
      let username = baseUsername;
      let suffix = 1;
      while (await prisma.users.findUnique({ where: { username } })) {
        username = `${baseUsername}_${suffix++}`;
      }

      // 处理邀请码
      let inviteCodeData = null;
      let inviterUser = null;
      if (invitationCode) {
        inviteCodeData = await prisma.invitation_codes.findUnique({
          where: { code: invitationCode.toUpperCase() }
        });
        if (inviteCodeData?.is_active) {
          inviterUser = await prisma.users.findUnique({
            where: { id: inviteCodeData.created_by_id }
          });
        }
      }

      const newUser = await prisma.$transaction(async (tx) => {
        const created = await tx.users.create({
          data: {
            username,
            email: null,      // 微信用户无邮箱
            password: null,   // 微信用户无密码
            wx_openid: openid,
            wx_unionid: unionid || null,
            emailVerified: true, // 微信登录视为已验证
            points: inviteCodeData ? inviteCodeData.bonus_points : 0,
            invited_by_code: invitationCode?.toUpperCase() || null,
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
            level: true,
            membership_tier: true,
            membership_expires_at: true,
            createdAt: true,
          }
        });

        // 邀请码奖励
        if (inviteCodeData && inviterUser) {
          const inviterReward = Math.floor(inviteCodeData.bonus_points * 0.5);
          await tx.invitation_codes.update({
            where: { code: inviteCodeData.code },
            data: { used_count: { increment: 1 } }
          });
          await tx.users.update({
            where: { id: inviterUser.id },
            data: { points: { increment: inviterReward } }
          });
          await tx.invitation_records.create({
            data: {
              inviter_id: inviterUser.id,
              invitee_id: created.id,
              invitation_code: inviteCodeData.code,
              bonus_points: inviteCodeData.bonus_points
            }
          });
          await tx.notifications.create({
            data: {
              user_id: inviterUser.id,
              type: 'invitation_success',
              title: '邀请成功',
              content: `用户 ${username} 通过你的邀请码注册成功，你获得了 ${inviterReward} 积分奖励！`,
              link: '/profile'
            }
          });
        }

        return created;
      });

      user = newUser;
    } else {
      // 4. 老用户：更新 unionid（如果之前没有）
      if (unionid && !await prisma.users.findUnique({ where: { wx_unionid: unionid } })) {
        await prisma.users.update({
          where: { id: user.id },
          data: { wx_unionid: unionid }
        });
      }
    }

    res.json({
      message: isNewUser ? '注册并登录成功' : '登录成功',
      isNewUser,
      user,
      token: await (async () => {
        const t = generateJWT(user!.id, user!.username, false, 'miniprogram');
        await prisma.users.update({ where: { id: user!.id }, data: { active_token: t } });
        return t;
      })()
    });
  } catch (error) {
    console.error('微信登录错误:', error);
    res.status(500).json({ error: '微信登录失败，请稍后重试' });
  }
});

// ============================================================
// 绑定微信到已有账号
// POST /api/auth/bind-wx
// header: Authorization: Bearer <token>
// body: { code }
// ============================================================
router.post('/bind-wx', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: '缺少微信登录 code' });
  }

  const appId = process.env.WX_APPID;
  const appSecret = process.env.WX_APP_SECRET;

  if (!appId || !appSecret) {
    return res.status(500).json({ error: '服务端未配置微信 AppID/AppSecret' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this') as { userId: number };

    const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;
    const wxRes = await fetch(wxUrl);
    const wxData = await wxRes.json() as any;

    if (wxData.errcode) {
      return res.status(400).json({ error: `微信绑定失败: ${wxData.errmsg || wxData.errcode}` });
    }

    const { openid, unionid } = wxData;

    // 检查 openid 是否已被其他账号绑定
    const existing = await prisma.users.findUnique({ where: { wx_openid: openid } });
    if (existing && existing.id !== decoded.userId) {
      return res.status(409).json({ error: '该微信号已绑定其他账号' });
    }

    await prisma.users.update({
      where: { id: decoded.userId },
      data: {
        wx_openid: openid,
        wx_unionid: unionid || undefined,
      }
    });

    res.json({ message: '微信绑定成功' });
  } catch (error) {
    console.error('绑定微信错误:', error);
    res.status(500).json({ error: '绑定失败，请稍后重试' });
  }
});

// ============================================================
// 微信网页端扫码登录（微信开放平台 OAuth2.0）
// POST /api/auth/wx-web-login
// body: { code }
// 流程：code → 微信开放平台换取 access_token + openid + unionid → 查找/创建用户 → 返回 JWT
// 注意：此接口使用微信开放平台 AppID（非小程序 AppID）
// ============================================================
router.post('/wx-web-login', async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: '缺少微信授权 code' });
  }

  // 只使用微信开放平台"网站应用"的凭证，不 fallback 到小程序凭证
  const appId = process.env.WX_WEB_APPID;
  const appSecret = process.env.WX_WEB_APP_SECRET;

  if (!appId || !appSecret) {
    return res.status(500).json({ error: '服务端未配置微信网页端 AppID/AppSecret' });
  }

  try {
    // 1. 用 code 换取 access_token + openid + unionid（微信开放平台接口）
    const tokenUrl = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${appSecret}&code=${code}&grant_type=authorization_code`;
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json() as any;

    if (tokenData.errcode) {
      console.error('微信网页授权失败:', tokenData);
      return res.status(400).json({ error: `微信授权失败: ${tokenData.errmsg || tokenData.errcode}` });
    }

    const { openid, unionid, access_token } = tokenData;

    if (!openid) {
      return res.status(400).json({ error: '未能获取微信用户标识' });
    }

    // 2. 获取微信用户基本信息（昵称、头像）
    let wxNickname: string | null = null;
    let wxAvatar: string | null = null;
    try {
      const userInfoUrl = `https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}&lang=zh_CN`;
      const userInfoRes = await fetch(userInfoUrl);
      const userInfo = await userInfoRes.json() as any;
      if (!userInfo.errcode) {
        wxNickname = userInfo.nickname || null;
        wxAvatar = userInfo.headimgurl || null;
      }
    } catch (e) {
      console.warn('获取微信用户信息失败（非致命）:', e);
    }

    // 3. 优先通过 unionid 查找用户（打通小程序与网页端）
    let user = null;
    if (unionid) {
      user = await prisma.users.findUnique({
        where: { wx_unionid: unionid },
        select: {
          id: true, username: true, email: true, avatar: true, bio: true,
          emailVerified: true, points: true, level: true,
          membership_tier: true, membership_expires_at: true, createdAt: true,
        }
      });
    }

    // 4. 再通过 openid 查找（兜底）
    if (!user) {
      user = await prisma.users.findUnique({
        where: { wx_openid: openid },
        select: {
          id: true, username: true, email: true, avatar: true, bio: true,
          emailVerified: true, points: true, level: true,
          membership_tier: true, membership_expires_at: true, createdAt: true,
        }
      });
    }

    let isNewUser = false;

    if (!user) {
      // 5. 新用户：自动注册
      isNewUser = true;

      const baseUsername = `wx_${openid.slice(-8)}`;
      let username = baseUsername;
      let suffix = 1;
      while (await prisma.users.findUnique({ where: { username } })) {
        username = `${baseUsername}_${suffix++}`;
      }

      const newUser = await prisma.users.create({
        data: {
          username,
          email: null,
          password: null,
          wx_openid: openid,
          wx_unionid: unionid || null,
          wx_nickname: wxNickname,
          wx_avatar: wxAvatar,
          emailVerified: true,
          updatedAt: new Date(),
        },
        select: {
          id: true, username: true, email: true, avatar: true, bio: true,
          emailVerified: true, points: true, level: true,
          membership_tier: true, membership_expires_at: true, createdAt: true,
        }
      });

      user = newUser;
    } else {
      // 6. 老用户：更新 openid/unionid/昵称/头像（如有变化）
      await prisma.users.update({
        where: { id: user.id },
        data: {
          wx_openid: openid,
          wx_unionid: unionid || undefined,
          wx_nickname: wxNickname || undefined,
          wx_avatar: wxAvatar || undefined,
        }
      });
    }

    const token = generateJWT(user.id, user.username, false, 'web');
    await prisma.users.update({ where: { id: user.id }, data: { active_token: token } });

    res.json({
      message: isNewUser ? '注册并登录成功' : '登录成功',
      isNewUser,
      user,
      token,
    });
  } catch (error) {
    console.error('微信网页登录错误:', error);
    res.status(500).json({ error: '微信登录失败，请稍后重试' });
  }
});

// ============================================================
// 获取微信网页端公开配置（AppID 非敏感，可暴露给前端）
// GET /api/auth/wx-web-config
// ============================================================
router.get('/wx-web-config', (req, res) => {
  // 只使用微信开放平台"网站应用"的 AppID，绝不 fallback 到小程序 AppID
  // 两者是完全不同的应用类型，混用会导致微信报"AppID 参数错误"
  const appId = process.env.WX_WEB_APPID || '';
  res.json({
    wxWebAppId: appId,
    enabled: !!appId,
  });
});

export default router;