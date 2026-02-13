import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// 邮件配置
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// JWT配置
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const JWT_EXPIRES_IN = '7d';

// 生成随机token
export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// 加密密码
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// 验证密码
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// 生成JWT token
export function generateJWT(userId: number, username?: string, isAdmin?: boolean): string {
  return jwt.sign({ userId, username, isAdmin: isAdmin || false }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// 验证JWT token
export function verifyJWT(token: string): { userId: number; username?: string; isAdmin?: boolean } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      userId: decoded.userId,
      username: decoded.username,
      isAdmin: decoded.isAdmin || false
    };
  } catch {
    return null;
  }
}

// 发送验证邮件
export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/verify-email/${token}`;
  
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@storytree.com',
    to: email,
    subject: 'StoryTree - 邮箱验证',
    html: `
      <h2>欢迎注册 StoryTree！</h2>
      <p>请点击下面的链接验证你的邮箱：</p>
      <a href="${verificationUrl}" style="background: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">验证邮箱</a>
      <p>如果链接无法点击，请复制以下地址到浏览器：</p>
      <p>${verificationUrl}</p>
      <p>此链接将在24小时后过期。</p>
    `,
  });
}

// 发送密码重置邮件
export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/reset-password/${token}`;
  
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@storytree.com',
    to: email,
    subject: 'StoryTree - 密码重置',
    html: `
      <h2>密码重置请求</h2>
      <p>我们收到了你的密码重置请求。请点击下面的链接重置密码：</p>
      <a href="${resetUrl}" style="background: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">重置密码</a>
      <p>如果链接无法点击，请复制以下地址到浏览器：</p>
      <p>${resetUrl}</p>
      <p>此链接将在1小时后过期。</p>
      <p>如果你没有请求重置密码，请忽略此邮件。</p>
    `,
  });
}

// 验证邮箱格式
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// 验证密码强度
export function isValidPassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 6) {
    return { valid: false, message: '密码长度至少为6位' };
  }
  if (password.length > 128) {
    return { valid: false, message: '密码长度不能超过128位' };
  }
  return { valid: true };
}

// 验证用户名格式
export function isValidUsername(username: string): { valid: boolean; message?: string } {
  if (username.length < 3) {
    return { valid: false, message: '用户名长度至少为3位' };
  }
  if (username.length > 20) {
    return { valid: false, message: '用户名长度不能超过20位' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { valid: false, message: '用户名只能包含字母、数字、下划线和连字符' };
  }
  return { valid: true };
}
