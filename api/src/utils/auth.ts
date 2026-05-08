import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// 占位符列表，这些值视为"未配置"
const PLACEHOLDER_VALUES = [
  'your-email@gmail.com',
  'your-email-password-or-app-password',
  'YOUR_EMAIL@qq.com',
  'YOUR_QQ_EMAIL_AUTH_CODE',
  '',
];

// 检查是否为开发模式（SMTP 未真实配置）
const smtpUser = process.env.SMTP_USER || '';
const smtpPass = process.env.SMTP_PASS || '';
// 新增：DISABLE_EMAIL=true 时强制使用开发模式（邮件输出到控制台）
const forceDevMode = process.env.DISABLE_EMAIL === 'true';
const isDevelopmentMode =
  forceDevMode ||
  !smtpUser ||
  !smtpPass ||
  PLACEHOLDER_VALUES.includes(smtpUser) ||
  PLACEHOLDER_VALUES.includes(smtpPass);

// 邮件配置
let transporter: nodemailer.Transporter | null = null;

if (!isDevelopmentMode) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
  console.log(`[邮件服务] SMTP 已配置，使用 ${smtpUser} 发送邮件`);
} else {
  console.log('[邮件服务] SMTP 未配置，邮件将输出到控制台（开发模式）');
}

// JWT配置
const DEFAULT_JWT_SECRETS = [
  'your-secret-key-change-this',
  'secret',
  'jwt-secret',
  'your-jwt-secret',
  '',
];

function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;

  // 生产环境必须配置安全的 JWT_SECRET
  if (process.env.NODE_ENV === 'production') {
    if (!secret || DEFAULT_JWT_SECRETS.includes(secret)) {
      throw new Error('生产环境必须配置安全的 JWT_SECRET，不能使用默认值');
    }
    return secret;
  }

  // 开发环境：如果未配置，使用临时密钥（会打印警告）
  if (!secret || DEFAULT_JWT_SECRETS.includes(secret)) {
    console.warn('⚠️  警告：JWT_SECRET 未配置或使用了默认值，开发环境使用临时密钥');
    return 'dev-temp-secret-do-not-use-in-production-' + Date.now();
  }

  return secret;
}

// 导出 JWT_SECRET 供其他模块使用（延迟初始化）
export const JWT_SECRET = getJWTSecret();
const JWT_EXPIRES_IN = '7d';

// 生成随机token
export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// 生成 token 的哈希值（用于安全存储）
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
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
// platform: 'web' | 'miniprogram' | 'app'，用于区分登录端（互踢依赖 active_token，platform 仅作日志/调试用）
export function generateJWT(userId: number, username?: string, isAdmin?: boolean, platform: string = 'web'): string {
  return jwt.sign({ userId, username, isAdmin: isAdmin || false, platform }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
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
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/verify-email?token=${token}`;
  
  const emailContent = {
    from: `StoryTree <${process.env.SMTP_FROM || 'noreply@storytree.com'}>`,
    to: email,
    subject: '【StoryTree】请验证你的邮箱',
    html: `
<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- 头部 -->
        <tr>
          <td style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);padding:40px 48px;text-align:center;">
            <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:16px;padding:12px 20px;margin-bottom:16px;">
              <span style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:2px;">StoryTree</span>
            </div>
            <p style="margin:0;color:rgba(255,255,255,0.85);font-size:15px;">协作式故事创作平台</p>
          </td>
        </tr>
        <!-- 内容 -->
        <tr>
          <td style="padding:48px 48px 32px;">
            <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1e1b4b;">验证你的邮箱地址</h2>
            <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.7;">
              感谢注册 StoryTree！请点击下方按钮验证你的邮箱，完成账号激活。
            </p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${verificationUrl}"
                 style="display:inline-block;background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 40px;border-radius:12px;letter-spacing:0.5px;">
                验证邮箱
              </a>
            </div>
            <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;line-height:1.6;">
              如果按钮无法点击，请复制以下链接到浏览器：<br>
              <a href="${verificationUrl}" style="color:#6366f1;word-break:break-all;">${verificationUrl}</a>
            </p>
          </td>
        </tr>
        <!-- 提示 -->
        <tr>
          <td style="padding:0 48px 32px;">
            <div style="background:#fef9ee;border:1px solid #fde68a;border-radius:10px;padding:16px 20px;">
              <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
                ⏰ 此链接将在 <strong>24 小时</strong>后过期。如果你没有注册 StoryTree，请忽略此邮件。
              </p>
            </div>
          </td>
        </tr>
        <!-- 底部 -->
        <tr>
          <td style="background:#f9fafb;padding:24px 48px;text-align:center;border-top:1px solid #f3f4f6;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">© 2026 StoryTree · 此邮件由系统自动发送，请勿回复</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
    `,
  };

  if (isDevelopmentMode) {
    console.log('\n=== 开发模式：邮件未实际发送 ===');
    console.log('收件人:', email);
    console.log('主题:', emailContent.subject);
    console.log('验证链接:', verificationUrl);
    console.log('Token:', token);
    console.log('================================\n');
    return;
  }
  
  await transporter!.sendMail(emailContent);
}

// 发送密码重置邮件
export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/reset-password?token=${token}`;
  
  const emailContent = {
    from: `StoryTree <${process.env.SMTP_FROM || 'noreply@storytree.com'}>`,
    to: email,
    subject: '【StoryTree】密码重置请求',
    html: `
<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- 头部 -->
        <tr>
          <td style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);padding:40px 48px;text-align:center;">
            <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:16px;padding:12px 20px;margin-bottom:16px;">
              <span style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:2px;">StoryTree</span>
            </div>
            <p style="margin:0;color:rgba(255,255,255,0.85);font-size:15px;">协作式故事创作平台</p>
          </td>
        </tr>
        <!-- 内容 -->
        <tr>
          <td style="padding:48px 48px 32px;">
            <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1e1b4b;">重置你的密码</h2>
            <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.7;">
              我们收到了你的密码重置请求。请点击下方按钮设置新密码。
            </p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${resetUrl}"
                 style="display:inline-block;background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 40px;border-radius:12px;letter-spacing:0.5px;">
                重置密码
              </a>
            </div>
            <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;line-height:1.6;">
              如果按钮无法点击，请复制以下链接到浏览器：<br>
              <a href="${resetUrl}" style="color:#6366f1;word-break:break-all;">${resetUrl}</a>
            </p>
          </td>
        </tr>
        <!-- 提示 -->
        <tr>
          <td style="padding:0 48px 32px;">
            <div style="background:#fef9ee;border:1px solid #fde68a;border-radius:10px;padding:16px 20px;">
              <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
                ⏰ 此链接将在 <strong>1 小时</strong>后过期。如果你没有请求重置密码，请忽略此邮件，你的账号仍然安全。
              </p>
            </div>
          </td>
        </tr>
        <!-- 底部 -->
        <tr>
          <td style="background:#f9fafb;padding:24px 48px;text-align:center;border-top:1px solid #f3f4f6;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">© 2026 StoryTree · 此邮件由系统自动发送，请勿回复</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
    `,
  };

  if (isDevelopmentMode) {
    console.log('\n=== 开发模式：邮件未实际发送 ===');
    console.log('收件人:', email);
    console.log('主题:', emailContent.subject);
    console.log('重置链接:', resetUrl);
    console.log('Token:', token);
    console.log('================================\n');
    return;
  }
  
  await transporter!.sendMail(emailContent);
}

// 验证邮箱格式
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// 验证密码强度
export function isValidPassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: '密码长度至少为8位' };
  }
  if (password.length > 128) {
    return { valid: false, message: '密码长度不能超过128位' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: '密码需包含至少一个大写字母' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: '密码需包含至少一个小写字母' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: '密码需包含至少一个数字' };
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
