# 支付系统快速开始指南

## 🚀 一、快速开始（5 分钟配置）

### 步骤 1: 安装依赖

```bash
cd api
npm install
```

### 步骤 2: 配置环境变量

复制配置模板：

```bash
cd api
cp .env.payment.example .env
```

编辑 `.env` 文件，添加支付宝配置（**开发阶段可以先留空，使用模拟支付**）：

```env
# 支付宝配置（暂时留空，使用模拟支付）
ALIPAY_APP_ID=
ALIPAY_PRIVATE_KEY=
ALIPAY_PUBLIC_KEY=
ALIPAY_GATEWAY=https://openapi.alipay.com/gateway.do
ALIPAY_CALLBACK_URL=http://localhost:3001
```

### 步骤 3: 启动服务

```bash
npm run dev
```

### 步骤 4: 测试支付流程

1. 访问会员中心：http://localhost:3001/membership.html
2. 选择会员套餐
3. 点击购买
4. 跳转到支付页面：http://localhost:3001/payment.html

---

## 🧪 二、使用沙箱环境测试（推荐）

### 1. 获取沙箱配置

1. 访问 [支付宝沙箱](https://open.alipay.com/develop/sandbox/app)
2. 创建沙箱应用
3. 复制沙箱配置到 `.env` 文件

```env
ALIPAY_APP_ID=2021000123456789
ALIPAY_PRIVATE_KEY=MIIEvQIBADANBgkqhkiG9w0BAQEFAASC...
ALIPAY_PUBLIC_KEY=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...
ALIPAY_GATEWAY=https://openapi-sandbox.dl.alipaydev.com/gateway.do
ALIPAY_CALLBACK_URL=http://your-domain.ngrok.io
```

### 2. 使用内网穿透工具

支付宝回调需要公网地址，使用 ngrok：

```bash
# 安装 ngrok
brew install ngrok

# 启动内网穿透
ngrok http 3001
```

将生成的域名配置到 `ALIPAY_CALLBACK_URL`

### 3. 测试支付

使用沙箱买家账号：
- 账号：jxtthf2503@sandbox.com
- 密码：111111

---

## 📝 三、当前实现的功能

### ✅ 已实现

1. **订单管理**
   - 创建订单（会员订阅/积分充值）
   - 订单状态管理（pending/paid/cancelled/expired）
   - 订单查询接口
   - 订单列表接口

2. **支付宝集成**
   - 支付宝当面付（扫码支付）
   - 手机网站支付
   - 异步通知回调
   - 签名验证
   - 幂等性处理

3. **支付页面**
   - 订单信息展示
   - 支付方式选择
   - 二维码扫码
   - 支付倒计时（30 分钟）
   - 实时状态轮询
   - 支付结果展示

4. **业务集成**
   - 会员订阅自动升级
   - 积分充值自动到账
   - 会员权益立即生效

### 📋 待实现

- [ ] 微信支付集成
- [ ] 自动续费功能
- [ ] 退款处理
- [ ] 优惠券系统
- [ ] 支付分账
- [ ] 分期付款

---

## 📁 四、文件结构

```
api/
├── src/
│   ├── routes/
│   │   └── payment.ts           # 支付路由（创建订单、回调处理）
│   └── utils/
│       └── alipay.ts            # 支付宝 SDK 封装
├── .env.payment.example         # 支付配置模板
└── package.json                 # 依赖配置

web/
└── payment.html                 # 支付页面

docs/
├── payment-integration.md       # 详细集成文档
└── payment-test-plan.md         # 测试方案
```

---

## 🔧 五、API 接口

### 1. 创建支付宝支付

```http
POST /api/payment/alipay/create
Content-Type: application/json
Authorization: Bearer <token>

{
  "orderId": "MEM_1234567890_ABCD"
}
```

**响应**:
```json
{
  "success": true,
  "orderId": "MEM_1234567890_ABCD",
  "qrCode": "https://qr.alipay.com/xxx",
  "amount": 39.00
}
```

### 2. 支付宝异步回调

```http
POST /api/payment/alipay/notify
Content-Type: application/x-www-form-urlencoded
```

**说明**: 支付宝服务器发送，无需手动调用

### 3. 查询订单状态

```http
GET /api/payment/orders/:orderId
Authorization: Bearer <token>
```

### 4. 获取订单列表

```http
GET /api/payment/orders?type=subscription&status=paid&page=1&limit=20
Authorization: Bearer <token>
```

---

## 🎯 六、典型流程

### 会员订阅购买流程

```
用户
  ↓
1. 访问会员中心 (/membership.html)
  ↓
2. 选择套餐，点击购买
  ↓
3. 调用 API: POST /api/membership/upgrade/create
  ↓
4. 跳转到支付页面 (/payment.html?orderId=xxx)
  ↓
5. 调用 API: POST /api/payment/alipay/create
  ↓
6. 显示支付二维码
  ↓
7. 用户扫码支付
  ↓
8. 支付宝异步回调：POST /api/payment/alipay/notify
  ↓
9. 更新订单状态，发放会员权益
  ↓
10. 前端轮询显示支付成功
```

---

## 🐛 七、常见问题

### Q1: 支付页面显示"创建支付失败"？

**解决方案**:
1. 检查是否已安装 `alipay-sdk`
2. 检查 `.env` 配置是否正确
3. 查看服务器日志

### Q2: 收不到支付宝回调？

**解决方案**:
1. 检查回调地址是否可公网访问
2. 使用 ngrok 等工具暴露本地服务
3. 检查防火墙设置
4. 查看服务器访问日志

### Q3: 支付成功但权益未到账？

**解决方案**:
1. 查看订单状态：`GET /api/payment/orders/:orderId`
2. 检查回调日志
3. 确认会员升级逻辑正常

### Q4: 如何切换到生产环境？

**解决方案**:
1. 替换为生产环境的 APP_ID 和密钥
2. 修改 `ALIPAY_GATEWAY` 为正式网关
3. 配置生产环境的回调地址（必须 HTTPS）
4. 进行小额测试验证

---

## 📊 八、监控建议

### 关键指标

1. **支付成功率**
   - 目标：> 95%
   - 计算：支付成功订单数 / 总订单数

2. **平均支付时长**
   - 目标：< 5 分钟
   - 计算：从创建订单到支付成功的平均时间

3. **回调成功率**
   - 目标：100%
   - 计算：成功处理的回调数 / 总回调数

### 日志记录

```javascript
// 关键日志
console.log('创建订单:', { orderId, userId, amount });
console.log('发起支付:', { orderId, paymentMethod });
console.log('收到回调:', { orderId, tradeStatus });
console.log('支付成功:', { orderId, paymentMethod, amount });
console.log('支付失败:', { orderId, reason });
```

---

## 🔒 九、安全提醒

### ⚠️ 重要

1. **密钥安全**
   - ❌ 不要将密钥提交到 Git
   - ✅ 使用 `.env` 文件本地存储
   - ✅ 生产环境使用密钥管理服务

2. **回调验证**
   - ✅ 必须验证签名
   - ✅ 验证金额一致性
   - ✅ 幂等性处理

3. **数据传输**
   - ✅ 使用 HTTPS
   - ✅ 敏感信息加密

---

## 📞 十、获取帮助

### 支付宝官方支持
- 文档：https://opendocs.alipay.com/
- 客服：95188
- 工单：https://open.alipay.com/Support.htm

### 项目文档
- 详细文档：`docs/payment-integration.md`
- 测试方案：`docs/payment-test-plan.md`

---

**最后更新**: 2025-03-18  
**维护人员**: StoryTree 开发团队
