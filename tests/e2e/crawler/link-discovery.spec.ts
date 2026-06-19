import { test, expect } from '../fixtures/auth.fixture';
import { Crawler } from '../helpers/crawler';
import { PAGE_REGISTRY } from '../helpers/page-registry';

/**
 * 自动链接爬取测试
 *
 * 从首页出发，BFS 遍历所有可导航路径：
 * - 发现死链（404/5xx）
 * - 发现 JS 错误
 * - 计算页面覆盖率
 * - 报告未到达的页面
 */

test.describe('自动链接爬取', () => {
  test('从首页爬取所有可达链接 - 无死链', async ({ authenticatedPage }) => {
    const baseUrl = authenticatedPage.url().split('/').slice(0, 3).join('/') || 'http://localhost:3001';

    // 先导航到首页获取 baseUrl
    await authenticatedPage.goto('/');
    const resolvedBase = new URL(authenticatedPage.url()).origin;

    const crawler = new Crawler(resolvedBase, {
      maxDepth: 4,
      maxPages: 60,
      timeout: 10000,
    });

    const result = await crawler.crawl(authenticatedPage, `${resolvedBase}/index.html`);

    console.log(`\n=== 爬虫报告 ===`);
    console.log(`已访问页面: ${result.visited.size}`);
    console.log(`死链数量: ${result.deadLinks.length}`);
    console.log(`JS 错误数量: ${result.jsErrors.length}`);
    console.log(`网络失败数量: ${result.networkFailures.length}`);
    console.log(`页面覆盖率: ${result.coverage.coveragePercent}%`);

    if (result.deadLinks.length > 0) {
      console.log('\n--- 死链列表 ---');
      for (const dl of result.deadLinks) {
        console.log(`  ${dl.status} ${dl.url} (found on: ${dl.foundOn})`);
      }
    }

    if (result.coverage.missedPages.length > 0) {
      console.log('\n--- 未到达的页面 ---');
      for (const p of result.coverage.missedPages) {
        console.log(`  ${p}`);
      }
    }

    // 断言：不应有死链（排除需要特殊参数的页面可能返回的 404）
    const realDeadLinks = result.deadLinks.filter(dl =>
      dl.status >= 500 || // 5xx 始终是错误
      (dl.status === 404 && !dl.url.includes('?id='))  // 404 且不是参数页面
    );
    expect(
      realDeadLinks,
      `Found ${realDeadLinks.length} dead links: ${realDeadLinks.map(d => `${d.status} ${d.url}`).join(', ')}`
    ).toHaveLength(0);
  });

  test('从 discover 页面爬取 - 验证故事卡片链接', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/discover.html', { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(2000);

    // 提取故事卡片链接
    const storyLinks = await authenticatedPage.evaluate(() => {
      const links: string[] = [];
      document.querySelectorAll('a[href*="story.html"]').forEach(el => {
        links.push((el as HTMLAnchorElement).href);
      });
      return links;
    });

    console.log(`[discover] Found ${storyLinks.length} story links`);

    // 验证前 5 个故事链接可访问
    const linksToCheck = storyLinks.slice(0, 5);
    for (const link of linksToCheck) {
      const response = await authenticatedPage.goto(link, { waitUntil: 'domcontentloaded' });
      expect(
        response?.status(),
        `Story link ${link} should be accessible`
      ).toBeLessThan(500);
      await authenticatedPage.waitForTimeout(300);
    }
  });

  test('导航栏所有链接可达', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(1000);

    // 提取导航栏中的所有链接
    const navLinks = await authenticatedPage.evaluate(() => {
      const links: string[] = [];
      const nav = document.querySelector('nav, .navbar, .nav-menu, header');
      if (nav) {
        nav.querySelectorAll('a[href]').forEach(el => {
          const href = (el as HTMLAnchorElement).getAttribute('href');
          if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
            links.push(href);
          }
        });
      }
      return [...new Set(links)];
    });

    console.log(`[navbar] Found ${navLinks.length} navigation links: ${navLinks.join(', ')}`);

    // 验证每个导航链接可达
    for (const link of navLinks) {
      const response = await authenticatedPage.goto(link, { waitUntil: 'domcontentloaded' });
      expect(
        response?.status(),
        `Navigation link ${link} should be accessible`
      ).toBeLessThan(500);
      await authenticatedPage.waitForTimeout(300);
    }
  });
});

test.describe('页面覆盖率门禁', () => {
  test('注册表中的页面覆盖率应 >= 50%（爬虫可达）', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    const resolvedBase = new URL(authenticatedPage.url()).origin;

    const crawler = new Crawler(resolvedBase, {
      maxDepth: 3,
      maxPages: 40,
      timeout: 8000,
    });

    const result = await crawler.crawl(authenticatedPage, `${resolvedBase}/index.html`);

    // 基础覆盖率门禁：至少 50% 的注册页面从首页可达
    // 随着项目完善可以逐步提高到 90%
    expect(
      result.coverage.coveragePercent,
      `Page coverage ${result.coverage.coveragePercent}% is below threshold. Missed: ${result.coverage.missedPages.join(', ')}`
    ).toBeGreaterThanOrEqual(50);
  });
});
