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
  const { username, email, password } = req.body;

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

    // 生成邮箱验证token
    const verificationToken = generateToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时

    // 创建用户
    const user = await prisma.users.create({
      data: {
        username,
        email,
        password: hashedPassword,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        bio: true,
        emailVerified: true,
        createdAt: true,
      }
    });

    // 发送验证邮件（异步，不阻塞响应）
    sendVerificationEmail(email, verificationToken).catch(err => {
      console.error('发送验证邮件失败:', err);
    });

    res.status(201).json({
      message: '注册成功，请查收验证邮件',
      user,
      token: generateJWT(user.id, user.username)
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