const http = require('http');

// 1. 测试 /feed/me 路由（无 token，应返回 401 而非 404）
const req1 = http.request(
  { hostname: '127.0.0.1', port: 3001, path: '/api/users/feed/me', method: 'GET' },
  res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => console.log('[feed/me no token] Status:', res.statusCode, 'Body:', data));
  }
);
req1.on('error', e => console.error('[feed/me] Error:', e.message));
req1.end();

// 2. 测试 /feed 是否被 /:id 拦截
const req2 = http.request(
  { hostname: '127.0.0.1', port: 3001, path: '/api/users/feed', method: 'GET' },
  res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => console.log('[/users/feed as :id] Status:', res.statusCode, 'Body:', data));
  }
);
req2.on('error', e => console.error('[/users/feed] Error:', e.message));
req2.end();

