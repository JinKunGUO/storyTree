/**
 * HTML 转义工具函数（全局公共模块）
 * 用于防止 XSS 攻击，在 innerHTML 中插入用户数据前必须调用
 * 
 * 使用方式：在 HTML 中引入 <script src="js/utils/escape.js"></script>
 * 然后调用 escapeHtml(text) 即可
 * 
 * 注意：此文件供没有引入 auth.js 的页面使用（如 admin.html, discover.html, index.html, my-stories.html）
 * 引入了 auth.js 的页面已自带 escapeHtml，无需重复引入此文件
 */
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
