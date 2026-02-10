import { Router } from 'express';
import { prisma } from '../index';

const router = Router();

const getUserId = (req: any): number | null => {
  const userId = req.headers['x-user-id'];
  return userId ? parseInt(userId as string) : null;
};

// Get node details with branches
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Increment read count
    await prisma.node.update({
      where: { id: parseInt(id) },
      data: { readCount: { increment: 1 } }
    });

    const node = await prisma.node.findUnique({
      where: { id: parseInt(id) },
      include: {
        author: {
          select: { id: true, username: true }
        },
        story: {
          select: { id: true, title: true, authorId: true }
        }
      }
    });

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    // Get branches with rating info
    const branches = await prisma.node.findMany({
      where: { parentId: parseInt(id) },
      include: {
        author: {
          select: { id: true, username: true }
        }
      },
      orderBy: [
        { ratingAvg: 'desc' },
        { readCount: 'desc' }
      ]
    });

    // Get parent info for breadcrumb
    let parent = null;
    if (node.parentId) {
      parent = await prisma.node.findUnique({
        where: { id: node.parentId },
        select: { id: true, title: true }
      });
    }

    // Check if user has rated
    const userId = getUserId(req);
    let userRating = null;
    if (userId) {
      const rating = await prisma.rating.findUnique({
        where: {
          nodeId_userId: {
            nodeId: parseInt(id),
            userId
          }
        }
      });
      if (rating) userRating = rating.score;
    }

    res.json({ node, branches, parent, userRating });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch node' });
  }
});

// Create branch
router.post('/:id/branches', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { id } = req.params;
  const { title, content } = req.body;

  try {
    const parentNode = await prisma.node.findUnique({
      where: { id: parseInt(id) },
      include: { story: true }
    });

    if (!parentNode) {
      return res.status(404).json({ error: 'Parent node not found' });
    }

    // Generate path: parent.path + branch number
    const siblingCount = await prisma.node.count({
      where: { parentId: parseInt(id) }
    });
    const newPath = `${parentNode.path}.${siblingCount + 1}`;

    const node = await prisma.node.create({
      data: {
        storyId: parentNode.storyId,
        parentId: parseInt(id),
        authorId: userId,
        title,
        content,
        path: newPath
      },
      include: {
        author: {
          select: { id: true, username: true }
        },
        story: {
          select: { id: true, title: true }
        }
      }
    });

    res.json({ node });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create branch' });
  }
});

// Rate a node
router.post('/:id/rate', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { id } = req.params;
  const { score } = req.body;

  if (score < 1 || score > 5) {
    return res.status(400).json({ error: 'Score must be 1-5' });
  }

  try {
    // Upsert rating
    await prisma.rating.upsert({
      where: {
        nodeId_userId: {
          nodeId: parseInt(id),
          userId
        }
      },
      create: {
        nodeId: parseInt(id),
        userId,
        score
      },
      update: {
        score
      }
    });

    // Recalculate average
    const ratings = await prisma.rating.findMany({
      where: { nodeId: parseInt(id) }
    });
    const avg = ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;

    await prisma.node.update({
      where: { id: parseInt(id) },
      data: {
        ratingAvg: avg,
        ratingCount: ratings.length
      }
    });

    res.json({ success: true, ratingAvg: avg, ratingCount: ratings.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to rate node' });
  }
});

export default router;
