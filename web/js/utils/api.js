/**
 * 统一 API 请求封装
 * 自动注入 Authorization token，统一错误处理
 * 
 * 使用方式：
 *   const data = await apiFetch('/api/stories/1');
 *   const data = await apiFetch('/api/stories', { method: 'POST', body: JSON.stringify({...}) });
 * 
 * 特性：
 *   - 自动从 localStorage/sessionStorage 获取 token 并注入 Authorization header
 *   - 401 响应自动跳转登录页（可通过 skipAuthRedirect 选项禁用）
 *   - 自动设置 Content-Type: application/json（POST/PUT/PATCH 请求）
 *   - 返回解析后的 JSON 数据，非 2xx 响应抛出带 status 属性的 Error
 */
function apiFetch(url, options = {}) {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    
    const headers = Object.assign({}, options.headers || {});
    
    // 自动注入 token
    if (token && !headers['Authorization']) {
        headers['Authorization'] = 'Bearer ' + token;
    }
    
    // POST/PUT/PATCH 默认 JSON content-type
    const method = (options.method || 'GET').toUpperCase();
    if (['POST', 'PUT', 'PATCH'].includes(method) && !headers['Content-Type'] && typeof options.body === 'string') {
        headers['Content-Type'] = 'application/json';
    }
    
    const fetchOptions = Object.assign({}, options, { headers: headers });
    
    return fetch(url, fetchOptions).then(function(response) {
        // 401 自动跳转登录
        if (response.status === 401 && !options.skipAuthRedirect) {
            window.location.href = '/login.html';
            return Promise.reject(new Error('未登录或登录已过期'));
        }
        
        if (!response.ok) {
            return response.json().catch(function() {
                return { error: '请求失败 (' + response.status + ')' };
            }).then(function(data) {
                var err = new Error(data.error || data.message || '请求失败');
                err.status = response.status;
                err.data = data;
                throw err;
            });
        }
        
        // 204 No Content
        if (response.status === 204) {
            return null;
        }
        
        return response.json();
    });
}
