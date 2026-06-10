#!/usr/bin/env node
/**
 * 移动端水平溢出自动化检测脚本
 * 
 * 内置 HTTP 静态文件服务器，无需手动启动服务。
 * 使用 Playwright 在多个移动端视口宽度下访问所有页面，
 * 检测是否存在水平滚动条（scrollWidth > clientWidth）。
 * 
 * 前置条件：
 *   npm install playwright
 *   npx playwright install chromium
 * 
 * 用法：
 *   node scripts/test-mobile-overflow.js
 *   node scripts/test-mobile-overflow.js --port 8080
 *   node scripts/test-mobile-overflow.js --url http://已运行的服务器地址
 * 
 * 选项：
 *   --url <url>      使用外部已运行的服务器（跳过内置服务器）
 *   --port <port>    内置服务器端口，默认 0（自动分配）
 *   --viewports <w>  逗号分隔的视口宽度，默认 320,360,375,390
 *   --screenshot     对失败页面截图（默认开启）
 *   --no-screenshot  不截图
 * 
 * 环境变量：
 *   SCREENSHOT_DIR - 截图保存目录，默认 ./test-screenshots/
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

// ============================================================
// 解析命令行参数
// ============================================================

const args = process.argv.slice(2);
function getArg(name, defaultValue) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return defaultValue;
  return args[idx + 1] || defaultValue;
}
function hasFlag(name) {
  return args.includes(`--${name}`);
}

const EXTERNAL_URL = getArg('url', null);
const PORT = parseInt(getArg('port', '0'), 10);
const VIEWPORTS = getArg('viewports', '320,360,375,390').split(',').map(Number);
const TAKE_SCREENSHOTS = !hasFlag('no-screenshot');
const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || path.join(__dirname, '..', 'test-screenshots');
const WEB_DIR = path.join(__dirname, '..', 'web');
const VIEWPORT_HEIGHT = 812;

// ============================================================
// 内置静态文件服务器
// ============================================================

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function createStaticServer(rootDir) {
  return http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';

    const filePath = path.join(rootDir, urlPath);

    // 安全检查：不允许访问 rootDir 之外
    if (!filePath.startsWith(rootDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        // 尝试加 .html
        const htmlPath = filePath + '.html';
        if (fs.existsSync(htmlPath)) {
          serveFile(htmlPath, res);
          return;
        }
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      serveFile(filePath, res);
    });
  });
}

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  
  const stream = fs.createReadStream(filePath);
  res.writeHead(200, { 'Content-Type': contentType });
  stream.pipe(res);
  stream.on('error', () => {
    res.writeHead(500);
    res.end('Internal Server Error');
  });
}

function startServer(rootDir, port) {
  return new Promise((resolve, reject) => {
    const server = createStaticServer(rootDir);
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, url: `http://127.0.0.1:${addr.port}` });
    });
    server.on('error', reject);
  });
}

// ============================================================
// 需要测试的页面路径
// ============================================================

const PAGES = [
  '/',
  '/discover.html',
  '/login.html',
  '/register.html',
  '/membership.html',
  '/points-mall.html',
  '/about.html',
  '/profile.html',
  '/my-stories.html',
  '/notifications.html',
  '/create.html',
  '/create-ai.html',
  '/story.html',
  '/write.html',
];

// 需要登录才能正常渲染的页面（可能重定向到 login）
const AUTH_PAGES = new Set([
  '/profile.html',
  '/my-stories.html',
  '/notifications.html',
  '/create.html',
  '/create-ai.html',
  '/write.html',
]);

// ============================================================
// 主测试逻辑
// ============================================================

async function main() {
  let baseUrl = EXTERNAL_URL;
  let server = null;

  // 启动内置服务器（如果没有指定外部 URL）
  if (!baseUrl) {
    if (!fs.existsSync(WEB_DIR)) {
      console.error(`错误: web 目录不存在: ${WEB_DIR}`);
      process.exit(2);
    }
    const result = await startServer(WEB_DIR, PORT);
    server = result.server;
    baseUrl = result.url;
    console.log(`\n🖥️  内置服务器已启动: ${baseUrl}`);
    console.log(`   服务目录: ${WEB_DIR}`);
  } else {
    console.log(`\n🔗 使用外部服务器: ${baseUrl}`);
  }

  console.log(`\n📱 移动端水平溢出检测`);
  console.log(`   视口宽度: ${VIEWPORTS.join(', ')}px`);
  console.log(`   测试页面: ${PAGES.length} 个`);
  if (TAKE_SCREENSHOTS) {
    console.log(`   截图目录: ${SCREENSHOT_DIR}`);
  }
  console.log('');

  // 创建截图目录
  if (TAKE_SCREENSHOTS && !fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const results = [];
  let passCount = 0;
  let failCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const viewport of VIEWPORTS) {
    console.log(`--- 视口宽度: ${viewport}px ---\n`);

    const context = await browser.newContext({
      viewport: { width: viewport, height: VIEWPORT_HEIGHT },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    });

    const page = await context.newPage();

    for (const pagePath of PAGES) {
      const url = `${baseUrl}${pagePath}`;
      const testId = `${viewport}px${pagePath.replace(/[\/\.]/g, '_')}`;

      try {
        const response = await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 10000 
        });

        // 检查页面是否正常加载（非 404）
        if (response && response.status() === 404) {
          console.log(`  ⏭️  ${pagePath} (404, 跳过)`);
          skipCount++;
          results.push({ page: pagePath, viewport, status: 'skipped', reason: '404' });
          continue;
        }

        // 检查是否被重定向到登录页（说明需要认证）
        if (AUTH_PAGES.has(pagePath)) {
          const currentUrl = page.url();
          if (currentUrl.includes('login')) {
            console.log(`  ⏭️  ${pagePath} (需要登录, 跳过)`);
            skipCount++;
            results.push({ page: pagePath, viewport, status: 'skipped', reason: '需要登录' });
            continue;
          }
        }

        // 等待页面渲染（JS 动态内容）
        await page.waitForTimeout(800);

        // 检测水平溢出
        const overflowInfo = await page.evaluate(() => {
          const body = document.body;
          const html = document.documentElement;
          const scrollWidth = Math.max(body.scrollWidth, html.scrollWidth);
          const clientWidth = html.clientWidth;
          
          // 找出溢出的元素（取前 5 个）
          const overflowingElements = [];
          const allElements = document.querySelectorAll('*');
          for (const el of allElements) {
            const rect = el.getBoundingClientRect();
            if (rect.right > clientWidth + 2) {
              const tag = el.tagName.toLowerCase();
              const id = el.id ? `#${el.id}` : '';
              const cls = (el.className && typeof el.className === 'string') 
                ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') 
                : '';
              overflowingElements.push({
                selector: (tag + id + cls).substring(0, 60),
                overflow: Math.round(rect.right - clientWidth)
              });
              if (overflowingElements.length >= 5) break;
            }
          }

          return {
            scrollWidth,
            clientWidth,
            hasOverflow: scrollWidth > clientWidth + 2,
            overflowAmount: Math.round(scrollWidth - clientWidth),
            overflowingElements
          };
        });

        if (overflowInfo.hasOverflow) {
          failCount++;
          console.log(`  ❌ ${pagePath} — 溢出 ${overflowInfo.overflowAmount}px`);
          overflowInfo.overflowingElements.forEach(el => {
            console.log(`     └─ ${el.selector} (+${el.overflow}px)`);
          });

          if (TAKE_SCREENSHOTS) {
            const screenshotPath = path.join(SCREENSHOT_DIR, `FAIL_${testId}.png`);
            await page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`     📸 ${path.relative(process.cwd(), screenshotPath)}`);
          }

          results.push({ 
            page: pagePath, viewport, status: 'fail', 
            overflow: overflowInfo.overflowAmount,
            elements: overflowInfo.overflowingElements 
          });
        } else {
          passCount++;
          console.log(`  ✅ ${pagePath}`);
          results.push({ page: pagePath, viewport, status: 'pass' });
        }

      } catch (error) {
        errorCount++;
        const msg = error.message.split('\n')[0].substring(0, 60);
        console.log(`  ⚠️  ${pagePath} — ${msg}`);
        results.push({ page: pagePath, viewport, status: 'error', reason: msg });
      }
    }

    await context.close();
    console.log('');
  }

  await browser.close();

  // 关闭内置服务器
  if (server) {
    server.close();
  }

  // 输出总结
  console.log('='.repeat(50));
  console.log('📊 测试总结\n');
  console.log(`  ✅ 通过: ${passCount}`);
  console.log(`  ❌ 失败: ${failCount}`);
  console.log(`  ⏭️  跳过: ${skipCount}`);
  console.log(`  ⚠️  错误: ${errorCount}`);

  if (failCount > 0) {
    console.log('\n❌ 失败详情:');
    const failures = results.filter(r => r.status === 'fail');
    const grouped = {};
    failures.forEach(f => {
      if (!grouped[f.page]) grouped[f.page] = [];
      grouped[f.page].push(f.viewport);
    });
    Object.entries(grouped).forEach(([pg, widths]) => {
      console.log(`  ${pg}: 在 ${widths.map(w => w + 'px').join(', ')} 下溢出`);
    });
  }

  // 写入 JSON 报告
  if (TAKE_SCREENSHOTS) {
    const reportPath = path.join(SCREENSHOT_DIR, 'report.json');
    fs.writeFileSync(reportPath, JSON.stringify({ 
      timestamp: new Date().toISOString(),
      baseUrl,
      viewports: VIEWPORTS,
      summary: { pass: passCount, fail: failCount, skip: skipCount, error: errorCount },
      results 
    }, null, 2));
    console.log(`\n📄 报告: ${path.relative(process.cwd(), reportPath)}`);
  }

  console.log('');
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('脚本执行失败:', err.message);
  process.exit(2);
});
