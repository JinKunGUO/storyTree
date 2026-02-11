import { Router } from 'express';
import { upload, getFileUrl } from '../utils/upload';
import { prisma } from '../index';

const router = Router();

const getUserId = (req: any): number | null => {
  const userId = req.headers['x-user-id'];
  return userId ? parseInt(userId as string) : null;
};

// 上传图片
router.post('/image', upload.single('image'), async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
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
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = getFileUrl(req.file.filename);

    // 更新用户头像
    const user = await prisma.user.update({
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
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { storyId } = req.params;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // 检查故事所有权
    const story = await prisma.story.findUnique({
      where: { id: parseInt(storyId) }
    });

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    if (story.authorId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const fileUrl = getFileUrl(req.file.filename);

    // 更新故事封面
    const updatedStory = await prisma.story.update({
      where: { id: parseInt(storyId) },
      data: { coverImage: fileUrl }
    });

    res.json({ success: true, story: updatedStory });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update cover image' });
  }
});

export default router;

