/**
 * 阿里云 OSS 存储模块
 * 
 * 用于生产环境的图片存储，支持 CDN 加速
 */

import OSS from 'ali-oss';
import crypto from 'crypto';
import path from 'path';

// OSS 客户端实例（延迟初始化）
let ossClient: OSS | null = null;

/**
 * 获取 OSS 客户端实例
 */
function getOSSClient(): OSS {
  if (!ossClient) {
    const region = process.env.OSS_REGION;
    const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
    const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
    const bucket = process.env.OSS_BUCKET;

    if (!region || !accessKeyId || !accessKeySecret || !bucket) {
      throw new Error('OSS 配置不完整，请检查环境变量：OSS_REGION, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET');
    }

    ossClient = new OSS({
      region,
      accessKeyId,
      accessKeySecret,
      bucket,
    });
  }
  return ossClient;
}

/**
 * 生成唯一文件名
 */
function generateFileName(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  return `${timestamp}-${random}${ext}`;
}

/**
 * 获取文件存储目录
 */
function getStorageDir(type: 'avatar' | 'cover' | 'content' = 'content'): string {
  const dirs: Record<string, string> = {
    avatar: 'avatars',
    cover: 'covers',
    content: 'content',
  };
  return dirs[type] || 'uploads';
}

/**
 * 上传文件到 OSS
 * 
 * @param buffer - 文件内容
 * @param originalName - 原始文件名
 * @param type - 文件类型（avatar/cover/content）
 * @returns 文件 URL
 */
export async function uploadToOSS(
  buffer: Buffer,
  originalName: string,
  type: 'avatar' | 'cover' | 'content' = 'content'
): Promise<string> {
  const client = getOSSClient();
  const fileName = generateFileName(originalName);
  const objectKey = `${getStorageDir(type)}/${fileName}`;

  try {
    const result = await client.put(objectKey, buffer, {
      headers: {
        // 设置缓存控制（1年）
        'Cache-Control': 'max-age=31536000',
        // 根据文件扩展名设置 Content-Type
        'Content-Type': getMimeType(originalName),
      },
    });

    // 优先使用 CDN 域名
    const cdnDomain = process.env.OSS_CDN_DOMAIN;
    if (cdnDomain) {
      return `${cdnDomain.replace(/\/$/, '')}/${objectKey}`;
    }

    // 否则使用 OSS 默认域名
    return result.url;
  } catch (error) {
    console.error('OSS 上传失败:', error);
    throw new Error('文件上传失败，请稍后重试');
  }
}

/**
 * 从 OSS 删除文件
 * 
 * @param url - 文件 URL 或 object key
 */
export async function deleteFromOSS(url: string): Promise<void> {
  const client = getOSSClient();
  
  // 从 URL 中提取 object key
  let objectKey = url;
  
  // 如果是完整 URL，提取路径部分
  if (url.startsWith('http')) {
    try {
      const urlObj = new URL(url);
      objectKey = urlObj.pathname.replace(/^\//, '');
    } catch {
      console.error('无效的 URL:', url);
      return;
    }
  }

  try {
    await client.delete(objectKey);
  } catch (error) {
    console.error('OSS 删除失败:', error);
    // 删除失败不抛出异常，避免影响主流程
  }
}

/**
 * 生成临时访问 URL（用于私有 Bucket）
 * 
 * @param objectKey - 文件 key
 * @param expires - 过期时间（秒），默认 1 小时
 */
export async function getSignedUrl(objectKey: string, expires: number = 3600): Promise<string> {
  const client = getOSSClient();
  return client.signatureUrl(objectKey, { expires });
}

/**
 * 检查文件是否存在
 */
export async function fileExists(objectKey: string): Promise<boolean> {
  const client = getOSSClient();
  try {
    await client.head(objectKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取文件的 MIME 类型
 */
function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * 验证文件类型是否为图片
 */
export function isValidImageType(mimetype: string): boolean {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
  ];
  return allowedTypes.includes(mimetype);
}

/**
 * 验证文件大小
 * 
 * @param size - 文件大小（字节）
 * @param maxSizeMB - 最大大小（MB）
 */
export function isValidFileSize(size: number, maxSizeMB: number = 5): boolean {
  return size <= maxSizeMB * 1024 * 1024;
}

