# 🚀 StoryTree 项目启动和测试指南

## 📋 目录
1. [环境要求](#环境要求)
2. [快速启动](#快速启动)
3. [完整测试流程](#完整测试流程)
4. [常见问题](#常见问题)

---

## 🔧 环境要求

### 必需环境
- **Node.js**: v18+ 
- **PostgreSQL**: v14+
- **npm**: v8+

### 检查环境
```bash
# 检查Node.js版本
node --version

# 检查npm版本
npm --version

# 检查PostgreSQL是否运行
psql --version
```

---

## 🚀 快速启动

### 方法1: 使用启动脚本（推荐）

#### Step 1: 确保数据库运行
```bash
# 启动PostgreSQL（如果未运行）
brew services start postgresql@14
# 或
pg_ctl -D /usr/local/var/postgres start
```

#### Step 2: 启动后端服务
```bash
cd /Users/jinkun/storytree/api
npm run dev
```

**预期输出**:
```
Server is running on http://localhost:3001
Database connected successfully
```

#### Step 3: 访问应用
打开浏览器访问: `http://localhost:3001`

---

### 方法2: 完整启动流程

#### Step 1: 安装依赖（首次运行）
```bash
cd /Users/jinkun/storytree/api
npm install
```

#### Step 2: 配置环境变量
确保 `api/.env` 文件存在并配置正确：
```bash
cat api/.env
```

应该包含：
```env
DATABASE_URL="postgresql://用户名:密码@localhost:5432/storytree"
JWT_SECRET="your-secret-key"
PORT=3001
```

#### Step 3: 数据库迁移（首次运行）
```bash
cd /Users/jinkun/storytree/api
npx prisma migrate dev
npx prisma generate
```

#### Step 4: 启动服务
```bash
cd /Users/jinkun/storytree/api
npm run dev
```

---

## 🧪 完整测试流程

### 测试1: 健康检查 ✅

#### 1.1 测试API健康端点
```bash
curl http://localhost:3001/api/health
```

**预期响应**:
```json
{
  "status": "ok",
  "timestamp": "2026-02-14T..."
}
```

#### 1.2 测试静态文件服务
```bash
curl -I http://localhost:3001/
```

**预期响应**:
```
HTTP/1.1 200 OK
Content-Type: text/html
```

---

### 测试2: 用户认证流程 👤

#### 2.1 访问注册页面
```
浏览器访问: http://localhost:3001/register
```

**测试步骤**:
1. 填写用户名（3-20字符）
2. 填写邮箱（有效格式）
3. 填写密码（至少6位，建议包含大小写字母和数字）
4. 确认密码
5. 点击"注册"按钮

**预期结果**:
- ✅ 密码强度实时显示
- ✅ 表单验证提示
- ✅ 注册成功后自动登录
- ✅ 跳转到首页

#### 2.2 测试登录功能
```
浏览器访问: http://localhost:3001/login
```

**测试步骤**:
1. 输入用户名或邮箱
2. 输入密码
3. 勾选"记住我"（可选）
4. 点击"登录"按钮

**预期结果**:
- ✅ 登录成功
- ✅ 导航栏显示用户名
- ✅ 显示"退出"按钮

#### 2.3 API测试
```bash
# 注册新用户
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "Test123456"
  }'

# 登录
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "Test123456"
  }'
```

---

### 测试3: 故事发现功能 🔍

#### 3.1 访问发现页面
```
浏览器访问: http://localhost:3001/discover
```

**测试步骤**:
1. 查看所有公开故事列表
2. 使用搜索框搜索关键词
3. 点击筛选标签（全部/热门/最新/已完结）
4. 点击任意故事卡片

**预期结果**:
- ✅ 故事列表正确显示
- ✅ 搜索功能正常工作
- ✅ 筛选功能正常工作
- ✅ 点击卡片跳转到故事详情页

#### 3.2 API测试
```bash
# 获取所有公开故事
curl http://localhost:3001/api/stories?isPublic=true

# 搜索故事
curl "http://localhost:3001/api/stories?search=测试"
```

---

### 测试4: 故事详情页面 📖

#### 4.1 访问故事详情
```
从发现页面点击任意故事，或直接访问:
http://localhost:3001/story?id=1
```

**测试内容**:
1. **故事信息展示**
   - ✅ 故事标题、简介
   - ✅ 作者信息
   - ✅ 统计数据（阅读量、点赞数、章节数、字数）

2. **章节列表**
   - ✅ 章节卡片展示
   - ✅ 章节标题、字数、更新时间
   - ✅ 点击章节跳转到阅读页面

3. **功能按钮**
   - ✅ "开始阅读"按钮（跳转到第一章）
   - ✅ "收藏"按钮（界面存在）
   - ✅ "分享"按钮（界面存在）
   - ✅ 章节排序（正序/倒序）

4. **响应式设计**
   - ✅ 桌面端双栏布局
   - ✅ 移动端单栏布局
   - ✅ 平板端自适应

#### 4.2 API测试
```bash
# 获取故事详情
curl http://localhost:3001/api/stories/1

# 获取故事章节列表
curl http://localhost:3001/api/stories/1/nodes
```

---

### 测试5: 章节阅读页面 📕

#### 5.1 访问章节阅读
```
从故事详情页点击任意章节，或直接访问:
http://localhost:3001/chapter?id=1
```

**测试内容**:
1. **阅读界面**
   - ✅ 章节标题显示
   - ✅ 章节内容完整展示
   - ✅ 清爽的白色阅读区
   - ✅ 舒适的行高和字体

2. **导航功能**
   - ✅ 返回故事详情按钮
   - ✅ 上一章按钮（首章禁用）
   - ✅ 下一章按钮（末章禁用）
   - ✅ 导航按钮状态正确

3. **阅读设置**
   - ✅ 点击齿轮图标打开设置
   - ✅ 调整字体大小（小/中/大）
   - ✅ 设置实时生效
   - ✅ 设置本地保存

4. **评论区**
   - ✅ 评论列表展示
   - ✅ 发表评论功能
   - ✅ 回复评论功能
   - ✅ 删除评论功能

#### 5.2 API测试
```bash
# 获取章节详情
curl http://localhost:3001/api/nodes/1

# 获取章节评论
curl "http://localhost:3001/api/comments/nodes/1/comments?page=1&limit=20"
```

---

### 测试6: 评论系统 💬

#### 6.1 发表评论测试

**测试步骤**:
1. 进入任意章节阅读页面
2. 滚动到评论区
3. 在评论框输入内容（1-500字）
4. 观察字符计数实时更新
5. 点击"发表评论"按钮

**预期结果**:
- ✅ 评论成功发表
- ✅ 评论列表自动刷新
- ✅ 显示成功提示消息
- ✅ 评论框自动清空

#### 6.2 回复评论测试

**测试步骤**:
1. 点击任意评论下的"回复"按钮
2. 在回复框输入内容
3. 点击"发表回复"按钮

**预期结果**:
- ✅ 回复成功发表
- ✅ 回复显示在原评论下方（树形结构）
- ✅ 显示回复对象
- ✅ 回复框自动关闭

#### 6.3 删除评论测试

**测试步骤**:
1. 找到自己发表的评论
2. 点击"删除"按钮
3. 确认删除操作

**预期结果**:
- ✅ 评论成功删除
- ✅ 评论从列表中移除
- ✅ 显示成功提示

#### 6.4 评论分页测试

**测试步骤**:
1. 在有大量评论的章节
2. 滚动到评论区底部
3. 点击"加载更多"按钮

**预期结果**:
- ✅ 加载下一页评论
- ✅ 新评论追加到列表
- ✅ 分页信息更新

#### 6.5 API测试
```bash
# 获取评论列表
curl "http://localhost:3001/api/comments/nodes/1/comments?page=1&limit=20"

# 发表评论（需要token）
curl -X POST http://localhost:3001/api/comments/nodes/1/comments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"content": "这是一条测试评论"}'

# 回复评论
curl -X POST http://localhost:3001/api/comments/nodes/1/comments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"content": "这是一条回复", "parentId": 1}'

# 删除评论
curl -X DELETE http://localhost:3001/api/comments/comments/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 测试7: 故事创作功能 ✍️

#### 7.1 访问创作页面
```
浏览器访问: http://localhost:3001/create
```

**测试步骤**:
1. 填写故事标题
2. 填写故事简介
3. 选择故事类型
4. 选择公开/私密
5. 点击"创建故事"按钮

**预期结果**:
- ✅ 表单验证正常
- ✅ 字符计数显示
- ✅ 创建成功跳转到故事详情页

#### 7.2 API测试
```bash
# 创建故事（需要token）
curl -X POST http://localhost:3001/api/stories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "测试故事",
    "description": "这是一个测试故事的简介",
    "genre": "奇幻",
    "isPublic": true
  }'
```

---

### 测试8: 个人中心 👤

#### 8.1 访问个人中心
```
浏览器访问: http://localhost:3001/profile
```

**测试内容**:
- ✅ 用户信息展示
- ✅ 创作统计（故事数、章节数、点赞数、浏览量）
- ✅ 我的故事列表
- ✅ 快速创作入口

---

### 测试9: 响应式设计 📱

#### 9.1 桌面端测试（>1200px）
```
浏览器窗口设置为全屏
```

**检查项**:
- ✅ 导航栏水平展开
- ✅ 故事详情双栏布局
- ✅ 章节列表网格显示（3列）
- ✅ 评论区完整显示

#### 9.2 平板端测试（768px-1200px）
```
浏览器窗口调整为平板尺寸
或使用开发者工具的设备模拟
```

**检查项**:
- ✅ 导航栏自适应
- ✅ 故事详情单栏布局
- ✅ 章节列表网格显示（2列）
- ✅ 评论区自适应

#### 9.3 移动端测试（<768px）
```
浏览器窗口调整为手机尺寸
或使用开发者工具的设备模拟（iPhone/Android）
```

**检查项**:
- ✅ 导航栏汉堡菜单
- ✅ 所有内容单栏显示
- ✅ 章节列表单列显示
- ✅ 字体大小适配
- ✅ 触摸操作优化
- ✅ 按钮大小适合触摸

---

## 🎯 完整测试场景

### 场景1: 新用户完整体验流程

```
1. 访问首页 (http://localhost:3001)
2. 点击"注册"按钮
3. 填写注册信息并提交
4. 自动登录并返回首页
5. 点击"发现故事"
6. 浏览故事列表
7. 点击一个感兴趣的故事
8. 查看故事详情和章节列表
9. 点击"开始阅读"或任意章节
10. 阅读章节内容
11. 调整字体大小
12. 滚动到评论区
13. 发表一条评论
14. 点击"下一章"继续阅读
15. 返回故事详情
16. 点击导航栏"个人中心"
17. 查看个人统计信息
```

### 场景2: 创作者流程

```
1. 登录账号
2. 点击"开始创作"
3. 填写故事信息并创建
4. 跳转到故事详情页
5. （通过API）添加章节
6. 在发现页面找到自己的故事
7. 查看故事详情
8. 阅读自己创作的章节
```

### 场景3: 评论互动流程

```
1. 进入任意章节阅读页
2. 发表一条评论
3. 刷新页面确认评论显示
4. 回复自己的评论
5. 回复其他人的评论
6. 删除自己的某条评论
7. 测试评论分页（如果评论数>20）
```

---

## 📊 性能测试

### 测试页面加载时间
```bash
# 测试首页加载时间
time curl -s http://localhost:3001/ > /dev/null

# 测试API响应时间
time curl -s http://localhost:3001/api/stories > /dev/null
```

**目标**:
- 页面加载时间 < 2秒
- API响应时间 < 500ms

---

## 🐛 常见问题

### Q1: 服务启动失败
**问题**: `Error: listen EADDRINUSE: address already in use :::3001`

**解决方案**:
```bash
# 查找占用3001端口的进程
lsof -ti:3001

# 结束进程
kill -9 $(lsof -ti:3001)

# 或使用
lsof -ti:3001 | xargs kill -9
```

### Q2: 数据库连接失败
**问题**: `Error: Can't reach database server`

**解决方案**:
```bash
# 检查PostgreSQL是否运行
brew services list | grep postgresql

# 启动PostgreSQL
brew services start postgresql@14

# 检查数据库是否存在
psql -l | grep storytree
```

### Q3: 页面显示空白
**问题**: 浏览器显示空白页面

**解决方案**:
1. 打开浏览器控制台（F12）查看错误信息
2. 检查后端服务是否正常运行
3. 清除浏览器缓存（Command + Shift + R）
4. 检查网络请求是否有错误

### Q4: 评论发表失败
**问题**: 点击发表评论后显示错误

**解决方案**:
1. 确认已登录（检查导航栏是否显示用户名）
2. 检查评论内容是否为空
3. 检查评论长度是否超过500字
4. 打开控制台查看具体错误信息

### Q5: Token过期
**问题**: 操作时提示"未授权"或"Token无效"

**解决方案**:
1. 重新登录
2. 检查localStorage中的token是否存在
3. 清除localStorage并重新登录

---

## 📝 测试检查清单

### 基础功能
- [ ] 服务正常启动
- [ ] 首页可以访问
- [ ] 注册功能正常
- [ ] 登录功能正常
- [ ] 退出功能正常

### 故事功能
- [ ] 发现故事列表显示
- [ ] 搜索功能正常
- [ ] 筛选功能正常
- [ ] 故事详情页显示
- [ ] 章节列表显示
- [ ] 章节排序功能
- [ ] 故事创建功能

### 阅读功能
- [ ] 章节内容显示
- [ ] 上下章导航
- [ ] 字体大小调整
- [ ] 阅读设置保存
- [ ] 返回按钮功能

### 评论功能
- [ ] 评论列表显示
- [ ] 发表评论功能
- [ ] 回复评论功能
- [ ] 删除评论功能
- [ ] 评论分页功能
- [ ] 树形结构显示

### 响应式设计
- [ ] 桌面端布局正常
- [ ] 平板端布局正常
- [ ] 移动端布局正常
- [ ] 导航栏自适应
- [ ] 汉堡菜单功能

### 用户体验
- [ ] 加载状态显示
- [ ] 错误提示友好
- [ ] 成功提示显示
- [ ] 空状态展示
- [ ] 动画效果流畅

---

## 🎊 开始测试！

现在你可以按照以上流程开始测试StoryTree了！

**推荐测试顺序**:
1. 先进行健康检查
2. 测试用户认证流程
3. 测试完整的阅读流程（场景1）
4. 测试评论互动功能
5. 测试响应式设计
6. 测试创作功能（可选）

**测试文档**:
- 详细测试指南: `docs/M3_FEATURE_TEST.md`
- 快速开始: `docs/QUICK_START_M3.md`

---

**祝测试顺利！** 🚀✨

