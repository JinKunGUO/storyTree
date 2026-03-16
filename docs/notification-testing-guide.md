# 通知功能检查和测试报告

## 📊 通知功能现状分析

### ✅ 已实现的通知场景

根据代码分析，当前系统已实现以下通知场景：

#### 1. **协作相关通知** ✅

| 场景 | 通知类型 | 接收者 | 触发时机 | 代码位置 |
|------|---------|-------|---------|---------|
| 新的协作申请 | `COLLABORATION_REQUEST` | 故事作者 | 用户提交协作申请（非自动通过） | `collaboration-requests.ts:172-180` |
| 协作申请已通过 | `COLLABORATION_APPROVED` | 申请人 | 作者批准申请 / 自动批准 | `collaboration-requests.ts:156-160, 263-267, 448-452` |
| 协作申请未通过 | `COLLABORATION_REJECTED` | 申请人 | 作者拒绝申请 | `collaboration-requests.ts:514-518` |
| 协作邀请 | `COLLABORATION_INVITE` | 被邀请人 | 主创直接添加协作者 | `stories.ts:701-709` |

#### 2. **社交相关通知** ✅

| 场景 | 通知类型 | 接收者 | 触发时机 | 代码位置 |
|------|---------|-------|---------|---------|
| 新粉丝 | `follow` | 被关注者 | 用户关注其他用户 | `users.ts:103-109` |

#### 3. **AI功能通知** ✅

| 场景 | 通知类型 | 接收者 | 触发时机 | 代码位置 |
|------|---------|-------|---------|---------|
| AI续写完成 | `AI_CONTINUATION_READY` | 任务创建者 | AI续写任务完成 | `notification.ts:48-56` |
| AI润色完成 | `AI_POLISH_READY` | 任务创建者 | AI润色任务完成 | `notification.ts:63-71` |
| AI插图完成 | `AI_ILLUSTRATION_READY` | 任务创建者 | AI插图任务完成 | `notification.ts:78-86` |

#### 4. **用户成长通知** ✅

| 场景 | 通知类型 | 接收者 | 触发时机 | 代码位置 |
|------|---------|-------|---------|---------|
| 等级升级 | `LEVEL_UP` | 升级用户 | 用户等级提升 | `notification.ts:93-101` |
| 获得积分 | `POINTS_EARNED` | 获得积分用户 | 用户获得积分奖励 | `notification.ts:108-116` |

---

## 🔍 问题诊断

### 为什么收不到通知？

根据代码分析，可能的原因：

#### 1. **通知创建代码存在但未被调用** ⚠️

虽然通知创建的代码已经实现，但需要检查：
- ✅ 协作申请通知：代码已实现
- ✅ 关注通知：代码已实现
- ⚠️ AI功能通知：代码已实现，但需要检查AI任务完成后是否调用
- ⚠️ 用户成长通知：代码已实现，但需要检查是否有地方调用

#### 2. **数据库问题** ⚠️

可能的问题：
- notifications表是否存在？
- notifications表结构是否正确？
- 是否有数据库权限问题？

#### 3. **前端显示问题** ⚠️

可能的问题：
- 前端是否正确请求通知API？
- 前端是否正确解析和显示通知？

---

## 🧪 完整测试方案

### 测试前准备

1. **检查数据库表**

```sql
-- 检查notifications表是否存在
SELECT * FROM sqlite_master WHERE type='table' AND name='notifications';

-- 检查表结构
PRAGMA table_info(notifications);

-- 查看现有通知数据
SELECT * FROM notifications ORDER BY created_at DESC LIMIT 10;
```

2. **检查后端API**

```bash
# 启动后端服务
cd api && npm run dev

# 查看日志，确认API启动成功
```

3. **检查前端页面**

```bash
# 访问通知页面
open http://localhost:3000/notifications.html
```

---

### 测试场景1：关注用户通知 ⭐

**目的**：验证最简单的通知功能

**前置条件**：
- 用户A已登录
- 用户B已登录（另一个浏览器或无痕模式）

**测试步骤**：
1. 用户A访问用户B的个人主页
2. 点击"关注"按钮
3. 用户B刷新通知页面

**预期结果**：
- ✅ 用户B收到通知："用户A 关注了你"
- ✅ 通知类型：`follow`
- ✅ 点击通知跳转到用户A的主页

**调试方法**：
```bash
# 查看后端日志
# 应该看到类似：
# POST /api/users/:id/follow
# 📬 通知已创建: 新粉丝 (用户X)

# 查看数据库
sqlite3 api/prisma/prisma/dev.db "SELECT * FROM notifications WHERE type='follow' ORDER BY created_at DESC LIMIT 5;"
```

---

### 测试场景2：协作申请通知（自动通过）⭐

**目的**：验证协作相关通知

**前置条件**：
- 用户A已登录（故事作者）
- 用户B已登录（申请人）
- 故事设置中开启"自动通过协作申请"

**测试步骤**：
1. 用户B访问用户A的故事页面
2. 点击"申请协作"按钮
3. 填写申请留言："我想参与创作"
4. 提交申请
5. 用户B刷新通知页面

**预期结果**：
- ✅ 用户B收到通知："协作申请已自动通过"
- ✅ 通知类型：`COLLABORATION_APPROVED`
- ✅ 点击通知跳转到故事页面

**调试方法**：
```bash
# 查看后端日志
# 应该看到类似：
# POST /api/collaboration-requests
# 📬 通知已创建: 协作申请已通过 (用户X)

# 查看数据库
sqlite3 api/prisma/prisma/dev.db "SELECT * FROM notifications WHERE type='COLLABORATION_APPROVED' ORDER BY created_at DESC LIMIT 5;"
```

---

### 测试场景3：协作申请通知（需要审核）⭐

**目的**：验证需要审核的协作申请通知

**前置条件**：
- 用户A已登录（故事作者）
- 用户B已登录（申请人）
- 故事设置中关闭"自动通过协作申请"

**测试步骤**：
1. 用户B访问用户A的故事页面
2. 点击"申请协作"按钮
3. 填写申请留言："我想参与创作"
4. 提交申请
5. 用户A刷新通知页面

**预期结果**：
- ✅ 用户A收到通知："新的协作申请"
- ✅ 通知类型：`COLLABORATION_REQUEST`
- ✅ 点击通知跳转到故事设置页面的申请列表

**后续步骤**：
6. 用户A在故事设置中批准申请
7. 用户B刷新通知页面

**预期结果**：
- ✅ 用户B收到通知："协作申请已通过"
- ✅ 通知类型：`COLLABORATION_APPROVED`

**调试方法**：
```bash
# 查看后端日志
# 提交申请时：
# POST /api/collaboration-requests
# 📬 通知已创建: 新的协作申请 (用户A)

# 批准申请时：
# PUT /api/collaboration-requests/:id/approve
# 📬 通知已创建: 协作申请已通过 (用户B)

# 查看数据库
sqlite3 api/prisma/prisma/dev.db "SELECT * FROM notifications WHERE type IN ('COLLABORATION_REQUEST', 'COLLABORATION_APPROVED') ORDER BY created_at DESC LIMIT 10;"
```

---

### 测试场景4：主创直接添加协作者通知 ⭐

**目的**：验证主创邀请协作者的通知

**前置条件**：
- 用户A已登录（故事作者）
- 用户B已注册（用户名：testuser）

**测试步骤**：
1. 用户A访问故事设置页面
2. 在"协作者管理"部分，输入用户名：testuser
3. 点击"添加协作者"按钮
4. 用户B刷新通知页面

**预期结果**：
- ✅ 用户B收到通知："协作邀请"
- ✅ 通知类型：`COLLABORATION_INVITE`
- ✅ 点击通知跳转到故事页面

**调试方法**：
```bash
# 查看后端日志
# POST /api/stories/:id/collaborators
# 📬 通知已创建: 协作邀请 (用户B)

# 查看数据库
sqlite3 api/prisma/prisma/dev.db "SELECT * FROM notifications WHERE type='COLLABORATION_INVITE' ORDER BY created_at DESC LIMIT 5;"
```

---

## 🔧 调试工具

### 1. 数据库查询脚本

创建文件：`api/scripts/check-notifications.sql`

```sql
-- 查看所有通知
SELECT 
    n.id,
    n.user_id,
    u.username,
    n.type,
    n.title,
    n.content,
    n.is_read,
    n.created_at
FROM notifications n
LEFT JOIN users u ON n.user_id = u.id
ORDER BY n.created_at DESC
LIMIT 20;

-- 按类型统计通知数量
SELECT type, COUNT(*) as count
FROM notifications
GROUP BY type;

-- 查看未读通知
SELECT 
    n.id,
    u.username,
    n.type,
    n.title,
    n.created_at
FROM notifications n
LEFT JOIN users u ON n.user_id = u.id
WHERE n.is_read = 0
ORDER BY n.created_at DESC;

-- 查看特定用户的通知
SELECT 
    n.id,
    n.type,
    n.title,
    n.content,
    n.is_read,
    n.created_at
FROM notifications n
WHERE n.user_id = 1  -- 替换为实际用户ID
ORDER BY n.created_at DESC;
```

### 2. 后端测试脚本

创建文件：`api/scripts/test-notifications.ts`

```typescript
import { prisma } from '../src/index';

async function testNotifications() {
  console.log('🧪 测试通知功能...\n');

  // 1. 检查notifications表
  console.log('1️⃣ 检查notifications表...');
  const notificationCount = await prisma.notifications.count();
  console.log(`   通知总数: ${notificationCount}\n`);

  // 2. 查看最新的5条通知
  console.log('2️⃣ 最新的5条通知:');
  const recentNotifications = await prisma.notifications.findMany({
    take: 5,
    orderBy: { created_at: 'desc' },
    include: {
      user: {
        select: { username: true }
      }
    }
  });

  recentNotifications.forEach((n, index) => {
    console.log(`   ${index + 1}. [${n.type}] ${n.title}`);
    console.log(`      接收者: ${n.user.username}`);
    console.log(`      内容: ${n.content}`);
    console.log(`      已读: ${n.is_read ? '是' : '否'}`);
    console.log(`      时间: ${n.created_at}`);
    console.log('');
  });

  // 3. 按类型统计
  console.log('3️⃣ 通知类型统计:');
  const types = await prisma.notifications.groupBy({
    by: ['type'],
    _count: { type: true }
  });

  types.forEach(t => {
    console.log(`   ${t.type}: ${t._count.type} 条`);
  });

  console.log('\n✅ 测试完成');
}

testNotifications()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### 3. 手动创建测试通知

创建文件：`api/scripts/create-test-notification.ts`

```typescript
import { prisma } from '../src/index';

async function createTestNotification() {
  // 获取第一个用户
  const user = await prisma.users.findFirst();
  
  if (!user) {
    console.log('❌ 没有找到用户');
    return;
  }

  console.log(`📬 为用户 ${user.username} (ID: ${user.id}) 创建测试通知...`);

  const notification = await prisma.notifications.create({
    data: {
      user_id: user.id,
      type: 'TEST',
      title: '🧪 测试通知',
      content: '这是一条测试通知，用于验证通知功能是否正常工作',
      link: '/notifications',
      is_read: false
    }
  });

  console.log('✅ 测试通知创建成功！');
  console.log('   ID:', notification.id);
  console.log('   标题:', notification.title);
  console.log('   请访问通知页面查看');
}

createTestNotification()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

## 📋 测试检查清单

### 前置检查

- [ ] 数据库中notifications表存在
- [ ] 后端服务正常启动
- [ ] 至少有2个测试用户账号
- [ ] 至少有1个测试故事

### 通知功能测试

- [ ] 场景1：关注用户通知
  - [ ] 用户A关注用户B
  - [ ] 用户B收到通知
  - [ ] 点击通知跳转正确
  
- [ ] 场景2：协作申请通知（自动通过）
  - [ ] 用户B申请协作
  - [ ] 用户B收到"申请已通过"通知
  - [ ] 点击通知跳转正确
  
- [ ] 场景3：协作申请通知（需要审核）
  - [ ] 用户B申请协作
  - [ ] 用户A收到"新的协作申请"通知
  - [ ] 用户A批准申请
  - [ ] 用户B收到"申请已通过"通知
  
- [ ] 场景4：主创直接添加协作者
  - [ ] 用户A添加用户B为协作者
  - [ ] 用户B收到"协作邀请"通知
  
- [ ] 场景5：拒绝协作申请
  - [ ] 用户B申请协作
  - [ ] 用户A拒绝申请
  - [ ] 用户B收到"申请未通过"通知

### 前端功能测试

- [ ] 通知列表正确显示
- [ ] 未读通知有标记
- [ ] 点击通知跳转正确
- [ ] 标记为已读功能正常
- [ ] 删除通知功能正常
- [ ] 通知筛选功能正常
- [ ] 通知铃铛显示未读数量

---

## 🐛 常见问题排查

### 问题1：数据库中没有通知数据

**排查步骤**：
1. 检查notifications表是否存在
   ```sql
   SELECT * FROM sqlite_master WHERE type='table' AND name='notifications';
   ```

2. 检查表结构
   ```sql
   PRAGMA table_info(notifications);
   ```

3. 手动创建测试通知
   ```bash
   cd api && npx ts-node scripts/create-test-notification.ts
   ```

### 问题2：后端API返回空数组

**排查步骤**：
1. 检查API请求是否携带正确的token
2. 检查user_id是否正确
3. 查看后端日志，确认SQL查询
4. 直接查询数据库验证数据

### 问题3：前端不显示通知

**排查步骤**：
1. 打开浏览器开发者工具
2. 查看Network标签，确认API请求成功
3. 查看Console标签，查找JavaScript错误
4. 检查HTML元素是否正确渲染

### 问题4：通知创建代码未执行

**排查步骤**：
1. 在通知创建代码处添加console.log
2. 触发相应的操作
3. 查看后端日志，确认代码是否执行
4. 如果未执行，检查业务逻辑流程

---

## 🚀 立即执行的测试步骤

### 步骤1：检查数据库（5分钟）

```bash
cd /Users/jinkun/storytree
sqlite3 api/prisma/prisma/dev.db

# 执行以下SQL
SELECT * FROM sqlite_master WHERE type='table' AND name='notifications';
SELECT COUNT(*) as total FROM notifications;
SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5;
.quit
```

### 步骤2：创建测试通知（5分钟）

```bash
cd api
# 创建测试脚本
cat > scripts/create-test-notification.ts << 'EOF'
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.users.findFirst();
  if (!user) {
    console.log('❌ 没有用户');
    return;
  }

  const notification = await prisma.notifications.create({
    data: {
      user_id: user.id,
      type: 'TEST',
      title: '🧪 测试通知',
      content: '这是一条测试通知',
      is_read: false
    }
  });

  console.log('✅ 通知创建成功:', notification.id);
}

main().finally(() => prisma.$disconnect());
EOF

# 执行脚本
npx ts-node scripts/create-test-notification.ts
```

### 步骤3：访问通知页面（2分钟）

```bash
# 确保服务运行
cd api && npm run dev &

# 访问通知页面
open http://localhost:3000/notifications.html
```

### 步骤4：测试关注通知（5分钟）

1. 打开两个浏览器窗口
2. 分别登录两个不同的用户
3. 用户A关注用户B
4. 用户B刷新通知页面，查看是否收到通知

---

## 📊 预期结果

如果通知功能正常，应该看到：

1. **数据库中有通知数据**
2. **前端通知页面能正确显示通知**
3. **点击通知能跳转到正确的页面**
4. **标记为已读功能正常**
5. **通知铃铛显示未读数量**

---

## 🎯 下一步行动

1. ✅ 立即执行"步骤1：检查数据库"
2. ✅ 如果数据库为空，执行"步骤2：创建测试通知"
3. ✅ 执行"步骤3：访问通知页面"
4. ✅ 执行"步骤4：测试关注通知"
5. 根据测试结果，确定具体问题并修复

---

**让我们开始测试吧！** 🚀

