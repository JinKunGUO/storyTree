import { Router } from 'express';
import { prisma } from '../index';

const router = Router();

// Get auth user from header (dev mode)
const getUserId = (req: any): number | null => {
  const userId = req.headers['x-user-id'];
  return userId ? parseInt(userId as string) : null;
};

// List all stories with first node info
router.get('/', async (req, res) => {
  try {
    const stories = await prisma.story.findMany({
      include: {
        author: {
          select: { id: true, username: true }
        },
        nodes: {
          where: { parentId: null },
          take: 1,
          select: {
            id: true,
            title: true,
            content: true,
            ratingAvg: true,
            ratingCount: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ stories });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

// Create story with first node
router.post('/', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { title, description, firstNodeTitle, firstNodeContent } = req.body;

  try {
    const story = await prisma.story.create({
      data: {
        title,
        description,
        authorId: userId,
        nodes: {
          create: {
            title: firstNodeTitle || '第一章',
            content: firstNodeContent,
            authorId: userId,
            path: '1'
          }
        }
      },
      include: {
        nodes: true,
        author: {
          select: { id: true, username: true }
        }
      }
    });

    // Update rootNodeId
    await prisma.story.update({
      where: { id: story.id },
      data: { rootNodeId: story.nodes[0].id }
    });

    res.json({ story: { ...story, rootNodeId: story.nodes[0].id } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create story' });
  }
});

// Get story with full tree
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const story = await prisma.story.findUnique({
      where: { id: parseInt(id) },
      include: {
        author: {
          select: { id: true, username: true }
        }
      }
    });

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    // Get all nodes for this story
    const nodes = await prisma.node.findMany({
      where: { storyId: parseInt(id) },
      include: {
        author: {
          select: { id: true, username: true }
        },
        _count: {
          select: { branches: true }
        }
      },
      orderBy: { path: 'asc' }
    });

    res.json({ story, nodes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch story' });
  }
});

export default router;
