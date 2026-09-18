import { Router } from 'express';
import { upload, getFileUrl, validateImageMagicNumber } from '../utils/upload';
import { prisma } from '../index';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../utils/auth';
import { getActiveUserIdFromReq } from '../utils/middleware';

const router = Router();

// 委托共享实现：校验 JWT + active_token（单端互踢）
const getUserId = (req: any): Promise<number | null> => getActiveUserIdFromReq(req);

// 上传图片
router.post('/image', upload.single('image'), async (req, res) => {
  const userId = await getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // M11: 校验文件真实魔数，防伪造 Content-Type 上传恶意文件（如 .html 改头冒充图片）
    if (!validateImageMagicNumber(req.file.filename, req.file.mimetype)) {
      return res.status(400).json({ error: '文件内容与声明的图片类型不符，已拒绝' });
    }

    const fileUrl = getFileUrl(req.file.filename);

    res.json({
      success: true,
      url: fileUrl,
      filename: req.file.filename,
      size: req.file.size
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
});

// 更新用户头像
router.post('/avatar', upload.single('avatar'), async (req, res) => {
  const userId = await getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // M11: 校验文件真实魔数，防伪造 Content-Type
    if (!validateImageMagicNumber(req.file.filename, req.file.mimetype)) {
      return res.status(400).json({ error: '文件内容与声明的图片类型不符，已拒绝' });
    }

    const fileUrl = getFileUrl(req.file.filename);

    // 更新用户头像
    const user = await prisma.users.update({
      where: { id: userId },
      data: { avatar: fileUrl },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        bio: true
      }
    });

    res.json({ success: true, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update avatar' });
  }
});

// 更新故事封面
router.post('/story/:storyId/cover', upload.single('cover'), async (req, res) => {
  const userId = await getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { storyId } = req.params;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // M11: 校验文件真实魔数，防伪造 Content-Type
    if (!validateImageMagicNumber(req.file.filename, req.file.mimetype)) {
      return res.status(400).json({ error: '文件内容与声明的图片类型不符，已拒绝' });
    }

    // 检查故事所有权
    const story = await prisma.stories.findUnique({
      where: { id: parseInt(storyId) }
    });

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    if (story.author_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const fileUrl = getFileUrl(req.file.filename);

    // 更新故事封面
    const updatedStory = await prisma.stories.update({
      where: { id: parseInt(storyId) },
      data: { cover_image: fileUrl }
    });

    res.json({ success: true, story: updatedStory });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update cover image' });
  }
});

export default router;

