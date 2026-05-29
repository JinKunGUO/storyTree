# StoryTree 生产环境部署验证清单

## 📋 部署前检查

### 环境变量配置
- [ ] `JWT_SECRET` 已设置为安全的随机密钥（非默认值）
- [ ] `FRONTEND_URL` 已设置为正确的前端域名（如 `https://storytree.online`）
- [ ] `ALLOWED_ORIGINS` 包含所有允许的前端域名
- [ ] 数据库连接字符串正确配置
- [ ] 邮件服务配置正确（SMTP 或第三方服务）

### Nginx 配置
- [ ] SSL 证书已安装且有效
- [ ] `try_files` 指令包含 `$uri.html`（支持无扩展名 HTML 访问）
- [ ] API 反向代理配置正确（`/api/` → `http://127.0.0.1:3001/api/`）
- [ ] 静态文件路径正确（`root /var/www/storytree/web`）
- [ ] 上传文件路径正确（`/uploads/` → `/var/www/storytree/api/uploads/`）

### 代码部署
- [ ] 最新代码已拉取到服务器
- [ ] 依赖已安装（`npm install` 或 `pnpm install`）
- [ ] 数据库迁移已执行（`npx prisma migrate deploy`）
- [ ] 前端静态文件已复制到 `/var/www/storytree/web`
- [ ] API 服务已重启（`pm2 restart storytree-api`）

---

## ✅ 部署后验证（冒烟测试）

### 1. 基础功能测试

#### 网站访问
- [ ] 访问 `https://storytree.online` 能正常加载首页
- [ ] 访问 `https://api.storytree.online/api/health` 返回 `{"status":"ok"}`
- [ ] 浏览器控制台无 CORS 错误
- [ ] 浏览器控制台无 404 错误（静态资源）

#### 静态页面路由
- [ ] 访问 `https://storytree.online/register` 能加载注册页面
- [ ] 访问 `https://storytree.online/login` 能加载登录页面
- [ ] 访问 `https://storytree.online/verify-email?token=test` 能加载验证页面（不是 404 或 index.html）
- [ ] 访问 `https://storytree.online/reset-password?token=test` 能加载密码重置页面

### 2. 用户注册流程（关键路径）

#### 注册新账号
- [ ] 打开注册页面 `https://storytree.online/register`
- [ ] 填写用户名、邮箱、密码（至少8位，包含字母和数字）
- [ ] **验证密码实时提示**：
  - [ ] 输入密码时，页面显示三项要求提示
  - [ ] 满足的要求显示为绿色打勾
  - [ ] 密码强度实时更新（弱/中/强）
- [ ] 点击"注册"按钮
- [ ] 看到"请查收验证邮件"提示
- [ ] 邮箱收到验证邮件

#### 邮箱验证
- [ ] 邮件中的验证链接格式正确（`https://storytree.online/verify-email?token=...`）
- [ ] 点击验证链接
- [ ] **关键**：页面显示"验证成功"（不是首页或 404）
- [ ] 页面显示"请登录以继续使用"提示
- [ ] 3 秒后自动跳转到登录页面（`/login`）

#### 登录验证
- [ ] 在登录页面使用刚注册的账号登录
- [ ] 登录成功（不再提示"邮箱尚未验证"）
- [ ] 首页右上角显示用户名（已登录状态）

#### 跨浏览器验证（新增）
- [ ] 在浏览器 A 注册账号
- [ ] 在浏览器 B 打开验证邮件链接
- [ ] 验证成功后跳转到登录页
- [ ] 在浏览器 B 登录成功

### 3. 其他关键功能

#### 密码重置流程
- [ ] 点击"忘记密码"
- [ ] 输入邮箱，收到重置邮件
- [ ] 点击邮件中的链接
- [ ] 能正常加载密码重置页面（不是 404）
- [ ] 设置新密码成功

#### 文件上传
- [ ] 上传头像成功
- [ ] 上传的图片能正常显示（`/uploads/` 路径可访问）

#### WebSocket 连接
- [ ] 打开浏览器开发者工具 → Network → WS
- [ ] 查看是否有 WebSocket 连接成功（`wss://storytree.online/api/ws`）

---

## 🐛 常见问题排查

### 问题 1：验证邮件链接点击后显示首页（未登录）
**原因**：Nginx 配置缺少 `$uri.html`，导致 `/verify-email` 无法映射到 `verify-email.html`

**解决方案**：
```nginx
location / {
    try_files $uri $uri.html $uri/ /index.html;
}
```

### 问题 2：验证成功后跳转到首页而非登录页
**原因**：前端代码使用了旧的自动登录逻辑

**解决方案**：
- 检查 `web/verify-email.html` 中的跳转逻辑
- 确认跳转目标为 `/login` 而非 `/index.html`
- 确认后端 `/api/auth/verify-email` 不返回 JWT token

### 问题 3：密码要求提示不显示或不更新
**原因**：前端 JavaScript 未正确加载或密码验证逻辑错误

**解决方案**：
- 检查 `web/auth.js` 中的 `checkPasswordStrength()` 函数
- 确认密码输入框绑定了 `input` 事件监听器
- 检查浏览器控制台是否有 JavaScript 错误

### 问题 4：API 调用返回 CORS 错误
**原因**：`ALLOWED_ORIGINS` 环境变量未包含前端域名

**解决方案**：
```bash
# .env.production
ALLOWED_ORIGINS=https://storytree.online,https://www.storytree.online
```

### 问题 5：验证邮件中的链接指向 localhost
**原因**：`FRONTEND_URL` 环境变量未设置

**解决方案**：
```bash
# .env.production
FRONTEND_URL=https://storytree.online
```

### 问题 6：服务启动失败，提示 JWT_SECRET 错误
**原因**：生产环境未设置 JWT_SECRET 或使用了默认值

**解决方案**：
```bash
# 生成安全的随机密钥
openssl rand -base64 32

# 添加到 .env.production
JWT_SECRET=<生成的密钥>
```

---

## 📝 部署命令参考

### 更新 Nginx 配置
```bash
# 复制配置文件
sudo cp scripts/nginx.conf /etc/nginx/sites-available/storytree

# 测试配置
sudo nginx -t

# 重载配置（不中断服务）
sudo systemctl reload nginx
```

### 重启 API 服务
```bash
# 使用 PM2
pm2 restart storytree-api

# 或使用 systemd
sudo systemctl restart storytree-api
```

### 查看日志
```bash
# Nginx 日志
sudo tail -f /var/log/nginx/storytree-error.log
sudo tail -f /var/log/nginx/storytree-access.log

# API 日志（PM2）
pm2 logs storytree-api

# API 日志（systemd）
sudo journalctl -u storytree-api -f
```

---

## 🔄 回滚计划

如果部署后发现严重问题，按以下步骤回滚：

1. **回滚代码**
   ```bash
   git checkout <上一个稳定版本的 commit hash>
   npm install
   pm2 restart storytree-api
   ```

2. **回滚 Nginx 配置**
   ```bash
   sudo cp /etc/nginx/sites-available/storytree.backup /etc/nginx/sites-available/storytree
   sudo nginx -t && sudo systemctl reload nginx
   ```

3. **回滚数据库**（谨慎操作）
   ```bash
   # 如果有数据库迁移，需要手动回滚
   # 建议部署前先备份数据库
   ```

---

## 📞 紧急联系

- **服务器管理员**：[联系方式]
- **开发负责人**：[联系方式]
- **监控告警**：[监控平台链接]
