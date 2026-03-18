# 付费会员系统实现文档

## 📋 实现概览

本次完善实现了完整的付费会员制度，包括：

- ✅ 数据库改造（新增会员相关表和字段）
- ✅ 会员工具模块（权限检查、配额管理）
- ✅ 会员 API 路由（套餐查询、购买、升级、取消）
- ✅ 支付系统集成（订单创建、回调处理）
- ✅ 会员定时任务（到期提醒、自动续费）
- ✅ 前端会员中心页面
- ✅ 管理后台会员统计和管理

## 🗄️ 数据库改造

### 新增字段（users 表）
- `membership_tier`: 会员等级（free/trial/monthly/quarterly/yearly/enterprise）
- `membership_expires_at`: 会员到期时间
- `auto_renew`: 是否自动续费
- `has_used_trial`: 是否已使用过体验会员

### 新增数据表

#### 1. user_subscriptions（会员订阅记录）
保留完整的会员订阅历史，包括：
- 订阅等级、状态、开始/结束时间
- 关联订单、自动续费设置
- 管理员备注

#### 2. membership_benefits_log（会员权益使用日志）
记录会员使用权益的详细信息，用于统计分析。

#### 3. withdrawal_requests（提现申请）
用户收益提现的管理。

## 📦 核心模块

### 1. membership.ts - 会员工具模块

**位置**: `api/src/utils/membership.ts`

**核心功能**:
- `MEMBERSHIP_TIERS`: 会员套餐配置
- `getMembershipTier()`: 获取会员等级信息
- `checkMembershipFeature()`: 检查会员权益
- `getMembershipBenefits()`: 获取会员权益列表
- `getMembershipQuota()`: 获取会员 AI 配额（支持等级倍数）
- `upgradeMembership()`: 升级会员
- `cancelAutoRenew()`: 取消自动续费

**配额计算示例**:
```typescript
// 体验会员：Lv3 配额 + 20%
trial: { quotaMultiplier: 1.2 }

// 月度会员：Lv4 配额 + 50%
monthly: { quotaMultiplier: 1.5 }

// 季度会员：Lv5 配额 + 100%（双倍）
quarterly: { quotaMultiplier: 2.0 }

// 年度会员：Lv5 配额 + 150%
yearly: { quotaMultiplier: 2.5 }

// 企业版：无限配额
enterprise: { quotaMultiplier: -1 }
```

### 2. membership.ts - 会员 API 路由

**位置**: `api/src/routes/membership.ts`

**API 端点**:

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/membership/tiers` | GET | 获取会员套餐列表 |
| `/api/membership/my` | GET | 获取当前用户会员状态 |
| `/api/membership/upgrade/create` | POST | 创建升级订单 |
| `/api/membership/renewal/create` | POST | 创建续费订单 |
| `/api/membership/cancel-renew` | POST | 取消自动续费 |

### 3. admin-membership.ts - 管理员会员路由

**位置**: `api/src/routes/admin-membership.ts`

**API 端点**:

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/admin/membership/stats` | GET | 获取会员统计数据 |
| `/api/admin/membership/members` | GET | 获取会员列表（分页、筛选） |
| `/api/admin/membership/orders` | GET | 获取订单列表（分页、筛选） |
| `/api/admin/membership/members/:userId/adjust` | POST | 手动调整会员状态 |

**统计数据包括**:
- 总会员数、各等级分布
- 今日/本月新增会员
- 即将到期会员数（7 天内）
- 活跃会员数（近 7 天有使用）
- 会员收入统计
- 自动续费开启数

### 4. membershipWorker.ts - 会员定时任务

**位置**: `api/src/workers/membershipWorker.ts`

**定时任务**:
1. **每日检查**（每日执行）:
   - 检查 7 天后到期的会员 → 发送提醒
   - 检查 3 天后到期的会员 → 发送提醒
   - 检查 1 天后到期的会员 → 发送提醒
   - 检查已过期的会员 → 降级为免费用户

2. **每小时检查**:
   - 检查需要自动续费的订阅
   - 创建续费订单并发送通知

**通知渠道**:
- 站内通知（通过 notifications 表）
- 邮件通知（待实现邮件发送功能）

## 🎨 前端页面

### 1. 会员中心页面

**位置**: `web/membership.html`

**功能**:
- 显示当前会员状态（等级、到期时间、自动续费状态）
- 展示所有会员套餐卡片
- 套餐对比（价格、有效期、权益列表、AI 配额）
- 一键购买/升级
- 热门套餐标识

**视觉效果**:
- 渐变紫色背景
- 卡片悬停动画
- 响应式布局
- 会员徽章颜色区分

### 2. 管理后台会员管理

**位置**: `web/admin.html`

**新增功能**:
- 会员统计卡片（7 项关键指标）
- 会员列表（支持等级筛选、搜索）
- 会员详情查看
- 会员徽章样式

## 💰 支付流程

### 购买流程
```
1. 用户选择套餐 → /membership.html
2. 点击"立即开通" → POST /api/membership/upgrade/create
3. 创建订单（含体验会员资格检查）
4. 跳转支付页面（/payment.html?orderId=xxx）
5. 完成支付 → POST /api/payment/callback/mock
6. 更新订单状态 → 调用 upgradeMembership()
7. 更新用户会员状态
```

### 订单类型
- `subscription`: 新购订阅
- `renewal`: 续费订阅
- `points`: 购买积分

### 支付回调处理
开发环境使用模拟支付回调，生产环境需接入：
- 支付宝当面付/手机网站支付
- 微信支付 JSAPI/APP 支付
- 其他第三方支付

## 🔐 权限控制

### 会员专属功能
```typescript
// 检查特定功能权限
const hasAccess = checkMembershipFeature('ai_model_selection', 'monthly');

// 获取配额
const quota = await getMembershipQuota(userId);
// 返回：{ continuation, polish, illustration }
```

### 配额管理
会员配额基于用户等级，并乘以会员倍数：
```typescript
// 示例：Lv3 用户购买月度会员
// 基础配额：continuation=50, polish=30, illustration=10
// 月度会员倍数：1.5
// 最终配额：continuation=75, polish=45, illustration=15
```

## 📊 数据统计

### 会员统计 SQL 查询示例
```typescript
// 各等级会员数分布
await prisma.users.groupBy({
  by: ['membership_tier'],
  where: { membership_tier: { not: 'free' } },
  _count: true
});

// 本月收入统计
await prisma.orders.aggregate({
  where: {
    type: { in: ['subscription', 'renewal'] },
    status: 'paid',
    paid_at: { gte: monthStart }
  },
  _sum: { amount: true }
});
```

## 🚀 部署步骤

### 1. 数据库迁移
```bash
cd api
npx prisma migrate dev --name add_membership_system
npx prisma generate
```

### 2. 环境变量配置
确保 `.env` 文件包含：
```env
# 会员系统
JWT_SECRET=your-secret-key
MEMBERSHIP_CONFIG_PATH=./config/membership.json

# 支付配置（生产环境）
ALIPAY_APP_ID=xxx
ALIPAY_PRIVATE_KEY=xxx
WECHAT_PAY_MCHID=xxx
WECHAT_PAY_KEY=xxx
```

### 3. 启动服务
```bash
# API 服务
cd api
npm start

# 定时任务会自动启动（在 index.ts 中导入）
```

## 🧪 测试建议

### 功能测试
1. **会员购买流程**
   - 免费用户 → 体验会员（验证一次性限制）
   - 免费用户 → 月度/季度/年度会员
   - 体验会员 → 付费会员升级

2. **会员权益验证**
   - AI 配额是否正确计算
   - 会员专属功能是否可用
   - 徽章是否正确显示

3. **续费流程**
   - 自动续费开启/取消
   - 手动续费
   - 续费后的配额更新

4. **到期处理**
   - 到期前提醒（7/3/1 天）
   - 到期后自动降级
   - 降级后配额限制

5. **管理后台**
   - 统计数据准确性
   - 会员列表筛选
   - 手动调整会员状态

### API 测试脚本
```bash
# 获取套餐列表
curl http://localhost:3001/api/membership/tiers

# 获取我的会员状态（需要 Token）
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/membership/my

# 创建升级订单
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tier":"monthly"}' \
  http://localhost:3001/api/membership/upgrade/create
```

## 📝 注意事项

### 1. 会员等级倍数设计
- 配额基于用户等级，会员等级提供倍数加成
- 这样设计鼓励用户同时提升等级和购买会员
- 高等级用户购买会员收益更大

### 2. 体验会员限制
- 每个用户仅限体验一次
- 通过 `has_used_trial` 字段控制
- 防止用户反复体验

### 3. 自动续费
- 目前仅支持手动续费
- 自动续费功能需要接入支付平台的代扣功能
-  Worker 会检查并创建续费订单

### 4. 数据迁移
- 已有订阅用户自动保留权益
- `subscription_type` 字段向后兼容
- 优先使用新的 `membership_tier` 字段

## 🔮 未来扩展

### 短期优化
- [ ] 接入真实支付接口
- [ ] 邮件通知系统
- [ ] 会员数据可视化报表
- [ ] 优惠券/邀请码系统

### 长期规划
- [ ] 会员等级体系优化
- [ ] 会员专属活动
- [ ] 会员成长值系统
- [ ] 企业版多账号管理
- [ ] API 调用限制和计费

## 📚 相关文件

### 后端
- `api/src/utils/membership.ts` - 会员工具函数
- `api/src/routes/membership.ts` - 会员 API
- `api/src/routes/admin-membership.ts` - 管理员 API
- `api/src/workers/membershipWorker.ts` - 定时任务
- `api/src/routes/payment.ts` - 支付处理
- `api/prisma/schema.prisma` - 数据库结构

### 前端
- `web/membership.html` - 会员中心
- `web/admin.html` - 管理后台（会员管理）
- `web/payment.html` - 支付页面

### 数据库迁移
- `api/prisma/migrations/20260316093449_add_member_system_tables/migration.sql`

---

**实现完成时间**: 2026-03-18  
**版本**: M3 - 用户认证与会员系统  
**实现者**: AI Assistant
