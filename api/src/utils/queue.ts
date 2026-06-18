import Queue from 'bull';
import Redis from 'ioredis';

// Redis配置
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false
};

// 创建Redis客户端
export const redisClient = new Redis(redisConfig);

// 创建任务队列
export const aiContinuationQueue = new Queue('ai-continuation', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    timeout: 300000, // 5分钟超时
    removeOnComplete: 100,
    removeOnFail: 50
  },
  settings: {
    stalledInterval: 120000, // 2分钟检测卡死任务
    maxStalledCount: 2
  }
});

export const aiPolishQueue = new Queue('ai-polish', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    timeout: 300000, // 5分钟超时
    removeOnComplete: 100,
    removeOnFail: 50
  },
  settings: {
    stalledInterval: 120000,
    maxStalledCount: 2
  }
});

export const aiIllustrationQueue = new Queue('ai-illustration', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    timeout: 600000, // 10分钟超时（图片生成耗时较长）
    removeOnComplete: 100,
    removeOnFail: 50
  },
  settings: {
    stalledInterval: 180000,
    maxStalledCount: 2
  }
});

// AI 辅助创作队列（立项书/大纲生成）
export const aiProjectBriefQueue = new Queue('ai-project-brief', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    timeout: 300000,
    removeOnComplete: 100,
    removeOnFail: 50
  },
  settings: {
    stalledInterval: 120000,
    maxStalledCount: 2
  }
});

export const aiOutlineQueue = new Queue('ai-outline', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    timeout: 300000,
    removeOnComplete: 100,
    removeOnFail: 50
  },
  settings: {
    stalledInterval: 120000,
    maxStalledCount: 2
  }
});

// AI 仿写和模板队列
export const aiPasticheQueue = new Queue('ai-pastiche', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    timeout: 300000,
    removeOnComplete: 100,
    removeOnFail: 50
  },
  settings: {
    stalledInterval: 120000,
    maxStalledCount: 2
  }
});

export const aiTemplateQueue = new Queue('ai-template', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    timeout: 300000,
    removeOnComplete: 100,
    removeOnFail: 50
  },
  settings: {
    stalledInterval: 120000,
    maxStalledCount: 2
  }
});

// 队列事件监听（完成日志统一由 aiWorker.ts 输出，此处仅输出失败日志）
aiPasticheQueue.on('failed', (job, err) => {
  console.error(`❌ AI 仿写任务失败 (job=${job?.id}):`, err.message);
});

aiTemplateQueue.on('failed', (job, err) => {
  console.error(`❌ AI 模板任务失败 (job=${job?.id}):`, err.message);
});

aiProjectBriefQueue.on('failed', (job, err) => {
  console.error(`❌ AI 立项书任务失败 (job=${job?.id}):`, err.message);
});

aiOutlineQueue.on('failed', (job, err) => {
  console.error(`❌ AI 大纲任务失败 (job=${job?.id}):`, err.message);
});

// 队列事件监听
aiContinuationQueue.on('completed', (job, result) => {
  console.log(`✅ AI续写任务完成: ${job.id}`);
});

aiContinuationQueue.on('failed', (job, err) => {
  console.error(`❌ AI续写任务失败: ${job?.id}`, err);
});

aiPolishQueue.on('completed', (job, result) => {
  console.log(`✅ AI润色任务完成: ${job.id}`);
});

aiPolishQueue.on('failed', (job, err) => {
  console.error(`❌ AI润色任务失败: ${job?.id}`, err);
});

aiIllustrationQueue.on('completed', (job, result) => {
  console.log(`✅ AI插图任务完成: ${job.id}`);
});

aiIllustrationQueue.on('failed', (job, err) => {
  console.error(`❌ AI插图任务失败: ${job?.id}`, err);
});

// 优雅关闭
export const closeQueues = async () => {
  await aiContinuationQueue.close();
  await aiPolishQueue.close();
  await aiIllustrationQueue.close();
  await aiProjectBriefQueue.close();
  await aiOutlineQueue.close();
  await aiPasticheQueue.close();
  await aiTemplateQueue.close();
  await redisClient.quit();
};

