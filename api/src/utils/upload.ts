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

// 图片魔数签名（文件头真实字节，客户端无法伪造 Content-Type 绕过）
const MAGIC_SIGNATURES: Record<string, number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/jpg':  [[0xff, 0xd8, 0xff]],
  'image/png':  [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/gif':  [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]], // GIF87a / GIF89a
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // 'RIFF'（第 8-11 字节为 'WEBP'，下面单独校验）
};

/**
 * 校验已落盘文件的真实魔数是否与声明的 mimetype 匹配（M11：防伪造 Content-Type 上传恶意文件）
 * 不匹配时删除文件并返回 false
 */
export function validateImageMagicNumber(filename: string, declaredMime: string): boolean {
  const filePath = path.join(uploadDir, path.basename(filename));
  try {
    // 只读文件头 12 字节即可判定
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(12);
    fs.readSync(fd, buf, 0, 12, 0);
    fs.closeSync(fd);

    const signatures = MAGIC_SIGNATURES[declaredMime];
    if (!signatures) return false;

    let matched = signatures.some(sig => sig.every((b, i) => buf[i] === b));

    // WebP 需额外确认第 8-11 字节是 'WEBP'
    if (matched && declaredMime === 'image/webp') {
      matched = buf.slice(8, 12).toString('ascii') === 'WEBP';
    }

    if (!matched) {
      fs.unlinkSync(filePath); // 魔数不符，删除已落盘的伪造文件
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

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

