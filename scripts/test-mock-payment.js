#!/usr/bin/env node
/**
 * Mock 支付流程自动化测试脚本
 * 直接调用 API 验证支付链路，不依赖浏览器
 *
 * 用法: node scripts/test-mock-payment.js
 * 前提: API 服务运行在 localhost:3001
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}`);
    failed++;
  }
}

async function api(endpoint, options = {}) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  console.log(`\n🧪 Mock 支付流程测试 (${BASE_URL})\n`);

  // ========== 1. 注册 + 验证 + 登录 ==========
  console.log('📋 步骤 1: 注册 + 验证 + 登录');

  const ts = Date.now().toString(36).slice(-6);
  const username = `paytest${ts}`;
  const email = `paytest${ts}@test.local`;
  const password = 'TestPass123!';

  const regRes = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  });
  assert(regRes.status === 200 || regRes.status === 201, `注册成功 (status=${regRes.status})`);

  // 需要邮箱验证时，直接从数据库读取验证 token
  let token = regRes.data.token;
  if (!token && regRes.data.requireVerification) {
    console.log('  📧 需要邮箱验证，从数据库读取 token...');
    try {
      const { execSync } = await import('child_process');
      const dbPath = new URLSearchParams(process.env.DATABASE_URL || 'file:./dev.db').get('file') || './dev.db';
      const result = execSync(
        `sqlite3 ${__dirname}/../api/prisma/dev.db "SELECT email_verification_token FROM users WHERE email='${email}'"`,
        { encoding: 'utf-8' }
      ).trim();

      if (result) {
        const verifyRes = await api('/api/auth/verify-email', {
          method: 'POST',
          body: JSON.stringify({ token: result }),
        });
        assert(verifyRes.status === 200, '邮箱验证成功');
      } else {
        console.log('  ⚠️ 数据库中未找到验证 token');
      }
    } catch (e) {
      console.log(`  ⚠️ 数据库读取失败: ${e.message}`);
    }
  }

  // 登录
  const loginRes = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert(loginRes.status === 200, `登录成功 (status=${loginRes.status})`);
  token = loginRes.data.token;
  assert(!!token, '获取到 token');

  const authHeaders = { Authorization: `Bearer ${token}` };

  // ========== 2. 会员购买 mock 支付 ==========
  console.log('\n📋 步骤 2: 会员购买 mock 支付');

  const memberOrder = await api('/api/membership/upgrade/create', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ tier: 'monthly' }),
  });
  assert(memberOrder.status === 200, `创建会员订单成功 (orderId=${memberOrder.data.orderId})`);
  assert(memberOrder.data.tier === 'monthly', '订单类型为月度会员');
  assert(memberOrder.data.finalPrice === 39, `订单金额正确 (¥${memberOrder.data.finalPrice})`);

  const memberCallback = await api('/api/payment/callback/mock', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ orderId: memberOrder.data.orderId }),
  });
  assert(memberCallback.status === 200, 'mock 支付回调成功');
  assert(memberCallback.data.success === true, '支付状态为成功');

  // 验证会员状态
  const meAfterMember = await api('/api/auth/me', { headers: authHeaders });
  assert(meAfterMember.data.user.membership_tier === 'monthly', `会员等级已更新为 monthly (实际=${meAfterMember.data.user.membership_tier})`);
  assert(!!meAfterMember.data.user.membership_expires_at, '会员过期时间已设置');

  // ========== 3. 积分充值 mock 支付 ==========
  console.log('\n📋 步骤 3: 积分充值 mock 支付');

  const pointsOrder = await api('/api/payment/points/create', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ packageId: 'basic' }),
  });
  assert(pointsOrder.status === 200, `创建积分订单成功 (orderId=${pointsOrder.data.orderId})`);
  assert(pointsOrder.data.points === 100, `积分数量正确 (${pointsOrder.data.points})`);

  const pointsCallback = await api('/api/payment/callback/mock', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ orderId: pointsOrder.data.orderId }),
  });
  assert(pointsCallback.status === 200, '积分 mock 支付回调成功');

  // 验证积分到账
  const meAfterPoints = await api('/api/auth/me', { headers: authHeaders });
  assert(meAfterPoints.data.user.points === 100, `积分已到账 (${meAfterPoints.data.user.points})`);

  // ========== 4. 支付宝创建支付链接（mock 模式） ==========
  console.log('\n📋 步骤 4: 支付宝创建支付链接（mock 模式）');

  const alipayOrder = await api('/api/membership/upgrade/create', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ tier: 'quarterly' }),
  });
  assert(alipayOrder.status === 200, `创建季度会员订单成功`);

  const alipayCreate = await api('/api/payment/alipay/create', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ orderId: alipayOrder.data.orderId }),
  });
  assert(alipayCreate.status === 200, '支付宝创建支付链接成功');
  assert(!!alipayCreate.data.payUrl, '返回支付链接');
  assert(alipayCreate.data.payUrl.includes('mock=1'), 'mock 模式支付链接包含 mock=1');

  // ========== 5. 错误场景测试 ==========
  console.log('\n📋 步骤 5: 错误场景测试');

  // 无效订单 ID
  const badCallback = await api('/api/payment/callback/mock', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ orderId: 'INVALID_ORDER' }),
  });
  assert(badCallback.status !== 200, `无效订单返回错误 (status=${badCallback.status})`);

  // 无效会员等级
  const badTier = await api('/api/membership/upgrade/create', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ tier: 'invalid_tier' }),
  });
  assert(badTier.status === 400, `无效会员等级返回 400 (status=${badTier.status})`);

  // 无效积分套餐
  const badPackage = await api('/api/payment/points/create', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ packageId: 'invalid_package' }),
  });
  assert(badPackage.status === 400, `无效积分套餐返回 400 (status=${badPackage.status})`);

  // ========== 结果 ==========
  console.log(`\n${'='.repeat(40)}`);
  console.log(`✅ 通过: ${passed}  ❌ 失败: ${failed}  📊 总计: ${passed + failed}`);
  console.log(`${'='.repeat(40)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('测试执行失败:', err);
  process.exit(1);
});
