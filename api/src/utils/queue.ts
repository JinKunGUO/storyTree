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
    removeOnComplete: 100,
    removeOnFail: 50
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
    removeOnComplete: 100,
    removeOnFail: 50
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
    removeOnComplete: 100,
    removeOnFail: 50
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
    removeOnComplete: 100,
    removeOnFail: 50
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
    removeOnComplete: 100,
    removeOnFail: 50
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
    removeOnComplete: 100,
    removeOnFail: 50
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
    removeOnComplete: 100,
    removeOnFail: 50
  }
});

// 队列事件监听
aiPasticheQueue.on('completed', (job, result) => {
  console.log(`✅ AI 仿写任务完成：${job.id}`);
});

aiPasticheQueue.on('failed', (job, err) => {
  console.error(`❌ AI 仿写任务失败：${job?.id}`, err);
});

aiTemplateQueue.on('completed', (job, result) => {
  console.log(`✅ AI 模板任务完成：${job.id}`);
});

aiTemplateQueue.on('failed', (job, err) => {
  console.error(`❌ AI 模板任务失败：${job?.id}`, err);
});

// 队列事件监听
aiProjectBriefQueue.on('completed', (job, result) => {
  console.log(`✅ AI 立项书任务完成：${job.id}`);
});

aiProjectBriefQueue.on('failed', (job, err) => {
  console.error(`❌ AI 立项书任务失败：${job?.id}`, err);
});

aiOutlineQueue.on('completed', (job, result) => {
  console.log(`✅ AI 大纲任务完成：${job.id}`);
});

aiOutlineQueue.on('failed', (job, err) => {
  console.error(`❌ AI 大纲任务失败：${job?.id}`, err);
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

