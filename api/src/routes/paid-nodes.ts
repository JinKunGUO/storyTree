import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const router = Router();
const prisma = new PrismaClient();

// 验证JWT中间件
async function authenticateToken(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this') as { userId: number };
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: '无效的认证令牌' });
  }
}

// 设置章节为付费章节（需要是作者）
router.post('/:nodeId/set-price', authenticateToken, async (req: any, res: any) => {
  const { nodeId } = req.params;
  const { unlockPrice, isMemberFree } = req.body;
  const userId = req.userId;

  if (!unlockPrice || unlockPrice < 0) {
    return res.status(400).json({ error: '请设置有效的解锁价格' });
  }

  try {
    // 检查章节是否存在
    const node = await prisma.nodes.findUnique({
      where: { id: parseInt(nodeId) },
      include: {
        story: true
      }
    });

    if (!node) {
      return res.status(404).json({ error: '章节不存在' });
    }

    // 检查是否是作者
    if (node.author_id !== userId && node.story.author_id !== userId) {
      return res.status(403).json({ error: '只有作者可以设置付费章节' });
    }

    // 创建或更新付费章节
    const paidNode = await prisma.paid_nodes.upsert({
      where: { node_id: parseInt(nodeId) },
      update: {
        unlock_price: parseInt(unlockPrice),
        is_member_free: isMemberFree || false
      },
      create: {
        node_id: parseInt(nodeId),
        unlock_price: parseInt(unlockPrice),
        is_member_free: isMemberFree || false
      }
    });

    res.json({
      success: true,
      message: '付费章节设置成功',
      paidNode
    });
  } catch (error) {
    console.error('设置付费章节失败:', error);
    res.status(500).json({ error: '设置付费章节失败' });
  }
});

// 取消章节付费（需要是作者）
router.delete('/:nodeId/cancel-price', authenticateToken, async (req: any, res: any) => {
  const { nodeId } = req.params;
  const userId = req.userId;

  try {
    // 检查章节是否存在
    const node = await prisma.nodes.findUnique({
      where: { id: parseInt(nodeId) },
      include: {
        story: true
      }
    });

    if (!node) {
      return res.status(404).json({ error: '章节不存在' });
    }

    // 检查是否是作者
    if (node.author_id !== userId && node.story.author_id !== userId) {
      return res.status(403).json({ error: '只有作者可以取消付费设置' });
    }

    // 删除付费章节设置
    await prisma.paid_nodes.delete({
      where: { node_id: parseInt(nodeId) }
    });

    res.json({
      success: true,
      message: '已取消付费设置'
    });
  } catch (error) {
    console.error('取消付费设置失败:', error);
    res.status(500).json({ error: '取消付费设置失败' });
  }
});

// 解锁付费章节
router.post('/:nodeId/unlock', authenticateToken, async (req: any, res: any) => {
  const { nodeId } = req.params;
  const userId = req.userId;

  try {
    // 检查章节是否存在
    const node = await prisma.nodes.findUnique({
      where: { id: parseInt(nodeId) },
      include: {
        paid_node: true,
        story: true
      }
    });

    if (!node) {
      return res.status(404).json({ error: '章节不存在' });
    }

    if (!node.paid_node) {
      return res.status(400).json({ error: '该章节不是付费章节' });
    }

    // 检查是否已解锁
    const existingUnlock = await prisma.node_unlocks.findUnique({
      where: {
        user_id_node_id: {
          user_id: userId,
          node_id: parseInt(nodeId)
        }
      }
    });

    if (existingUnlock) {
      return res.json({
        success: true,
        message: '已经解锁过该章节',
        alreadyUnlocked: true
      });
    }

    // 检查是否是作者（作者免费）
    if (node.author_id === userId || node.story.author_id === userId) {
      await prisma.node_unlocks.create({
        data: {
          user_id: userId,
          node_id: parseInt(nodeId),
          cost: 0
        }
      });

      return res.json({
        success: true,
        message: '作者免费解锁',
        cost: 0
      });
    }

    // 获取用户信息
    const user = await prisma.users.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 检查会员状态
    let cost = node.paid_node.unlock_price;
    if (node.paid_node.is_member_free && user.subscription_type && user.subscription_expires) {
      const now = new Date();
      if (user.subscription_expires > now) {
        cost = 0; // 会员免费
      }
    }

    // 检查积分是否足够
    if (cost > 0 && user.points < cost) {
      return res.status(400).json({ 
        error: '积分不足',
        required: cost,
        current: user.points
      });
    }

    // 使用事务处理解锁
    const result = await prisma.$transaction(async (tx) => {
      // 扣除积分
      if (cost > 0) {
        await tx.users.update({
          where: { id: userId },
          data: {
            points: {
              decrement: cost
            }
          }
        });

        // 记录积分交易
        await tx.point_transactions.create({
          data: {
            user_id: userId,
            amount: -cost,
            type: 'unlock_node',
            description: `解锁章节《${node.title}》`,
            reference_id: parseInt(nodeId)
          }
        });

        // 增加作者收益
        await tx.users.update({
          where: { id: node.author_id },
          data: {
            earnings_balance: {
              increment: cost
            }
          }
        });

        // 更新付费章节统计
        await tx.paid_nodes.update({
          where: { node_id: parseInt(nodeId) },
          data: {
            total_earnings: {
              increment: cost
            },
            unlock_count: {
              increment: 1
            }
          }
        });
      }

      // 创建解锁记录
      const unlock = await tx.node_unlocks.create({
        data: {
          user_id: userId,
          node_id: parseInt(nodeId),
          cost
        }
      });

      // 给作者发送通知（如果不是作者自己）
      if (cost > 0 && node.author_id !== userId) {
        await tx.notifications.create({
          data: {
            user_id: node.author_id,
            type: 'node_unlocked',
            title: '章节被解锁',
            content: `用户解锁了你的章节《${node.title}》，你获得了 ${cost} 积分`,
            link: `/story/${node.story_id}/node/${node.id}`
          }
        });
      }

      return unlock;
    });

    res.json({
      success: true,
      message: cost > 0 ? '解锁成功' : '会员免费解锁',
      cost,
      remainingPoints: user.points - cost
    });
  } catch (error) {
    console.error('解锁章节失败:', error);
    res.status(500).json({ error: '解锁章节失败' });
  }
});

// 检查章节是否已解锁
router.get('/:nodeId/check-unlock', authenticateToken, async (req: any, res: any) => {
  const { nodeId } = req.params;
  const userId = req.userId;

  try {
    // 检查章节是否存在
    const node = await prisma.nodes.findUnique({
      where: { id: parseInt(nodeId) },
      include: {
        paid_node: true,
        story: true
      }
    });

    if (!node) {
      return res.status(404).json({ error: '章节不存在' });
    }

    // 不是付费章节
    if (!node.paid_node) {
      return res.json({
        isPaid: false,
        isUnlocked: true
      });
    }

    // 是作者
    if (node.author_id === userId || node.story.author_id === userId) {
      return res.json({
        isPaid: true,
        isUnlocked: true,
        isAuthor: true
      });
    }

    // 检查是否已解锁
    const unlock = await prisma.node_unlocks.findUnique({
      where: {
        user_id_node_id: {
          user_id: userId,
          node_id: parseInt(nodeId)
        }
      }
    });

    // 检查会员状态
    const user = await prisma.users.findUnique({
      where: { id: userId }
    });

    let isMemberFree = false;
    if (node.paid_node.is_member_free && user?.subscription_type && user.subscription_expires) {
      const now = new Date();
      if (user.subscription_expires > now) {
        isMemberFree = true;
      }
    }

    res.json({
      isPaid: true,
      isUnlocked: !!unlock,
      unlockPrice: node.paid_node.unlock_price,
      isMemberFree,
      userPoints: user?.points || 0
    });
  } catch (error) {
    console.error('检查解锁状态失败:', error);
    res.status(500).json({ error: '检查解锁状态失败' });
  }
});

// 获取用户的解锁记录
router.get('/my-unlocks', authenticateToken, async (req: any, res: any) => {
  const userId = req.userId;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  try {
    const [unlocks, total] = await Promise.all([
      prisma.node_unlocks.findMany({
        where: { user_id: userId },
        include: {
          node: {
            include: {
              story: {
                select: {
                  id: true,
                  title: true
                }
              },
              author: {
                select: {
                  id: true,
                  username: true,
                  avatar: true
                }
              }
            }
          }
        },
        orderBy: {
          created_at: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.node_unlocks.count({
        where: { user_id: userId }
      })
    ]);

    // 计算总花费
    const totalCost = await prisma.node_unlocks.aggregate({
      where: { user_id: userId },
      _sum: {
        cost: true
      }
    });

    res.json({
      unlocks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      stats: {
        totalUnlocks: total,
        totalCost: totalCost._sum.cost || 0
      }
    });
  } catch (error) {
    console.error('获取解锁记录失败:', error);
    res.status(500).json({ error: '获取解锁记录失败' });
  }
});

// 获取章节的收益统计（需要是作者）
router.get('/:nodeId/earnings', authenticateToken, async (req: any, res: any) => {
  const { nodeId } = req.params;
  const userId = req.userId;

  try {
    // 检查章节是否存在
    const node = await prisma.nodes.findUnique({
      where: { id: parseInt(nodeId) },
      include: {
        paid_node: true,
        story: true
      }
    });

    if (!node) {
      return res.status(404).json({ error: '章节不存在' });
    }

    // 检查是否是作者
    if (node.author_id !== userId && node.story.author_id !== userId) {
      return res.status(403).json({ error: '只有作者可以查看收益' });
    }

    if (!node.paid_node) {
      return res.json({
        isPaid: false,
        totalEarnings: 0,
        unlockCount: 0
      });
    }

    // 获取解锁用户列表
    const unlocks = await prisma.node_unlocks.findMany({
      where: { node_id: parseInt(nodeId) },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      },
      take: 10 // 只返回最近10个
    });

    res.json({
      isPaid: true,
      unlockPrice: node.paid_node.unlock_price,
      isMemberFree: node.paid_node.is_member_free,
      totalEarnings: node.paid_node.total_earnings,
      unlockCount: node.paid_node.unlock_count,
      recentUnlocks: unlocks
    });
  } catch (error) {
    console.error('获取收益统计失败:', error);
    res.status(500).json({ error: '获取收益统计失败' });
  }
});

export default router;

