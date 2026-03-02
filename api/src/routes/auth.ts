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

    // 创建用户
    const user = await prisma.users.create({
      data: {
        username,
        email,
        password: hashedPassword,
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

    res.status(201).json({
      message: '注册成功',
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

export default router;