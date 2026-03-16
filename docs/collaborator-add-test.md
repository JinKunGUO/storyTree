# 协作者添加功能测试说明

## 📝 测试目标

验证改进后的协作者添加功能：
- ✅ 通过用户名添加协作者
- ✅ 向后兼容（仍支持user_id）
- ✅ 错误提示清晰
- ✅ 自动追更功能正常

## 🧪 测试用例

### 测试用例1：通过用户名添加协作者（正常流程）

**前置条件**：
- 用户A已登录
- 用户A是某故事的主创
- 用户B存在，用户名为 `testuser`

**测试步骤**：
1. 访问故事设置页面 `/story-settings.html?id=<story_id>`
2. 滚动到"协作者管理"部分
3. 在输入框中输入 `testuser`
4. 点击"添加协作者"按钮

**预期结果**：
- ✅ 显示"协作者添加成功"提示
- ✅ 协作者列表中出现用户B
- ✅ 用户B自动成为故事粉丝（追更）
- ✅ 用户B收到协作邀请通知

**API请求**：
```json
POST /api/stories/:id/collaborators
Headers: { "Authorization": "Bearer <token>" }
Body: { "username": "testuser" }

Response: 200 OK
{
  "collaborator": { ... },
  "message": "协作者添加成功"
}
```

### 测试用例2：用户名不存在

**测试步骤**：
1. 在输入框中输入不存在的用户名 `nonexistentuser`
2. 点击"添加协作者"按钮

**预期结果**：
- ✅ 显示错误提示：`用户 "nonexistentuser" 不存在`
- ✅ 协作者列表不变

**API响应**：
```json
Response: 404 Not Found
{
  "error": "用户 \"nonexistentuser\" 不存在"
}
```

### 测试用例3：用户名为空

**测试步骤**：
1. 输入框留空或只输入空格
2. 点击"添加协作者"按钮

**预期结果**：
- ✅ 前端拦截，显示"请输入用户名"
- ✅ 不发送API请求

### 测试用例4：重复添加协作者

**前置条件**：
- 用户B已经是协作者

**测试步骤**：
1. 再次输入用户B的用户名
2. 点击"添加协作者"按钮

**预期结果**：
- ✅ 显示错误提示："该用户已是协作者"

**API响应**：
```json
Response: 400 Bad Request
{
  "error": "该用户已是协作者"
}
```

### 测试用例5：添加作者自己

**测试步骤**：
1. 输入当前登录用户（故事主创）的用户名
2. 点击"添加协作者"按钮

**预期结果**：
- ✅ 显示错误提示："不能将作者添加为协作者"

**API响应**：
```json
Response: 400 Bad Request
{
  "error": "不能将作者添加为协作者"
}
```

### 测试用例6：重新激活被移除的协作者

**前置条件**：
- 用户C曾经是协作者，但已被移除（removed_at不为null）

**测试步骤**：
1. 输入用户C的用户名
2. 点击"添加协作者"按钮

**预期结果**：
- ✅ 显示"协作者添加成功"
- ✅ 用户C重新成为协作者（removed_at设为null）
- ✅ 协作者列表中出现用户C
- ✅ 追更关系保持（如果之前存在）

### 测试用例7：向后兼容（通过user_id添加）

**测试步骤**：
使用API直接发送请求（模拟旧版本客户端）：
```bash
curl -X POST http://localhost:3000/api/stories/1/collaborators \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"user_id": 2}'
```

**预期结果**：
- ✅ 成功添加协作者
- ✅ 功能与使用username相同

### 测试用例8：用户名大小写和空格处理

**测试步骤**：
1. 输入 ` TestUser `（前后有空格，大小写混合）
2. 点击"添加协作者"按钮

**预期结果**：
- ✅ 自动trim空格
- ✅ 根据数据库的用户名精确匹配（区分大小写）

### 测试用例9：自动追更验证

**测试步骤**：
1. 添加用户B为协作者
2. 查询数据库 `story_followers` 表

**预期结果**：
```sql
SELECT * FROM story_followers 
WHERE story_id = <story_id> AND user_id = <user_b_id>;

-- 应该存在一条记录
```

### 测试用例10：通知验证

**测试步骤**：
1. 添加用户B为协作者
2. 以用户B登录
3. 查看通知中心

**预期结果**：
- ✅ 收到一条"协作邀请"通知
- ✅ 通知内容：`<故事标题> 的作者邀请你成为协作者`
- ✅ 通知链接指向故事页面

## 🔍 数据库验证

### 检查协作者记录
```sql
SELECT * FROM story_collaborators 
WHERE story_id = <story_id> AND user_id = <user_id>;

-- 应该看到：
-- removed_at: null
-- invited_by: <author_id>
```

### 检查追更记录
```sql
SELECT * FROM story_followers 
WHERE story_id = <story_id> AND user_id = <user_id>;

-- 应该存在一条记录
```

### 检查通知记录
```sql
SELECT * FROM notifications 
WHERE user_id = <user_id> 
  AND type = 'COLLABORATION_INVITE'
ORDER BY created_at DESC LIMIT 1;

-- 应该看到最新的协作邀请通知
```

## ⚠️ 边界情况测试

### 1. 非主创用户尝试添加协作者

**测试步骤**：
- 以非主创用户登录
- 尝试访问故事设置页面并添加协作者

**预期结果**：
- ✅ 显示错误："只有故事作者可以添加协作者"

### 2. 未登录用户

**测试步骤**：
- 退出登录
- 尝试访问故事设置页面

**预期结果**：
- ✅ 重定向到登录页面

### 3. 故事不存在

**测试步骤**：
- 访问不存在的故事ID的设置页面

**预期结果**：
- ✅ 显示错误："Story not found"

### 4. 特殊字符的用户名

**测试步骤**：
- 输入包含特殊字符的用户名（如果系统允许）

**预期结果**：
- ✅ 正确查找用户
- ✅ 不会导致SQL注入或其他安全问题

## 📊 性能测试

### 并发添加测试

**测试步骤**：
- 多个用户同时添加同一个协作者

**预期结果**：
- ✅ 只有一个请求成功
- ✅ 其他请求返回"该用户已是协作者"

## ✅ 测试检查清单

- [ ] 测试用例1：通过用户名添加协作者
- [ ] 测试用例2：用户名不存在
- [ ] 测试用例3：用户名为空
- [ ] 测试用例4：重复添加协作者
- [ ] 测试用例5：添加作者自己
- [ ] 测试用例6：重新激活被移除的协作者
- [ ] 测试用例7：向后兼容（user_id）
- [ ] 测试用例8：用户名大小写和空格处理
- [ ] 测试用例9：自动追更验证
- [ ] 测试用例10：通知验证
- [ ] 边界情况测试
- [ ] 数据库验证

## 🚀 快速测试命令

### 创建测试用户
```bash
# 注册测试用户
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"Test123456","email":"test@example.com"}'
```

### 添加协作者
```bash
# 获取token后
curl -X POST http://localhost:3000/api/stories/1/collaborators \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser"}'
```

### 查看协作者列表
```bash
curl -X GET http://localhost:3000/api/stories/1/collaborators \
  -H "Authorization: Bearer <token>"
```

## 📝 测试结果记录

| 测试用例 | 状态 | 备注 |
|---------|------|------|
| 用例1：通过用户名添加 | ⏳ 待测试 | |
| 用例2：用户名不存在 | ⏳ 待测试 | |
| 用例3：用户名为空 | ⏳ 待测试 | |
| 用例4：重复添加 | ⏳ 待测试 | |
| 用例5：添加作者自己 | ⏳ 待测试 | |
| 用例6：重新激活 | ⏳ 待测试 | |
| 用例7：向后兼容 | ⏳ 待测试 | |
| 用例8：空格处理 | ⏳ 待测试 | |
| 用例9：自动追更 | ⏳ 待测试 | |
| 用例10：通知 | ⏳ 待测试 | |

## 🎯 测试建议

1. **优先测试**：用例1、2、3（核心功能）
2. **重要测试**：用例4、5、9、10（业务逻辑）
3. **兼容性测试**：用例7（向后兼容）
4. **边界测试**：用例6、8（特殊情况）

## 🔧 调试技巧

### 查看后端日志
```bash
# 查看API请求日志
tail -f api/logs/app.log
```

### 浏览器控制台
- 打开开发者工具
- 查看Network标签页的API请求
- 查看Console标签页的错误信息

### 数据库查询
```bash
# 进入数据库
sqlite3 api/prisma/prisma/dev.db

# 查看协作者
SELECT * FROM story_collaborators;

# 查看追更
SELECT * FROM story_followers;

# 查看通知
SELECT * FROM notifications;
```

