# 邀请码系统实施总结

## 📋 项目概述

本文档记录了StoryTree平台邀请码系统的完整实施过程，包括后端API、前端UI和管理工具。

## ✅ 已完成功能

### 1. 后端API实现

#### 1.1 邀请码路由 (`api/src/routes/invitations.ts`)

**核心功能：**

- ✅ **验证邀请码** (`GET /api/invitations/validate/:code`)
  - 公开接口，无需登录
  - 验证邀请码有效性、过期时间、使用次数
  - 返回邀请码信息和奖励积分

- ✅ **获取我的邀请码** (`GET /api/invitations/my-codes`)
  - 需要登录
  - 自动为符合条件的用户生成邀请码
  - 返回邀请统计（邀请人数、总奖励）
  - 显示被邀请人的详细信息

- ✅ **批量生成邀请码** (`POST /api/invitations/admin/generate`)
  - 需要管理员权限
  - 可配置：数量、奖励积分、最大使用次数、有效期
  - 自动去重，确保邀请码唯一

- ✅ **获取邀请码列表** (`GET /api/invitations/admin/codes`)
  - 需要管理员权限
  - 支持分页和筛选（类型、状态）
  - 显示创建者、使用情况

- ✅ **禁用/启用邀请码** (`PATCH /api/invitations/admin/codes/:code/toggle`)
  - 需要管理员权限
  - 一键切换邀请码状态

- ✅ **邀请统计** (`GET /api/invitations/admin/stats`)
  - 需要管理员权限
  - 总邀请码数、活跃码数、总邀请人数
  - 最近30天邀请趋势
  - Top 10邀请者排行榜

#### 1.2 注册流程集成 (`api/src/routes/auth.ts`)

**修改内容：**

- ✅ 注册时接收`invitationCode`参数（可选）
- ✅ 验证邀请码有效性（存在、启用、未过期、未达上限）
- ✅ 使用事务处理邀请奖励：
  - 新用户获得邀请码设定的奖励积分
  - 邀请人获得50%的奖励积分
  - 更新邀请码使用次数
  - 创建邀请记录
  - 发送通知给邀请人
  - 记录双方的积分交易

### 2. 前端UI实现

#### 2.1 注册页面 (`web/register.html`)

**新增元素：**

- ✅ 邀请码输入框（可选）
  - 自动转大写
  - 最多8位字符
  - 实时验证按钮
  - 成功/错误提示

#### 2.2 认证脚本 (`web/auth.js`)

**新增功能：**

- ✅ `verifyInviteCode()` 函数
  - 调用API验证邀请码
  - 显示验证结果和奖励信息
  - 更新输入框边框颜色

- ✅ 注册表单提交
  - 包含邀请码参数
  - 显示注册成功和奖励信息

### 3. 管理工具

#### 3.1 批量生成脚本 (`api/scripts/generate-invite-codes.ts`)

**功能特性：**

- ✅ 命令行参数配置
  - 数量、奖励积分、最大使用次数、有效天数
- ✅ 自动查找管理员账号
- ✅ 去重检查
- ✅ 进度显示
- ✅ 格式化输出（每行5个）

**使用方法：**

```bash
# 生成100个邀请码，每个奖励100积分，单次使用，30天有效
npx ts-node scripts/generate-invite-codes.ts 100 100 1 30

# 生成10个邀请码，默认配置
npx ts-node scripts/generate-invite-codes.ts
```

## 📊 数据库模型

### invitation_codes（邀请码表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Int | 主键 |
| code | String | 邀请码（唯一，8位大写） |
| created_by_id | Int | 创建者ID |
| type | String | 类型（admin/user） |
| bonus_points | Int | 奖励积分 |
| max_uses | Int | 最大使用次数（-1=无限） |
| used_count | Int | 已使用次数 |
| expires_at | DateTime? | 过期时间 |
| is_active | Boolean | 是否启用 |
| created_at | DateTime | 创建时间 |

### invitation_records（邀请记录表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Int | 主键 |
| inviter_id | Int | 邀请人ID |
| invitee_id | Int | 被邀请人ID |
| invitation_code | String | 使用的邀请码 |
| bonus_points | Int | 获得的积分 |
| milestone_rewards | String? | 里程碑奖励（JSON） |
| created_at | DateTime | 邀请时间 |

## 🎯 邀请奖励机制

### 注册奖励

- **新用户**：获得邀请码设定的全部积分（默认50-100）
- **邀请人**：获得新用户奖励的50%（默认25-50）

### 里程碑奖励（待实现）

当被邀请人达成以下里程碑时，邀请人额外获得奖励：

| 里程碑 | 条件 | 邀请人奖励 |
|--------|------|-----------|
| 🌱 初出茅庐 | 1万字 | 25积分 |
| 📝 小有成就 | 5万字 | 100积分 |
| ✍️ 笔耕不辍 | 10万字 | 250积分 |
| 📚 专业作者 | 20万字 | 600积分 |
| 🎖️ 签约作者 | 50万字 | 1750积分 |
| 👑 大神作者 | 100万字 | 5000积分 |
| 🏆 殿堂作者 | 200万字 | 12500积分 |

## 🔐 权限控制

### 生成邀请码权限

用户需要满足以下条件之一才能生成邀请码：

1. **管理员**：可以批量生成任意配置的邀请码
2. **达成里程碑**：达成20万字里程碑（专业作者）自动获得权限
3. **手动授权**：管理员可以手动授予用户权限

## 📝 API接口文档

### 公开接口

#### 验证邀请码

```http
GET /api/invitations/validate/:code
```

**响应示例：**

```json
{
  "valid": true,
  "code": "ABC12345",
  "bonusPoints": 100,
  "createdBy": "admin",
  "type": "admin"
}
```

### 用户接口（需要登录）

#### 获取我的邀请码

```http
GET /api/invitations/my-codes
Authorization: Bearer <token>
```

**响应示例：**

```json
{
  "invitationCode": "USER1234",
  "canGenerate": true,
  "totalInvites": 5,
  "totalRewards": 250,
  "inviteRecords": [
    {
      "inviteeUsername": "newuser",
      "inviteeWordCount": 15000,
      "bonusPoints": 50,
      "milestoneRewards": null,
      "invitedAt": "2026-03-15T10:00:00Z"
    }
  ]
}
```

### 管理员接口（需要管理员权限）

#### 批量生成邀请码

```http
POST /api/invitations/admin/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "count": 10,
  "bonusPoints": 100,
  "maxUses": 1,
  "expiresInDays": 30
}
```

#### 获取邀请码列表

```http
GET /api/invitations/admin/codes?page=1&limit=20&type=admin&status=active
Authorization: Bearer <token>
```

#### 禁用/启用邀请码

```http
PATCH /api/invitations/admin/codes/:code/toggle
Authorization: Bearer <token>
```

#### 获取邀请统计

```http
GET /api/invitations/admin/stats
Authorization: Bearer <token>
```

## 🚀 部署和测试

### 1. 数据库迁移

邀请码相关表已在schema.prisma中定义，无需额外迁移。

### 2. 生成测试邀请码

```bash
cd api
npx ts-node scripts/generate-invite-codes.ts 50 100 1 30
```

### 3. 测试流程

1. **注册测试**
   - 访问 `/register`
   - 输入邀请码并点击"验证"
   - 完成注册
   - 检查是否获得积分奖励

2. **邀请人测试**
   - 登录邀请人账号
   - 访问 `/profile`（待实现UI）
   - 查看邀请统计

3. **管理员测试**
   - 登录管理员账号
   - 访问 `/admin`（待实现UI）
   - 查看邀请码列表和统计

## 📋 待完成功能

### 高优先级

1. **个人中心邀请码展示**
   - 显示我的邀请码（可复制）
   - 邀请统计（人数、奖励）
   - 邀请记录列表

2. **里程碑自动生成邀请码**
   - 集成到milestone-checker
   - 达成20万字自动授权

3. **管理员后台界面**
   - 邀请码列表和管理
   - 批量生成界面
   - 统计数据可视化

### 中优先级

4. **邀请链接生成**
   - 生成带邀请码的注册链接
   - 一键复制分享

5. **邀请活动**
   - 限时邀请奖励翻倍
   - 邀请排行榜

### 低优先级

6. **邀请码使用分析**
   - 转化率统计
   - 邀请来源追踪

## 🔧 技术要点

### 安全性

- ✅ 邀请码去重检查
- ✅ 使用数据库事务确保数据一致性
- ✅ 管理员权限验证
- ✅ 邀请码状态和有效期验证

### 性能优化

- ✅ 邀请码索引优化
- ✅ 批量生成时的进度显示
- ✅ 分页查询

### 用户体验

- ✅ 实时邀请码验证
- ✅ 清晰的奖励提示
- ✅ 友好的错误信息

## 📈 后续优化建议

1. **邀请码格式优化**
   - 考虑使用更短的邀请码（6位）
   - 添加校验位防止输入错误

2. **邀请奖励优化**
   - 根据被邀请人活跃度调整奖励
   - 增加长期奖励机制

3. **防刷机制**
   - 限制单个IP注册频率
   - 检测异常邀请行为

4. **数据分析**
   - 邀请转化率分析
   - 用户留存率追踪

## 📚 相关文档

- [数据库Schema](../api/prisma/schema.prisma)
- [邀请码API路由](../api/src/routes/invitations.ts)
- [注册流程](../api/src/routes/auth.ts)
- [批量生成脚本](../api/scripts/generate-invite-codes.ts)

## 👥 贡献者

- 实施日期：2026-03-17
- 版本：M3-User-Auth
- 状态：✅ 核心功能完成，UI待完善

---

**下一步：** 实现签到系统（连续签到、补签功能）

