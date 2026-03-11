import express from 'express';
import { aiContinuationQueue, aiPolishQueue, aiIllustrationQueue } from '../utils/queue';

const router = express.Router();

/**
 * 获取系统负载状态
 */
router.get('/load', async (req, res) => {
  try {
    // 获取各队列的负载
    const [continuationWaiting, continuationActive] = await Promise.all([
      aiContinuationQueue.getWaitingCount(),
      aiContinuationQueue.getActiveCount()
    ]);
    
    const [polishWaiting, polishActive] = await Promise.all([
      aiPolishQueue.getWaitingCount(),
      aiPolishQueue.getActiveCount()
    ]);
    
    const [illustrationWaiting, illustrationActive] = await Promise.all([
      aiIllustrationQueue.getWaitingCount(),
      aiIllustrationQueue.getActiveCount()
    ]);
    
    const totalWaiting = continuationWaiting + polishWaiting + illustrationWaiting;
    const totalActive = continuationActive + polishActive + illustrationActive;
    const totalLoad = totalWaiting + totalActive;
    
    // 计算负载等级
    let loadLevel: 'low' | 'medium' | 'high' | 'critical';
    let estimatedWaitMinutes: number;
    let recommendation: string;
    
    if (totalLoad < 10) {
      loadLevel = 'low';
      estimatedWaitMinutes = 2;
      recommendation = '当前系统负载较低，您的任务将很快处理';
    } else if (totalLoad < 30) {
      loadLevel = 'medium';
      estimatedWaitMinutes = 5;
      recommendation = '当前系统负载适中，预计等待时间约5分钟';
    } else if (totalLoad < 70) {
      loadLevel = 'high';
      estimatedWaitMinutes = 15;
      recommendation = '当前系统负载较高，建议稍后提交或选择非高峰时段（凌晨0-6点）';
    } else {
      loadLevel = 'critical';
      estimatedWaitMinutes = 30;
      recommendation = '当前系统负载严重，强烈建议选择非高峰时段（凌晨0-6点）提交任务';
    }
    
    res.json({
      loadLevel,
      totalLoad,
      queues: {
        continuation: {
          waiting: continuationWaiting,
          active: continuationActive
        },
        polish: {
          waiting: polishWaiting,
          active: polishActive
        },
        illustration: {
          waiting: illustrationWaiting,
          active: illustrationActive
        }
      },
      estimatedWaitMinutes,
      recommendation,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取系统负载失败:', error);
    res.status(500).json({ error: '获取系统负载失败' });
  }
});

/**
 * 获取推荐的提交时间
 */
router.get('/recommended-times', async (req, res) => {
  try {
    const now = new Date();
    const currentHour = now.getHours();
    
    // 定义高峰时段（8-23点）
    const isPeakHour = currentHour >= 8 && currentHour < 23;
    
    // 推荐时间段
    const recommendedTimes = [];
    
    if (isPeakHour) {
      // 如果当前是高峰期，推荐今晚或明早
      const tonight = new Date(now);
      tonight.setHours(22, 0, 0, 0);
      if (tonight > now) {
        recommendedTimes.push({
          label: '今晚22:00（推荐）',
          time: tonight.toISOString(),
          reason: '夜间系统负载较低'
        });
      }
      
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(2, 0, 0, 0);
      recommendedTimes.push({
        label: '明天凌晨2:00（最佳）',
        time: tomorrow.toISOString(),
        reason: '凌晨时段系统负载最低，处理最快'
      });
      
      const tomorrowMorning = new Date(now);
      tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
      tomorrowMorning.setHours(6, 0, 0, 0);
      recommendedTimes.push({
        label: '明天早上6:00',
        time: tomorrowMorning.toISOString(),
        reason: '早晨时段系统负载较低'
      });
    } else {
      // 如果当前是非高峰期，推荐立即执行
      recommendedTimes.push({
        label: '立即执行（推荐）',
        time: 'immediate',
        reason: '当前系统负载较低，适合立即执行'
      });
      
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(2, 0, 0, 0);
      recommendedTimes.push({
        label: '明天凌晨2:00',
        time: tomorrow.toISOString(),
        reason: '凌晨时段系统负载最低'
      });
    }
    
    res.json({
      isPeakHour,
      currentHour,
      recommendedTimes
    });
  } catch (error) {
    console.error('获取推荐时间失败:', error);
    res.status(500).json({ error: '获取推荐时间失败' });
  }
});

export default router;

