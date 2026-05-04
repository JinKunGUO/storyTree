/**
 * 统一存储模块
 * 
 * 根据 STORAGE_MODE 环境变量自动选择存储方式：
 * - local: 本地磁盘存储（开发环境）
 * - oss: 阿里云 OSS 存储（生产环境）
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { uploadToOSS, deleteFromOSS, isValidImageType, isValidFileSize } from './oss';

// 存储模式
const STORAGE_MODE = process.env.STORAGE_MODE || 'local';

// 本地上传目录
const LOCAL_UPLOAD_DIR = path.join(__dirname, '../../uploads');

// 确保本地上传目录存在
if (STORAGE_MODE === 'local' && !fs.existsSync(LOCAL_UPLOAD_DIR)) {
  fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
}

/**
 * 生成唯一文件名
 */
function generateFileName(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const timestamp = Date.now();
  const random = crypto.randomBytes(6).toString('hex');
  return `${timestamp}-${random}${ext}`;
}

/**
 * 文件类型
 */
export type FileType = 'avatar' | 'cover' | 'content';

/**
 * 上传结果
 */
export interface UploadResult {
  url: string;
  filename: string;
  size: number;
  mimetype: string;
}

/**
 * 上传文件
 * 
 * @param buffer - 文件内容
 * @param originalName - 原始文件名
 * @param mimetype - MIME 类型
 * @param type - 文件类型
 * @returns 上传结果
 */
export async function uploadFile(
  buffer: Buffer,
  originalName: string,
  mimetype: string,
  type: FileType = 'content'
): Promise<UploadResult> {
  // 验证文件类型
  if (!isValidImageType(mimetype)) {
    throw new Error('只支持上传图片文件 (jpg, png, gif, webp)');
  }

  // 验证文件大小（5MB）
  if (!isValidFileSize(buffer.length, 5)) {
    throw new Error('文件大小不能超过 5MB');
  }

  const filename = generateFileName(originalName);

  if (STORAGE_MODE === 'oss') {
    // OSS 存储
    const url = await uploadToOSS(buffer, originalName, type);
    return {
      url,
      filename,
      size: buffer.length,
      mimetype,
    };
  } else {
    // 本地存储
    const filePath = path.join(LOCAL_UPLOAD_DIR, filename);
    fs.writeFileSync(filePath, buffer);
    return {
      url: `/uploads/${filename}`,
      filename,
      size: buffer.length,
      mimetype,
    };
  }
}

/**
 * 删除文件
 * 
 * @param url - 文件 URL
 */
export async function deleteFile(url: string): Promise<void> {
  if (!url) return;

  if (STORAGE_MODE === 'oss') {
    // OSS 删除
    await deleteFromOSS(url);
  } else {
    // 本地删除
    const filename = path.basename(url);
    const filePath = path.join(LOCAL_UPLOAD_DIR, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

/**
 * 获取完整的文件 URL
 * 
 * @param url - 存储的 URL（可能是相对路径或完整 URL）
 * @returns 完整 URL
 */
export function getFullUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  // 已经是完整 URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // 本地存储的相对路径，需要拼接 API 地址
  const apiUrl = process.env.API_URL || 'http://localhost:3001';
  return `${apiUrl.replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
}

// ===== Multer 配置（用于 Express 中间件）=====

/**
 * 文件过滤器
 */
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (isValidImageType(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('只支持上传图片文件 (jpg, png, gif, webp)'));
  }
};

/**
 * Multer 内存存储（用于 OSS 上传）
 */
const memoryStorage = multer.memoryStorage();

/**
 * Multer 磁盘存储（用于本地存储）
 */
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, LOCAL_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, generateFileName(file.originalname));
  },
});

/**
 * 创建 Multer 上传中间件
 * 
 * 根据存储模式自动选择存储方式
 */
export const upload = multer({
  storage: STORAGE_MODE === 'oss' ? memoryStorage : diskStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

/**
 * 处理上传的文件（用于 OSS 模式）
 * 
 * 在路由中使用：
 * ```
 * router.post('/upload', upload.single('file'), async (req, res) => {
 *   const result = await processUploadedFile(req.file, 'avatar');
 *   res.json({ url: result.url });
 * });
 * ```
 */
export async function processUploadedFile(
  file: Express.Multer.File | undefined,
  type: FileType = 'content'
): Promise<UploadResult | null> {
  if (!file) return null;

  if (STORAGE_MODE === 'oss') {
    // OSS 模式：从 buffer 上传
    return await uploadFile(file.buffer, file.originalname, file.mimetype, type);
  } else {
    // 本地模式：文件已保存到磁盘
    return {
      url: `/uploads/${file.filename}`,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
    };
  }
}

/**
 * 获取当前存储模式
 */
export function getStorageMode(): 'local' | 'oss' {
  return STORAGE_MODE as 'local' | 'oss';
}

/**
 * 检查是否使用 OSS 存储
 */
export function isOSSMode(): boolean {
  return STORAGE_MODE === 'oss';
}

// 导出旧接口以保持兼容性
export { deleteFile as deleteLocalFile };
export const getFileUrl = (filename: string): string => `/uploads/${filename}`;

