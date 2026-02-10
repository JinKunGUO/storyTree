import { Router } from 'express';
import { prisma } from '../index';

const router = Router();

// M1: Simplified auth - just create/get user by username
// In production, use proper JWT or session auth

// Create or get user (dev mode)
router.post('/dev-login', async (req, res) => {
  const { username, email } = req.body;

  try {
    let user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          username,
          email: email || `${username}@test.com`,
          password: 'dev-password'
        }
      });
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create/get user' });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId as string) }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

export default router;
