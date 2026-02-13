# 🧪 StoryTree M3阶段功能测试指南

**测试版本**: M3阶段 - 用户认证系统  
**测试环境**: 本地开发环境  
**测试时间**: 2026年2月13日

---

## 🎯 测试目标

### 已完成功能
- ✅ 用户注册系统
- ✅ 用户登录系统  
- ✅ JWT认证机制
- ✅ 密码重置功能
- ✅ 管理员权限控制

---

## 🧪 测试环境准备

### 1. 启动服务
```bash
# 确保后端服务运行
cd /Users/jinkun/storytree/api
npm run dev

# 服务地址
前端: http://localhost:3001
后端API: http://localhost:3001/api
```

### 2. 测试工具
- **浏览器**: Chrome/Safari/Firefox
- **API测试**: curl命令或Postman
- **数据库查看**: Prisma Studio

---

## 🔐 用户认证系统测试

### 📋 测试清单

#### 1. 用户注册功能测试

**测试步骤**:
1. 访问注册页面: `http://localhost:3001/register`
2. 或使用API测试:

```bash
# 测试1: 成功注册
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser1","email":"test1@example.com","password":"123456"}'

# 测试2: 重复用户名
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser1","email":"test2@example.com","password":"123456"}'

# 测试3: 无效邮箱格式
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser2","email":"invalid-email","password":"123456"}'
```

**预期结果**:
- ✅ 成功注册返回用户信息和JWT token
- ❌ 重复用户名返回错误信息
- ❌ 无效邮箱返回格式错误

#### 2. 用户登录功能测试

**测试步骤**:
```bash
# 测试1: 正确登录
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test1@example.com","password":"123456"}'

# 测试2: 错误密码
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test1@example.com","password":"wrongpass"}'

# 测试3: 不存在的用户
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@example.com","password":"123456"}'
```

**预期结果**:
- ✅ 正确登录返回用户信息和JWT token
- ❌ 错误密码返回"邮箱或密码错误"
- ❌ 不存在用户返回"邮箱或密码错误"

#### 3. JWT认证测试

**测试步骤**:
```bash
# 1. 先登录获取token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test1@example.com","password":"123456"}' \
  | jq -r '.token')

# 2. 使用token访问受保护资源
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# 3. 测试无效token
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer invalid-token"
```

**预期结果**:
- ✅ 有效token返回当前用户信息
- ❌ 无效token返回401未授权

#### 4. 管理员功能测试

**测试步骤**:
```bash
# 1. 创建管理员用户（需要数据库操作）
cd api
npx prisma studio

# 2. 在Prisma Studio中将用户设为管理员
# 找到用户，将isAdmin设为true

# 3. 管理员登录获取token
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"123456"}' \
  | jq -r '.token')

# 4. 测试管理员权限
curl -X GET http://localhost:3001/api/admin/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 🌐 前端功能测试

### 📱 界面测试

#### 1. 注册/登录界面

**测试路径**:
1. 访问 `http://localhost:3001` 
2. 点击右上角"登录/注册"
3. 测试表单验证
4. 测试密码强度提示

#### 2. 用户个人页面

**测试路径**:
1. 注册并登录新用户
2. 创建几个测试故事
3. 查看个人主页统计信息
4. 验证数字显示准确

#### 3. 管理员后台

**测试路径**:
1. 管理员账号登录
2. 访问 `/admin` 路径
3. 查看用户统计
4. 测试故事管理功能

---

## 📊 数据库验证

### 🔍 数据检查

#### 1. 查看用户数据
```bash
# 进入数据库查看
npx prisma studio

# 或通过API查询
curl -X GET http://localhost:3001/api/users
```

#### 2. 验证数据完整性
- ✅ 用户表包含email字段
- ✅ 用户表包含emailVerified字段
- ✅ 用户表包含密码重置相关字段
- ✅ 用户表包含管理员标识字段

---

## 🚨 常见问题排查

### 问题1: 服务启动失败
```bash
# 检查端口占用
lsof -ti:3001

# 重启服务
npm run dev
```

### 问题2: 注册失败
```bash
# 检查数据库连接
npx prisma db pull

# 重置数据库（开发环境）
npx prisma migrate reset --force
```

### 问题3: Token无效
```bash
# 检查JWT_SECRET
node -e "console.log(process.env.JWT_SECRET || '未设置')"
```

---

## ✅ 测试通过标准

### 功能测试
- [ ] 用户注册成功
- [ ] 用户登录成功  
- [ ] JWT Token正确生成
- [ ] 受保护资源需要认证
- [ ] 管理员权限验证成功
- [ ] 个人页面统计数字准确显示

### 界面测试
- [ ] 注册表单验证正常
- [ ] 登录表单验证正常
- [ ] 用户信息显示正确
- [ ] 管理员后台可访问

### 数据测试
- [ ] 用户数据正确存储
- [ ] 统计信息计算准确
- [ ] 管理员标识正确设置

---

## 🎉 测试完成

当所有测试项目都显示✅时，说明M3阶段用户认证系统已成功实现！

**下一步**: 响应式设计优化
