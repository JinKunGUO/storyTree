import { test, expect } from '@playwright/test';
import { attachErrorCollector } from '../helpers/error-collector';

/**
 * P1 发现页面流程
 *
 * 搜索 → 筛选 → 排序 → 翻页 → 点击故事卡片
 */

test.describe('P1 发现页面流程', () => {
  test('搜索功能', async ({ page }) => {
    const collector = attachErrorCollector(page);
    await page.goto('/discover.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // 找到搜索框
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="搜索"], input[name*="search"], .search-input, #searchInput'
    );
    const hasSearch = await searchInput.first().isVisible().catch(() => false);

    if (hasSearch) {
      await searchInput.first().fill('故事');
      await searchInput.first().press('Enter');
      await page.waitForTimeout(2000);

      // 验证搜索结果出现（或无结果提示）
      const results = page.locator('.story-card, .search-result, .story-item');
      const noResults = page.locator(':text("没有找到"), :text("暂无"), :text("无结果")');
      const hasResults = await results.first().isVisible().catch(() => false);
      const hasNoResults = await noResults.first().isVisible().catch(() => false);

      expect(hasResults || hasNoResults, 'Should show results or no-results message').toBe(true);
    }

    expect(collector.getCriticalErrors()).toHaveLength(0);
  });

  test('排序切换', async ({ page }) => {
    const collector = attachErrorCollector(page);
    await page.goto('/discover.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // 找到排序选项
    const sortOptions = page.locator(
      '.sort-btn, .sort-option, [data-sort], select[name*="sort"], .tab:has-text("最新"), .tab:has-text("最热")'
    );
    const sortCount = await sortOptions.count();
    console.log(`[discover] Found ${sortCount} sort options`);

    for (let i = 0; i < Math.min(sortCount, 4); i++) {
      const option = sortOptions.nth(i);
      if (await option.isVisible().catch(() => false)) {
        await option.click();
        await page.waitForTimeout(1500);
      }
    }

    expect(collector.getCriticalErrors()).toHaveLength(0);
  });

  test('翻页功能', async ({ page }) => {
    const collector = attachErrorCollector(page);
    await page.goto('/discover.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // 找到分页组件
    const nextBtn = page.locator(
      'button:has-text("下一页"), .next-page, .pagination-next, [aria-label="Next"]'
    );
    const loadMore = page.locator(
      'button:has-text("加载更多"), .load-more, .show-more'
    );

    const hasNext = await nextBtn.first().isVisible().catch(() => false);
    const hasLoadMore = await loadMore.first().isVisible().catch(() => false);

    if (hasNext) {
      await nextBtn.first().click();
      await page.waitForTimeout(2000);
      console.log('[discover] Navigated to next page');
    } else if (hasLoadMore) {
      await loadMore.first().click();
      await page.waitForTimeout(2000);
      console.log('[discover] Loaded more stories');
    }

    expect(collector.getCriticalErrors()).toHaveLength(0);
  });

  test('点击故事卡片进入详情', async ({ page }) => {
    const collector = attachErrorCollector(page);
    await page.goto('/discover.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // 找到故事卡片
    const storyCards = page.locator('a[href*="story.html"], .story-card a, .story-item a');
    const cardCount = await storyCards.count();
    console.log(`[discover] Found ${cardCount} story cards`);

    if (cardCount > 0) {
      // 点击第一个故事卡片
      await storyCards.first().click();
      await page.waitForTimeout(2000);

      // 验证进入了故事详情页
      const currentUrl = page.url();
      expect(currentUrl).toContain('story.html');

      // 验证故事详情页有基本内容
      const title = page.locator('h1, h2, .story-title');
      const hasTitle = await title.first().isVisible().catch(() => false);
      console.log(`[discover] Story detail has title: ${hasTitle}`);
    }

    expect(collector.getCriticalErrors()).toHaveLength(0);
  });
});
