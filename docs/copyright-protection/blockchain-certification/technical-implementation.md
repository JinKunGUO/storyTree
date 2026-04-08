# StoryTree 区块链存证技术实现文档

> 版本：v1.0 | 更新日期：2026-04-07

---

## 一、系统架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    StoryTree 业务层                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 章节发布  │  │ 内容修改  │  │ 协作确认  │  │ 版权声明  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
└───────┼─────────────┼─────────────┼──────────────┼─────────┘
        │             │             │              │
        ▼             ▼             ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│                  版权存证服务层 (CertificationService)       │
│                                                             │
│  ┌─────────────────┐      ┌──────────────────────────────┐  │
│  │  内容哈希计算器   │      │      存证队列 (Redis Queue)   │  │
│  │  (SHA-256)      │      │      异步批量处理             │  │
│  └────────┬────────┘      └──────────────┬───────────────┘  │
│           │                              │                  │
│           ▼                              ▼                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              区块链适配器层 (Blockchain Adapter)      │    │
│  │   ┌─────────────────┐  ┌─────────────────────────┐  │    │
│  │   │  AntChainAdapter │  │  ZhiXinChainAdapter     │  │    │
│  │   └────────┬─────────┘  └────────────┬────────────┘  │    │
│  └────────────┼──────────────────────────┼──────────────┘    │
└───────────────┼──────────────────────────┼──────────────────┘
                ▼                          ▼
        ┌───────────────┐        ┌──────────────────┐
        │   蚂蚁链 API   │        │   至信链 API      │
        └───────────────┘        └──────────────────┘
```

---

## 二、数据库设计

### 2.1 存证记录表

```sql
-- 版权存证记录表
CREATE TABLE copyright_certifications (
  id            BIGSERIAL PRIMARY KEY,
  
  -- 业务关联
  content_type  VARCHAR(50) NOT NULL,  -- 'story', 'chapter', 'collaboration'
  content_id    VARCHAR(100) NOT NULL, -- 对应业务ID
  author_id     BIGINT NOT NULL,       -- 创作者用户ID
  
  -- 内容指纹
  content_hash  VARCHAR(64) NOT NULL,  -- SHA-256 哈希
  metadata_hash VARCHAR(64),           -- 元数据哈希
  
  -- 区块链存证结果
  chain_type    VARCHAR(20) NOT NULL,  -- 'antchain', 'zhixinchain'
  cert_id       VARCHAR(200),          -- 存证ID
  tx_hash       VARCHAR(200),          -- 链上交易哈希
  block_height  BIGINT,                -- 区块高度
  block_time    TIMESTAMP,             -- 上链时间
  
  -- 证书信息
  cert_url      TEXT,                  -- 证书下载链接
  verify_url    TEXT,                  -- 验证链接
  
  -- 状态管理
  status        VARCHAR(20) DEFAULT 'pending', -- pending/success/failed
  retry_count   INT DEFAULT 0,
  error_message TEXT,
  
  -- 时间戳
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW(),
  
  -- 索引
  UNIQUE(content_type, content_id, chain_type),
  INDEX idx_author_id (author_id),
  INDEX idx_content (content_type, content_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

-- 存证元数据表（存储完整的存证请求数据）
CREATE TABLE certification_metadata (
  id               BIGSERIAL PRIMARY KEY,
  certification_id BIGINT NOT NULL REFERENCES copyright_certifications(id),
  metadata         JSONB NOT NULL,    -- 完整的存证元数据
  created_at       TIMESTAMP DEFAULT NOW()
);
```

### 2.2 Prisma Schema 定义

```prisma
model CopyrightCertification {
  id          BigInt   @id @default(autoincrement())
  
  contentType String   @db.VarChar(50)
  contentId   String   @db.VarChar(100)
  authorId    BigInt
  
  contentHash String   @db.VarChar(64)
  metadataHash String? @db.VarChar(64)
  
  chainType   String   @db.VarChar(20)
  certId      String?  @db.VarChar(200)
  txHash      String?  @db.VarChar(200)
  blockHeight BigInt?
  blockTime   DateTime?
  
  certUrl     String?
  verifyUrl   String?
  
  status      String   @default("pending") @db.VarChar(20)
  retryCount  Int      @default(0)
  errorMessage String?
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  author      User     @relation(fields: [authorId], references: [id])
  
  @@unique([contentType, contentId, chainType])
  @@index([authorId])
  @@index([contentType, contentId])
  @@index([status])
  @@map("copyright_certifications")
}
```

---

## 三、核心服务实现

### 3.1 存证服务主类

```javascript
// api/src/services/certificationService.js
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const AntChainCertification = require('./antchain-certification');
const ZhiXinChainCertification = require('./zhixinchain-certification');
const Queue = require('bull');

const prisma = new PrismaClient();

// 存证队列（Redis）
const certQueue = new Queue('copyright-certification', {
  redis: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT }
});

class CertificationService {
  constructor() {
    this.antchain = new AntChainCertification({
      appId: process.env.ANTCHAIN_APP_ID,
      appKey: process.env.ANTCHAIN_APP_KEY,
      appSecret: process.env.ANTCHAIN_APP_SECRET,
    });
    
    this.zhixinchain = new ZhiXinChainCertification({
      appId: process.env.ZHIXINCHAIN_APP_ID,
      appSecret: process.env.ZHIXINCHAIN_APP_SECRET,
    });
    
    // 启动队列处理器
    this.initQueueProcessor();
  }

  /**
   * 触发章节存证（异步）
   * @param {Object} chapter - 章节对象
   */
  async certifyChapter(chapter) {
    // 计算内容哈希
    const contentHash = this.computeHash(chapter.content);
    
    // 构建元数据
    const metadata = {
      storyId: chapter.storyId,
      chapterId: chapter.id,
      authorId: chapter.authorId,
      authorName: chapter.author.username,
      title: chapter.title,
      wordCount: chapter.content.length,
      parentChapterId: chapter.parentId,
      isAIAssisted: chapter.isAIAssisted || false,
      createTime: chapter.createdAt.toISOString(),
      platform: 'StoryTree',
      version: '1.0',
    };

    // 创建待处理的存证记录
    const certRecord = await prisma.copyrightCertification.create({
      data: {
        contentType: 'chapter',
        contentId: chapter.id.toString(),
        authorId: chapter.authorId,
        contentHash,
        metadataHash: this.computeHash(JSON.stringify(metadata)),
        chainType: 'antchain', // 主链
        status: 'pending',
      },
    });

    // 加入异步队列
    await certQueue.add('certify', {
      certRecordId: certRecord.id,
      metadata,
      contentHash,
    }, {
      attempts: 3,        // 最多重试3次
      backoff: {
        type: 'exponential',
        delay: 5000,      // 初始延迟5秒
      },
    });

    return certRecord;
  }

  /**
   * 计算内容哈希
   */
  computeHash(content) {
    return crypto
      .createHash('sha256')
      .update(typeof content === 'string' ? content : JSON.stringify(content), 'utf8')
      .digest('hex');
  }

  /**
   * 初始化队列处理器
   */
  initQueueProcessor() {
    certQueue.process('certify', async (job) => {
      const { certRecordId, metadata, contentHash } = job.data;
      
      try {
        // 调用蚂蚁链存证
        const result = await this.antchain.submitCertification({
          contentHash,
          contentType: 'text',
          authorId: metadata.authorId.toString(),
          title: metadata.title,
          createTime: metadata.createTime,
        });

        // 更新存证记录
        await prisma.copyrightCertification.update({
          where: { id: certRecordId },
          data: {
            certId: result.certId,
            txHash: result.txHash,
            blockHeight: result.blockHeight,
            blockTime: new Date(result.timestamp),
            status: 'success',
          },
        });

        console.log(`存证成功: certId=${result.certId}, txHash=${result.txHash}`);
        
      } catch (error) {
        // 更新失败状态
        await prisma.copyrightCertification.update({
          where: { id: certRecordId },
          data: {
            status: job.attemptsMade >= 2 ? 'failed' : 'pending',
            retryCount: job.attemptsMade + 1,
            errorMessage: error.message,
          },
        });
        
        throw error; // 重新抛出，触发重试
      }
    });
  }

  /**
   * 查询章节的存证信息
   */
  async getCertification(contentType, contentId) {
    return prisma.copyrightCertification.findFirst({
      where: {
        contentType,
        contentId: contentId.toString(),
        status: 'success',
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

module.exports = new CertificationService();
```

### 3.2 API 路由

```javascript
// api/src/routes/certification.js
const express = require('express');
const router = express.Router();
const certificationService = require('../services/certificationService');
const { authenticate } = require('../middleware/auth');

/**
 * GET /api/certification/chapter/:chapterId
 * 查询章节存证信息
 */
router.get('/chapter/:chapterId', async (req, res) => {
  try {
    const cert = await certificationService.getCertification(
      'chapter',
      req.params.chapterId
    );
    
    if (!cert) {
      return res.json({ certified: false });
    }
    
    res.json({
      certified: true,
      certId: cert.certId,
      txHash: cert.txHash,
      blockTime: cert.blockTime,
      verifyUrl: cert.verifyUrl,
      chainType: cert.chainType,
    });
  } catch (error) {
    res.status(500).json({ error: '查询存证信息失败' });
  }
});

/**
 * GET /api/certification/chapter/:chapterId/certificate
 * 下载存证证书
 */
router.get('/chapter/:chapterId/certificate', authenticate, async (req, res) => {
  try {
    const cert = await certificationService.getCertification(
      'chapter',
      req.params.chapterId
    );
    
    if (!cert || cert.status !== 'success') {
      return res.status(404).json({ error: '存证记录不存在' });
    }
    
    // 验证权限（只有作者可以下载证书）
    if (cert.authorId !== req.user.id) {
      return res.status(403).json({ error: '无权限下载此证书' });
    }
    
    const pdfBuffer = await certificationService.antchain.downloadCertificate(cert.certId);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="cert-${cert.certId}.pdf"`);
    res.send(pdfBuffer);
    
  } catch (error) {
    res.status(500).json({ error: '下载证书失败' });
  }
});

module.exports = router;
```

---

## 四、前端集成

### 4.1 存证状态徽章组件

```jsx
// web/src/components/CertificationBadge.jsx
import React, { useState, useEffect } from 'react';

export const CertificationBadge = ({ chapterId }) => {
  const [certInfo, setCertInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/certification/chapter/${chapterId}`)
      .then(res => res.json())
      .then(data => {
        setCertInfo(data);
        setLoading(false);
      });
  }, [chapterId]);

  if (loading || !certInfo?.certified) return null;

  return (
    <div className="cert-badge" title="此内容已进行区块链版权存证">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        {/* 盾牌图标 */}
        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
        <path d="M10 17l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" fill="white"/>
      </svg>
      <span>已存证</span>
      <a
        href={certInfo.verifyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="cert-verify-link"
      >
        验证
      </a>
    </div>
  );
};
```

---

## 五、监控与运维

### 5.1 存证成功率监控

```javascript
// 定时任务：检查存证失败记录并告警
const checkCertificationHealth = async () => {
  const failedCount = await prisma.copyrightCertification.count({
    where: {
      status: 'failed',
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // 最近24小时
    },
  });

  if (failedCount > 100) {
    // 发送告警通知
    console.error(`存证失败数量异常: ${failedCount} 条/24h`);
    // TODO: 接入告警系统（钉钉/企业微信/邮件）
  }
};
```

### 5.2 关键指标

| 指标 | 目标值 | 告警阈值 |
|------|-------|---------|
| 存证成功率 | > 99% | < 95% |
| 存证平均延迟 | < 5s | > 30s |
| 队列积压数量 | < 1000 | > 10000 |
| 每日存证量 | 监控趋势 | 异常波动 |

---

## 六、安全注意事项

1. **API 密钥安全**：区块链 API 密钥存储在环境变量中，不得提交到代码仓库
2. **内容哈希**：存证的是内容哈希，不是原始内容，保护用户隐私
3. **幂等性**：使用业务 ID 保证同一内容不会重复存证
4. **权限控制**：存证证书下载接口需要身份验证
5. **费用控制**：设置每日存证量上限，防止异常消耗

---

## 七、环境变量配置

```bash
# .env 文件（示例）

# 蚂蚁链配置
ANTCHAIN_APP_ID=your_antchain_app_id
ANTCHAIN_APP_KEY=your_antchain_app_key
ANTCHAIN_APP_SECRET=your_antchain_app_secret

# 至信链配置
ZHIXINCHAIN_APP_ID=your_zhixinchain_app_id
ZHIXINCHAIN_APP_SECRET=your_zhixinchain_app_secret

# Redis（存证队列）
REDIS_HOST=localhost
REDIS_PORT=6379

# 功能开关
CERTIFICATION_ENABLED=true
CERTIFICATION_CHAIN=antchain  # antchain / zhixinchain / both
```

