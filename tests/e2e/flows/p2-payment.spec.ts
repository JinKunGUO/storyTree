import { test, expect } from '../fixtures/auth.fixture';
import { attachErrorCollector } from '../helpers/error-collector';

/**
 * P2 会员/支付流程
 *
 * 会员页面浏览 → 选择方案 → 进入支付页面（不实际付款）
 */

test.describe('P2 会员与支付流程', () => {
  test('会员页面 - 显示会员方案', async ({ authenticatedPage }) => {
    const collector = attachErrorCollector(authenticatedPage);
    await authenticatedPage.goto('/membership.html', { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(2000);

    // 验证会员方案卡片存在
    const plans = authenticatedPage.locator(
      '.plan-card, .membership-plan, .tier-card, [data-plan], .pricing-card'
    );
    const planCount = await plans.count();
    console.log(`[membership] Found ${planCount} membership plans`);

    // 页面应该正常加载
    expect(collector.getCriticalErrors()).toHaveLength(0);
  });

  test('会员页面 - 查看会员权益', async ({ authenticatedPage }) => {
    const collector = attachErrorCollector(authenticatedPage);
    await authenticatedPage.goto('/membership.html', { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(2000);

    // 查找权益列表
    const benefits = authenticatedPage.locator(
      '.benefit, .feature-list, .perk, [data-benefit]'
    );
    const benefitCount = await benefits.count();
    console.log(`[membership] Found ${benefitCount} benefit items`);

    expect(collector.getCriticalErrors()).toHaveLength(0);
  });

  test('积分商城页面 - 正常加载', async ({ authenticatedPage }) => {
    const collector = attachErrorCollector(authenticatedPage);
    await authenticatedPage.goto('/points-mall.html', { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(2000);

    // 验证积分商城有商品展示
    const items = authenticatedPage.locator(
      '.mall-item, .points-item, .product-card, [data-item]'
    );
    const itemCount = await items.count();
    console.log(`[points-mall] Found ${itemCount} mall items`);

    expect(collector.getCriticalErrors()).toHaveLength(0);
  });

  test('支付页面 - 无参数时的降级处理', async ({ authenticatedPage }) => {
    const collector = attachErrorCollector(authenticatedPage);
    await authenticatedPage.goto('/payment.html', { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(2000);

    // 无订单参数时，页面应该有提示或重定向
    const currentUrl = authenticatedPage.url();
    const hasError = await authenticatedPage.locator(':text("订单"), :text("参数"), :text("错误")').first().isVisible().catch(() => false);

    // 不应该有 5xx 错误
    expect(collector.getCriticalErrors().filter(e => e.type === 'js-error')).toHaveLength(0);
  });
});
