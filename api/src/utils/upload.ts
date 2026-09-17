import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// 创建上传目录
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// mimetype → 扩展名白名单映射（不信任客户端原始文件名，防 .html/.svg 存储型 XSS）
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

// 配置存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 生成唯一文件名：时间戳 + 随机字符串 + 白名单扩展名
    // 扩展名从已校验的 mimetype 映射获取，不使用 file.originalname（可伪造）
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
    const ext = EXT_BY_MIME[file.mimetype] || '.jpg';
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

// 文件过滤器：只允许图片
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('只支持上传图片文件 (jpg, png, gif, webp)'));
  }
};

// 配置multer
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 限制5MB
  }
});

// 删除文件的辅助函数（basename 防路径穿越）
export const deleteFile = (filename: string): void => {
  const filePath = path.join(uploadDir, path.basename(filename));
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

// 获取文件URL的辅助函数
export const getFileUrl = (filename: string): string => {
  return `/uploads/${filename}`;
};

