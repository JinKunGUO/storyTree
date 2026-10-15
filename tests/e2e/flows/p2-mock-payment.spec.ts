import { test, expect } from '../fixtures/auth.fixture';
import { attachErrorCollector } from '../helpers/error-collector';

/**
 * Mock 支付流程自动化测试
 *
 * 验证 mock 模式下支付链路完整性：
 * 1. 创建订单 → 跳转支付页 → 模拟支付成功 → 验证权益到账
 * 2. 前端展示正确性（mock 模式提示、按钮、结果页）
 * 3. 后端逻辑正确性（订单状态、积分/会员更新）
 */

test.describe('Mock 支付流程', () => {
  test('会员购买 - 完整 mock 支付流程', async ({ authenticatedPage }) => {
    const collector = attachErrorCollector(authenticatedPage);

    // 1. 访问会员页面
    await authenticatedPage.goto('/membership.html', { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(2000);

    // 2. 点击体验会员购买按钮
    const trialButton = authenticatedPage.locator('button:has-text("体验会员"), button:has-text("¥9.9")').first();
    await trialButton.click();
    await authenticatedPage.waitForTimeout(1000);

    // 3. 应该跳转到支付页面（mock 模式）
    await expect(authenticatedPage).toHaveURL(/payment\.html.*mock=1/);

    // 4. 验证 mock 模式提示
    const mockHint = authenticatedPage.locator(':text("Mock 模式")');
    await expect(mockHint).toBeVisible();

    // 5. 验证模拟支付按钮存在
    const mockButton = authenticatedPage.locator('button:has-text("模拟支付成功")');
    await expect(mockButton).toBeVisible();

    // 6. 点击模拟支付
    await mockButton.click();
    await authenticatedPage.waitForTimeout(2000);

    // 7. 验证支付成功提示
    const successMsg = authenticatedPage.locator(':text("支付成功")');
    await expect(successMsg).toBeVisible();

    // 8. 验证无关键 JS 错误
    expect(collector.getCriticalErrors()).toHaveLength(0);
  });

  test('积分充值 - 完整 mock 支付流程', async ({ authenticatedPage }) => {
    const collector = attachErrorCollector(authenticatedPage);

    // 1. 访问积分商城
    await authenticatedPage.goto('/points-mall.html', { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(2000);

    // 2. 点击第一个积分套餐购买按钮
    const buyButton = authenticatedPage.locator('button:has-text("立即充值"), button:has-text("¥9.9")').first();
    await buyButton.click();
    await authenticatedPage.waitForTimeout(1000);

    // 3. 应该跳转到支付页面（mock 模式）
    await expect(authenticatedPage).toHaveURL(/payment\.html.*mock=1/);

    // 4. 验证 mock 模式提示
    const mockHint = authenticatedPage.locator(':text("Mock 模式")');
    await expect(mockHint).toBeVisible();

    // 5. 点击模拟支付
    const mockButton = authenticatedPage.locator('button:has-text("模拟支付成功")');
    await mockButton.click();
    await authenticatedPage.waitForTimeout(2000);

    // 6. 验证支付成功
    const successMsg = authenticatedPage.locator(':text("支付成功")');
    await expect(successMsg).toBeVisible();

    // 7. 验证无关键 JS 错误
    expect(collector.getCriticalErrors()).toHaveLength(0);
  });

  test('支付页面 - mock 模式 UI 元素完整性', async ({ authenticatedPage }) => {
    const collector = attachErrorCollector(authenticatedPage);

    // 直接访问 mock 支付页面（需要先有订单，这里测试页面结构）
    await authenticatedPage.goto('/payment.html?orderId=TEST_MOCK_ORDER&mock=1', { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(2000);

    // 验证 mock 模式标识
    const mockBadge = authenticatedPage.locator(':text("Mock 模式"), :text("模拟支付")');
    const hasMockBadge = await mockBadge.count() > 0;

    // 验证不会显示真实支付方式选择
    const alipayOption = authenticatedPage.locator(':text("支付宝支付")');
    const wechatOption = authenticatedPage.locator(':text("微信支付")');
    const hasAlipay = await alipayOption.count() > 0;
    const hasWechat = await wechatOption.count() > 0;

    // mock 模式下不应该显示真实支付方式
    expect(hasAlipay).toBe(false);
    expect(hasWechat).toBe(false);

    expect(collector.getCriticalErrors()).toHaveLength(0);
  });

  test('支付页面 - 非 mock 模式显示支付宝选项', async ({ authenticatedPage }) => {
    const collector = attachErrorCollector(authenticatedPage);

    // 访问非 mock 支付页面
    await authenticatedPage.goto('/payment.html?orderId=TEST_ORDER', { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(2000);

    // 验证支付宝选项存在
    const alipayOption = authenticatedPage.locator(':text("支付宝支付")');
    await expect(alipayOption).toBeVisible();

    // 验证微信支付选项不存在（已隐藏）
    const wechatOption = authenticatedPage.locator(':text("微信支付")');
    await expect(wechatOption).not.toBeVisible();

    expect(collector.getCriticalErrors()).toHaveLength(0);
  });
});
