/**
 * StoryTree 埋点采集器
 * - 自动采集 page_view（含 UTM 参数、referrer）
 * - 暴露 window.stTrack(event, properties) 供业务代码手动上报
 * - 事件先缓冲，批量上报，页面卸载时用 sendBeacon 兜底
 */
(function () {
  'use strict';

  var ENDPOINT = '/api/analytics/track';
  var FLUSH_INTERVAL = 5000; // 5 秒批量上报一次
  var buffer = [];

  // 从 URL 提取 UTM 参数（仅首次访问时记录，后续页面沿用 sessionStorage 中的值做归因）
  function getUtm() {
    var stored = null;
    try {
      stored = sessionStorage.getItem('st_utm');
    } catch (e) { /* 隐私模式等场景忽略 */ }

    var params = new URLSearchParams(window.location.search);
    var utm = {
      utm_source: params.get('utm_source'),
      utm_medium: params.get('utm_medium'),
      utm_campaign: params.get('utm_campaign')
    };
    var hasNew = utm.utm_source || utm.utm_medium || utm.utm_campaign;

    if (hasNew) {
      try {
        sessionStorage.setItem('st_utm', JSON.stringify(utm));
      } catch (e) { /* ignore */ }
      return utm;
    }
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) { /* ignore */ }
    }
    return {};
  }

  function getToken() {
    return localStorage.getItem('token') || sessionStorage.getItem('token') || null;
  }

  function flush(useBeacon) {
    if (buffer.length === 0) return;
    var events = buffer.splice(0, buffer.length);
    var payload = JSON.stringify({ events: events });

    if (useBeacon && navigator.sendBeacon) {
      // sendBeacon 不支持自定义 header，匿名上报（服务端接受无 token 请求）
      var blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(ENDPOINT, blob);
      return;
    }

    var headers = { 'Content-Type': 'application/json' };
    var token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    fetch(ENDPOINT, {
      method: 'POST',
      headers: headers,
      body: payload,
      keepalive: true
    }).catch(function () {
      // 上报失败不阻塞业务，丢弃即可
    });
  }

  /**
   * 手动上报事件
   * @param {string} event 事件名（须在后端白名单内）
   * @param {Object} [properties] 附加属性
   */
  window.stTrack = function (event, properties) {
    if (!event || typeof event !== 'string') return;
    var utm = getUtm();
    buffer.push({
      event: event,
      page: window.location.pathname + window.location.search,
      referrer: document.referrer || null,
      utm_source: utm.utm_source || undefined,
      utm_medium: utm.utm_medium || undefined,
      utm_campaign: utm.utm_campaign || undefined,
      properties: properties || undefined
    });
    if (buffer.length >= 10) flush(false);
  };

  // 自动采集页面访问
  window.stTrack('page_view');

  // 定时批量上报
  setInterval(function () { flush(false); }, FLUSH_INTERVAL);

  // 页面卸载时兜底上报
  window.addEventListener('pagehide', function () { flush(true); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush(true);
  });
})();
