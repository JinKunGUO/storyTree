# 支付宝沙箱环境测试指南

## 📋 一、快速概览

**适合场景**：开发测试、功能验证、流程调试

**优势**：
- ✅ 无需申请当面付，立即可用
- ✅ 使用虚拟资金，无真实交易
- ✅ 完整测试支付流程
- ✅ 验证回调处理逻辑

**限制**：
- ⚠️ 仅用于开发测试，不能用于生产
- ⚠️ 使用沙箱测试账号，不能用真实支付宝
- ⚠️ 沙箱环境可能不稳定（支付宝维护）

---

## 🚀 二、配置步骤（10 分钟完成）

### 步骤 1：访问沙箱控制台

打开浏览器访问：
```
https://open.alipay.com/develop/sandbox/app
```

### 步骤 2：登录沙箱

1. **点击「登录」**
2. **使用个人支付宝账号扫码登录**
3. **首次登录需要授权**

### 步骤 3：获取沙箱配置

登录后，你会看到「沙箱环境」页面，包含以下信息：

#### 3.1 应用配置
```
应用 APPID：2021000123456789
应用名称：沙箱应用
网关地址：https://openapi-sandbox.dl.alipaydev.com/gateway.do
```

#### 3.2 接口加签方式

1. **点击「设置应用公钥」**
2. **选择「公钥」模式**（不是证书模式）
3. **点击「生成密钥」**（或自己生成）
4. **复制「应用公钥」**（保存备用）
5. **复制「应用私钥」**（保存到本地）
6. **保存后，系统自动生成「支付宝公钥」**

**密钥生成命令**（如果自己生成）：
```bash
cd /Users/jinkun/storytree
mkdir -p alipay_sandbox
cd alipay_sandbox

# 生成私钥
openssl genrsa -out sandbox_app_private_key.pem 2048

# 生成公钥
openssl rsa -in sandbox_app_private_key.pem -pubout -out sandbox_app_public_key.pem

# 查看私钥（去掉 PEM 标记）
echo "=== 应用私钥 ==="
grep -v "BEGIN\|END" sandbox_app_private_key.pem | tr -d '\n'
echo ""

# 查看公钥（去掉 PEM 标记）
echo "=== 应用公钥 ==="
grep -v "BEGIN\|END" sandbox_app_public_key.pem | tr -d '\n'
echo ""
```

#### 3.3 测试账号

页面下方有「沙箱账号」区域：

**买家账号**（用于支付）：
```
账号：jxtthf2503@sandbox.com
登录密码：111111
支付密码：111111
```

**卖家账号**（你的收款账号）：
```
账号：（你的沙箱卖家账号）
登录密码：111111
```

### 步骤 4：配置环境变量

1. **复制沙箱配置文件**
```bash
cd /Users/jinkun/storytree/api
cp .env.sandbox .env
```

2. **编辑 `.env` 文件**，填入实际配置：
```env
ALIPAY_GATEWAY=https://openapi-sandbox.dl.alipaydev.com/gateway.do
ALIPAY_APP_ID=2021000123456789  # 替换为实际 APPID
ALIPAY_PRIVATE_KEY=MIIEvQIBADANBgkqhkiG9w0BAQEFAASC...  # 替换为实际私钥
ALIPAY_PUBLIC_KEY=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...  # 替换为实际公钥
ALIPAY_CALLBACK_URL=http://localhost:3001
API_URL=http://localhost:3001
```

**重要提示**：
- 密钥必须是**去掉 PEM 标记，合并成一行**的格式
- 不要有空格和换行

---

## 🧪 三、测试流程

### 3.1 启动服务

```bash
cd /Users/jinkun/storytree/api
npm run dev
```

### 3.2 访问会员中心

打开浏览器访问：
```
http://localhost:3001/membership.html
```

### 3.3 选择会员套餐

1. 选择「月度会员」（¥39）
2. 点击「立即开通」
3. 确认订单信息
4. 点击「确认并支付」

### 3.4 支付测试

#### 方式一：使用沙箱 APP 扫码（推荐）

1. **下载沙箱版支付宝 APP**
   - iOS：访问沙箱页面扫描二维码下载
   - Android：访问沙箱页面扫描二维码下载

2. **登录沙箱支付宝**
   - 使用买家账号：`jxtthf2503@sandbox.com`
   - 登录密码：`111111`

3. **扫码支付**
   - 打开沙箱支付宝 APP
   - 扫描页面显示的二维码
   - 输入支付密码：`111111`
   - 完成支付

#### 方式二：使用普通支付宝扫码（不推荐）

普通支付宝无法扫描沙箱二维码，会提示错误。

### 3.5 验证支付结果

支付成功后，应该看到：

1. **前端显示**
   - ✅ 支付成功页面
   - ✅ 显示订单号
   - ✅ 显示支付金额

2. **后端日志**
```
收到支付宝异步通知：{...}
订单 MEM_xxx 支付成功处理完成
```

3. **数据库状态**
```sql
SELECT * FROM "Orders" WHERE id = 'MEM_xxx';
-- status: 'paid'
-- payment_method: 'alipay'
-- paid_at: 2026-03-19 08:30:00
```

4. **会员权益**
```sql
SELECT "membership_tier", "membership_expires" FROM "Users" WHERE id = 1;
-- membership_tier: 'monthly'
-- membership_expires: 2026-04-18
```

---

## 🔧 四、调试技巧

### 4.1 查看详细日志

修改 `api/src/routes/payment.ts`，增加日志输出：

```typescript
router.post('/alipay/notify', async (req, res) => {
  try {
    console.log('=== 收到支付宝异步通知 ===');
    console.log('请求数据:', JSON.stringify(req.body, null, 2));
    console.log('请求头:', JSON.stringify(req.headers, null, 2));
    
    // 验证签名
    const isValid = alipay.verifyNotify(req.body);
    console.log('签名验证结果:', isValid);
    
    // ... 其他代码
  } catch (error) {
    console.error('错误详情:', error);
  }
});
```

### 4.2 使用 ngrok 测试回调

支付宝回调需要公网地址，使用 ngrok 暴露本地服务：

```bash
# 安装 ngrok
brew install ngrok

# 注册获取 authtoken：https://ngrok.com/

# 配置 authtoken
ngrok config add-authtoken YOUR_AUTHTOKEN

# 启动内网穿透
ngrok http 3001
```

ngrok 会生成公网地址：
```
https://abc123.ngrok.io
```

修改 `.env` 配置：
```env
ALIPAY_CALLBACK_URL=https://abc123.ngrok.io
API_URL=https://abc123.ngrok.io
```

**在支付宝沙箱控制台配置回调地址**：
1. 访问沙箱控制台
2. 点击「产品管理」->「当面付」
3. 配置回调地址为 ngrok 地址

### 4.3 测试常见问题

#### 问题 1：签名验证失败

**错误信息**：
```
签名验证失败，请检查公钥/私钥是否正确
```

**解决方案**：
1. 检查密钥格式是否正确（去掉 PEM 标记，一行）
2. 检查是否混淆了应用公钥和支付宝公钥
3. 重新生成密钥对并配置

#### 问题 2：应用 APPID 不存在

**错误信息**：
```
Invalid AppId
```

**解决方案**：
1. 检查 `ALIPAY_APP_ID` 是否正确
2. 确认使用沙箱 APPID（20210001 开头）
3. 确认网关地址是沙箱环境

#### 问题 3：回调地址无法访问

**错误信息**：
```
回调失败，无法访问 notify_url
```

**解决方案**：
1. 确保回调地址可公网访问（使用 ngrok）
2. 检查防火墙设置
3. 检查服务器是否正常运行

#### 问题 4：支付成功但订单未更新

**可能原因**：
1. 回调未收到（网络问题）
2. 回调签名验证失败
3. 数据库连接失败

**调试方法**：
1. 查看服务器日志
2. 检查回调日志
3. 手动调用查询接口

---

## 📊 五、测试用例

### 测试用例 1：购买月度会员

**步骤**：
1. 访问会员中心
2. 选择月度会员（¥39）
3. 扫码支付
4. 验证订单状态
5. 验证会员权益

**预期**：
- ✅ 订单创建成功
- ✅ 支付成功
- ✅ 会员有效期 30 天
- ✅ 订单状态：paid

### 测试用例 2：购买年度会员

**步骤**：
1. 访问会员中心
2. 选择年度会员（¥388）
3. 扫码支付

**预期**：
- ✅ 支付成功
- ✅ 会员有效期 365 天

### 测试用例 3：积分充值

**步骤**：
1. 访问积分商城
2. 选择积分套餐（100 积分，¥10）
3. 扫码支付

**预期**：
- ✅ 支付成功
- ✅ 积分立即到账
- ✅ 积分余额增加 100

### 测试用例 4：订单过期

**步骤**：
1. 创建订单
2. 等待 30 分钟不支付
3. 尝试支付

**预期**：
- ✅ 订单显示已过期
- ✅ 无法支付

### 测试用例 5：重复支付（幂等性）

**步骤**：
1. 创建订单并支付成功
2. 再次调用支付接口
3. 尝试再次支付

**预期**：
- ✅ 提示订单已支付
- ✅ 不会重复扣款

---

## 🐛 六、常见问题

### Q1: 沙箱环境和生产环境有什么区别？

**答**：
| 对比项 | 沙箱环境 | 生产环境 |
|--------|----------|----------|
| 网关地址 | openapi-sandbox.dl.alipaydev.com | openapi.alipay.com |
| APPID | 20210001xxxxxx | 2021xxxxxxxxxx |
| 密钥 | 沙箱密钥 | 生产密钥 |
| 测试账号 | 虚拟账号 | 真实支付宝 |
| 资金 | 虚拟资金 | 真实资金 |
| 用途 | 开发测试 | 生产运营 |

### Q2: 沙箱环境稳定吗？

**答**：
- 沙箱环境由支付宝官方维护
- 大部分时间稳定可用
- 偶尔会维护升级（会提前公告）
- 不适合高并发测试

### Q3: 沙箱测试通过后可以直接上线吗？

**答**：
不可以，需要：
1. 申请正式当面付
2. 配置生产环境
3. 使用真实支付宝测试
4. 最小金额验证（0.01 元）

### Q4: 为什么收不到回调通知？

**答**：
可能原因：
1. 回调地址无法公网访问
2. 回调地址配置错误
3. 服务器防火墙拦截
4. 支付宝服务延迟

**解决方案**：
1. 使用 ngrok 暴露本地服务
2. 检查回调地址配置
3. 检查防火墙设置
4. 查看支付宝回调日志

### Q5: 沙箱测试需要多长时间？

**答**：
- 配置环境：10 分钟
- 基础测试：15 分钟
- 完整测试：30 分钟
- 问题调试：视情况而定

---

## ✅ 七、配置检查清单

### 环境配置
- [ ] 沙箱 APPID 正确
- [ ] 网关地址正确
- [ ] 应用私钥正确
- [ ] 支付宝公钥正确
- [ ] 回调地址可访问

### 测试准备
- [ ] 下载沙箱支付宝 APP
- [ ] 登录买家账号
- [ ] 启动本地服务
- [ ] 配置 ngrok（如需回调）

### 功能测试
- [ ] 创建订单成功
- [ ] 生成二维码正确
- [ ] 扫码支付成功
- [ ] 回调处理正常
- [ ] 订单状态更新
- [ ] 会员权益到账

### 异常测试
- [ ] 订单过期处理
- [ ] 重复支付拦截
- [ ] 签名验证通过
- [ ] 金额验证通过

---

## 📞 八、获取帮助

### 支付宝沙箱支持
- **沙箱控制台**：https://open.alipay.com/develop/sandbox/app
- **沙箱文档**：https://opendocs.alipay.com/common/02005v
- **客服电话**：95188

### 项目文档
- **个人当面付指南**：`docs/alipay-personal-guide.md`
- **支付集成文档**：`docs/payment-integration.md`
- **测试方案**：`docs/payment-test-plan.md`

---

## 🎯 九、下一步

沙箱测试通过后，你可以：

1. **验证支付流程**
   - 确认代码逻辑正确
   - 用户体验流畅
   - 回调处理完善

2. **申请正式当面付**
   - 完善申请资料
   - 提供详细业务说明
   - 等待审核通过

3. **切换到生产环境**
   - 配置生产密钥
   - 使用真实支付宝测试
   - 最小金额验证

4. **正式上线**
   - 更新环境配置
   - 监控支付成功率
   - 处理异常情况

---

**文档版本**：v1.0.0  
**最后更新**：2026-03-19  
**适用环境**：沙箱环境  
**维护人员**：StoryTree 开发团队
