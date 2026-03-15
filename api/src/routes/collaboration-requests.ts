import { Router } from 'express';
import { prisma } from '../index';
import { authenticateToken, getUserId } from '../utils/middleware';
import { canViewStory, isStoryAuthor } from '../utils/permissions';

const router = Router();

// 申请成为协作者
router.post('/', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  const { story_id, message } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // 检查故事是否存在
    const story = await prisma.stories.findUnique({
      where: { id: story_id },
      select: { 
        id: true, 
        title: true, 
        author_id: true,
        auto_approve_collaborators: true
      }
    });

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    // 不能申请自己的故事
    if (story.author_id === userId) {
      return res.status(400).json({ error: '不能申请成为自己故事的协作者' });
    }

    // 检查是否有查看权限
    const hasPermission = await canViewStory(userId, story_id);
    if (!hasPermission) {
      return res.status(403).json({ error: '无权限查看此故事' });
    }

    // 检查是否已经是协作者
    const existingCollaborator = await prisma.story_collaborators.findFirst({
      where: {
        story_id: story_id,
        user_id: userId,
        removed_at: null
      }
    });

    if (existingCollaborator) {
      return res.status(400).json({ error: '你已经是此故事的协作者' });
    }

    // 检查是否已有待处理的申请
    const existingRequest = await prisma.collaboration_requests.findUnique({
      where: {
        story_id_user_id: {
          story_id: story_id,
          user_id: userId
        }
      }
    });

    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        return res.status(400).json({ error: '你已经提交过申请，请等待审核' });
      } else {
        // 更新已存在的申请
        const updatedRequest = await prisma.collaboration_requests.update({
          where: {
            story_id_user_id: {
              story_id: story_id,
              user_id: userId
            }
          },
          data: {
            message,
            status: 'pending',
            reviewed_by: null,
            reviewed_at: null,
            created_at: new Date()
          }
        });

        // 如果设置了自动批准
        if (story.auto_approve_collaborators) {
          // 自动批准申请
          await prisma.collaboration_requests.update({
            where: { id: updatedRequest.id },
            data: {
              status: 'approved',
              reviewed_by: story.author_id,
              reviewed_at: new Date()
            }
          });

          // 检查是否已存在协作者记录（可能之前被移除）
          const existingCollaborator = await prisma.story_collaborators.findUnique({
            where: {
              story_id_user_id: {
                story_id: story_id,
                user_id: userId
              }
            }
          });

          if (existingCollaborator) {
            // 如果之前被移除，重新激活
            await prisma.story_collaborators.update({
              where: {
                story_id_user_id: {
                  story_id: story_id,
                  user_id: userId
                }
              },
              data: {
                removed_at: null,
                removed_by: null,
                invited_by: story.author_id
              }
            });
          } else {
            // 添加为新协作者
            await prisma.story_collaborators.create({
              data: {
                story_id: story_id,
                user_id: userId,
                invited_by: story.author_id
              }
            });
          }

          // 自动将协作者添加为故事粉丝（追更）
          await prisma.story_followers.upsert({
            where: {
              story_id_user_id: {
                story_id: story_id,
                user_id: userId
              }
            },
            create: {
              story_id: story_id,
              user_id: userId
            },
            update: {} // 如果已存在则不做修改
          });

          // 通知申请人
          await prisma.notifications.create({
            data: {
              user_id: userId,
              type: 'COLLABORATION_APPROVED',
              title: '协作申请已通过',
              content: `你的协作申请已自动通过，现在可以为《${story.title}》续写了`,
              link: `/story?id=${story.id}`
            }
          });

          return res.json({
            request: updatedRequest,
            message: '申请已自动通过，你现在是协作者了'
          });
        }

        // 通知作者
        await prisma.notifications.create({
          data: {
            user_id: story.author_id,
            type: 'COLLABORATION_REQUEST',
            title: '新的协作申请',
            content: `有用户申请成为《${story.title}》的协作者`,
            link: `/story-settings?id=${story.id}&tab=requests`
          }
        });

        return res.json({
          request: updatedRequest,
          message: '申请已重新提交，请等待审核'
        });
      }
    }

    // 创建新申请
    const request = await prisma.collaboration_requests.create({
      data: {
        story_id: story_id,
        user_id: userId,
        message
      }
    });

    // 如果设置了自动批准
    if (story.auto_approve_collaborators) {
      // 自动批准申请
      await prisma.collaboration_requests.update({
        where: { id: request.id },
        data: {
          status: 'approved',
          reviewed_by: story.author_id,
          reviewed_at: new Date()
        }
      });

      // 检查是否已存在协作者记录（可能之前被移除）
      const existingCollaborator = await prisma.story_collaborators.findUnique({
        where: {
          story_id_user_id: {
            story_id: story_id,
            user_id: userId
          }
        }
      });

      if (existingCollaborator) {
        // 如果之前被移除，重新激活
        await prisma.story_collaborators.update({
          where: {
            story_id_user_id: {
              story_id: story_id,
              user_id: userId
            }
          },
          data: {
            removed_at: null,
            removed_by: null,
            invited_by: story.author_id
          }
        });
      } else {
        // 添加为新协作者
        await prisma.story_collaborators.create({
          data: {
            story_id: story_id,
            user_id: userId,
            invited_by: story.author_id
          }
        });
      }

      // 自动将协作者添加为故事粉丝（追更）
      await prisma.story_followers.upsert({
        where: {
          story_id_user_id: {
            story_id: story_id,
            user_id: userId
          }
        },
        create: {
          story_id: story_id,
          user_id: userId
        },
        update: {} // 如果已存在则不做修改
      });

      // 通知申请人
      await prisma.notifications.create({
        data: {
          user_id: userId,
          type: 'COLLABORATION_APPROVED',
          title: '协作申请已通过',
          content: `你的协作申请已自动通过，现在可以为《${story.title}》续写了`,
          link: `/story?id=${story.id}`
        }
      });

      return res.json({
        request,
        message: '申请已自动通过，你现在是协作者了'
      });
    }

    // 通知作者
    await prisma.notifications.create({
      data: {
        user_id: story.author_id,
        type: 'COLLABORATION_REQUEST',
        title: '新的协作申请',
        content: `有用户申请成为《${story.title}》的协作者`,
        link: `/story-settings?id=${story.id}&tab=requests`
      }
    });

    res.json({
      request,
      message: '申请已提交，请等待审核'
    });
  } catch (error) {
    console.error('Create collaboration request error:', error);
    res.status(500).json({ error: '提交申请失败' });
  }
});

// 获取故事的协作申请列表（仅主创）
router.get('/story/:storyId', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  const { storyId } = req.params;
  const status = req.query.status as string;

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // 检查是否是故事作者
    const isAuthor = await isStoryAuthor(userId, parseInt(storyId));
    if (!isAuthor) {
      return res.status(403).json({ error: '只有故事作者可以查看协作申请' });
    }

    // 构建查询条件
    const where: any = { story_id: parseInt(storyId) };
    if (status) {
      where.status = status;
    }

    // 获取申请列表
    const requests = await prisma.collaboration_requests.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
            level: true
          }
        },
        reviewer: {
          select: {
            id: true,
            username: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    res.json({ requests });
  } catch (error) {
    console.error('Get collaboration requests error:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// 批准协作申请
router.put('/:id/approve', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // 获取申请信息
    const request = await prisma.collaboration_requests.findUnique({
      where: { id: parseInt(id) },
      include: {
        story: {
          select: { id: true, title: true, author_id: true }
        }
      }
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // 检查是否是故事作者
    if (request.story.author_id !== userId) {
      return res.status(403).json({ error: '只有故事作者可以批准申请' });
    }

    // 检查申请状态
    if (request.status !== 'pending') {
      return res.status(400).json({ error: '该申请已被处理' });
    }

    // 更新申请状态
    await prisma.collaboration_requests.update({
      where: { id: parseInt(id) },
      data: {
        status: 'approved',
        reviewed_by: userId,
        reviewed_at: new Date()
      }
    });

    // 检查是否已存在协作者记录（可能之前被移除）
    const existingCollaborator = await prisma.story_collaborators.findUnique({
      where: {
        story_id_user_id: {
          story_id: request.story_id,
          user_id: request.user_id
        }
      }
    });

    if (existingCollaborator) {
      // 如果之前被移除，重新激活
      await prisma.story_collaborators.update({
        where: {
          story_id_user_id: {
            story_id: request.story_id,
            user_id: request.user_id
          }
        },
        data: {
          removed_at: null,
          removed_by: null,
          invited_by: userId // 更新邀请人
        }
      });
    } else {
      // 添加为新协作者
      await prisma.story_collaborators.create({
        data: {
          story_id: request.story_id,
          user_id: request.user_id,
          invited_by: userId
        }
      });
    }

    // 自动将协作者添加为故事粉丝（追更）
    await prisma.story_followers.upsert({
      where: {
        story_id_user_id: {
          story_id: request.story_id,
          user_id: request.user_id
        }
      },
      create: {
        story_id: request.story_id,
        user_id: request.user_id
      },
      update: {} // 如果已存在则不做修改
    });

    // 通知申请人
    await prisma.notifications.create({
      data: {
        user_id: request.user_id,
        type: 'COLLABORATION_APPROVED',
        title: '协作申请已通过',
        content: `你的协作申请已通过，现在可以为《${request.story.title}》续写了`,
        link: `/story?id=${request.story.id}`
      }
    });

    res.json({ message: '申请已批准' });
  } catch (error: any) {
    console.error('Approve collaboration request error:', error);
    // 处理重复添加协作者的错误
    if (error.code === 'P2002') {
      return res.status(400).json({ error: '该用户已是协作者' });
    }
    res.status(500).json({ error: '批准申请失败' });
  }
});

// 拒绝协作申请
router.put('/:id/reject', authenticateToken, async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // 获取申请信息
    const request = await prisma.collaboration_requests.findUnique({
      where: { id: parseInt(id) },
      include: {
        story: {
          select: { id: true, title: true, author_id: true }
        }
      }
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // 检查是否是故事作者
    if (request.story.author_id !== userId) {
      return res.status(403).json({ error: '只有故事作者可以拒绝申请' });
    }

    // 检查申请状态
    if (request.status !== 'pending') {
      return res.status(400).json({ error: '该申请已被处理' });
    }

    // 更新申请状态
    await prisma.collaboration_requests.update({
      where: { id: parseInt(id) },
      data: {
        status: 'rejected',
        reviewed_by: userId,
        reviewed_at: new Date()
      }
    });

    // 通知申请人
    await prisma.notifications.create({
      data: {
        user_id: request.user_id,
        type: 'COLLABORATION_REJECTED',
        title: '协作申请未通过',
        content: `你的协作申请未通过：《${request.story.title}》`,
        link: `/story?id=${request.story.id}`
      }
    });

    res.json({ message: '申请已拒绝' });
  } catch (error) {
    console.error('Reject collaboration request error:', error);
    res.status(500).json({ error: '拒绝申请失败' });
  }
});

// 获取我的协作申请列表
router.get('/my-requests', authenticateToken, async (req, res) => {
  const userId = getUserId(req);

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const requests = await prisma.collaboration_requests.findMany({
      where: { user_id: userId },
      include: {
        story: {
          select: {
            id: true,
            title: true,
            cover_image: true,
            author: {
              select: {
                id: true,
                username: true,
                avatar: true
              }
            }
          }
        },
        reviewer: {
          select: {
            id: true,
            username: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    res.json({ requests });
  } catch (error) {
    console.error('Get my requests error:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

export default router;

