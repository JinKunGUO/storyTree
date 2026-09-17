#!/usr/bin/env node
/**
 * StoryTree 生产监控告警脚本
 *
 * 用途：定时巡检服务健康状态，异常时推送告警，恢复时推送恢复通知。
 * 运行：node scripts/monitor.js
 * 建议：crontab 每 3 分钟执行一次（注意：cron 表达式里的星斜线组合不要写进块注释，会提前闭合注释）
 *   0-59/3 * * * * cd /var/www/storytree && /usr/bin/node scripts/monitor.js >> /var/log/storytree-monitor.log 2>&1
 *
 * 配置（环境变量，可写在 api/.env.production 或导出到 crontab 环境）：
 *   MONITOR_HEALTH_URL  健康检查地址，默认 https://storytree.online/health
 *   ALERT_WEBHOOK_URL   告警 Webhook（Server酱/钉钉/企业微信自定义机器人，POST JSON）
 *   ALERT_EMAIL_TO      告警接收邮箱（需 api/.env.production 已配置 SMTP_*，可选）
 *   DISK_THRESHOLD      磁盘使用率告警阈值（%），默认 85
 *
 * 退出码：0 = 健康，1 = 有异常（供 cron/监控系统识别）
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const HEALTH_URL = process.env.MONITOR_HEALTH_URL || 'https://storytree.online/health';
const WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL || '';
const DISK_THRESHOLD = parseInt(process.env.DISK_THRESHOLD || '85', 10);
const STATE_FILE = path.join(__dirname, '.monitor-state.json');
const HEALTH_TIMEOUT_MS = 8000;

// ---------- 状态管理（用于告警去重：只在状态变化时推送） ----------
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { failing: {}, lastRun: null };
  }
}

function saveState(state) {
  state.lastRun = new Date().toISOString();
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('[monitor] 状态文件写入失败:', e.message);
  }
}

// ---------- 检查项 ----------
async function checkHealth() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(HEALTH_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
    const body = await res.json();
    if (body.status !== 'ok') return { ok: false, detail: `响应体异常: ${JSON.stringify(body)}` };
    return { ok: true };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, detail: e.name === 'AbortError' ? `超时(>${HEALTH_TIMEOUT_MS}ms)` : e.message };
  }
}

function checkDisk() {
  try {
    // 取根分区使用率
    const out = execSync("df -h / | tail -1 | awk '{print $5}'", { encoding: 'utf8' }).trim();
    const pct = parseInt(out.replace('%', ''), 10);
    if (Number.isNaN(pct)) return { ok: true, detail: `解析失败(${out})` };
    return pct >= DISK_THRESHOLD
      ? { ok: false, detail: `磁盘使用率 ${pct}% >= 阈值 ${DISK_THRESHOLD}%` }
      : { ok: true, detail: `磁盘 ${pct}%` };
  } catch (e) {
    return { ok: true, detail: `磁盘检查跳过: ${e.message}` }; // 检查失败不当作故障
  }
}

function checkPm2() {
  try {
    const out = execSync('pm2 jlist', { encoding: 'utf8', timeout: 10000 });
    const procs = JSON.parse(out);
    const api = procs.find(p => p.name === 'storytree-api');
    if (!api) return { ok: false, detail: 'PM2 中未找到 storytree-api 进程' };
    const status = api.pm2_env?.status;
    const restarts = api.pm2_env?.restart_time ?? 0;
    if (status !== 'online') return { ok: false, detail: `进程状态异常: ${status}` };
    return { ok: true, detail: `online, 重启${restarts}次` };
  } catch (e) {
    // 服务器上可能用其他方式部署（如 docker），pm2 不存在时不误报
    return { ok: true, detail: `PM2 检查跳过: ${e.message}` };
  }
}

// ---------- 告警通道 ----------
async function sendWebhook(text) {
  if (!WEBHOOK_URL) return false;
  // 兼容 Server酱(sendkey 接口) 与 钉钉/企业微信自定义机器人(msgtype/markdown)
  const isServerChan = /sctapi\.ftqq\.com|sct\.api/.test(WEBHOOK_URL);
  const body = isServerChan
    ? { title: 'StoryTree 监控告警', desp: text }
    : { msgtype: 'markdown', markdown: { title: 'StoryTree 监控告警', text } };
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (e) {
    console.error('[monitor] Webhook 发送失败:', e.message);
    return false;
  }
}

async function sendEmail(subject, text) {
  const to = process.env.ALERT_EMAIL_TO;
  if (!to) return false;
  let nodemailer;
  try {
    // 复用 api 目录下的 nodemailer 依赖
    nodemailer = require(path.join(__dirname, '../api/node_modules/nodemailer'));
  } catch {
    console.error('[monitor] nodemailer 不可用，跳过邮件告警');
    return false;
  }
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.error('[monitor] SMTP 未配置，跳过邮件告警');
    return false;
  }
  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT || '587', 10),
      secure: parseInt(SMTP_PORT || '587', 10) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    await transporter.sendMail({
      from: SMTP_FROM || SMTP_USER,
      to,
      subject,
      text,
    });
    return true;
  } catch (e) {
    console.error('[monitor] 邮件发送失败:', e.message);
    return false;
  }
}

async function alert(text) {
  console.error('[monitor] ALERT:', text.replace(/\n/g, ' | '));
  const viaHook = await sendWebhook(text);
  const viaMail = await sendEmail('StoryTree 监控告警', text);
  if (!viaHook && !viaMail) {
    console.error('[monitor] 未配置任何告警通道（ALERT_WEBHOOK_URL / ALERT_EMAIL_TO）');
  }
}

// ---------- 主流程 ----------
async function main() {
  const state = loadState();
  const checks = {
    health: await checkHealth(),
    disk: checkDisk(),
    pm2: checkPm2(),
  };

  const problems = [];
  for (const [name, result] of Object.entries(checks)) {
    const wasFailing = !!state.failing[name];
    const isFailing = !result.ok;

    if (isFailing && !wasFailing) {
      // 新发生的故障：推送告警
      await alert(`🔴 [${name}] 异常\n${result.detail || ''}\n时间: ${new Date().toLocaleString('zh-CN')}`);
      state.failing[name] = true;
    } else if (!isFailing && wasFailing) {
      // 故障恢复：推送恢复通知
      await alert(`🟢 [${name}] 已恢复\n${result.detail || ''}\n时间: ${new Date().toLocaleString('zh-CN')}`);
      delete state.failing[name];
    }

    if (isFailing) problems.push(`${name}: ${result.detail}`);
  }

  saveState(state);

  if (problems.length > 0) {
    console.error(`[monitor] ${new Date().toISOString()} 异常 ${problems.length} 项:`, problems.join('; '));
    process.exit(1);
  } else {
    const summary = Object.entries(checks).map(([k, v]) => `${k}=${v.detail || 'ok'}`).join(', ');
    console.log(`[monitor] ${new Date().toISOString()} 正常 (${summary})`);
    process.exit(0);
  }
}

main().catch(e => {
  console.error('[monitor] 执行异常:', e);
  process.exit(1);
});
