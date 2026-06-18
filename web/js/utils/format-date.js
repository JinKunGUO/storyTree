/**
 * 日期格式化工具函数（全局公共模块）
 * 将日期字符串转换为相对时间描述（如"刚刚"、"5分钟前"、"3天前"）
 * 
 * 使用方式：在 HTML 中引入 <script src="js/utils/format-date.js"></script>
 * 然后调用 formatDate(dateStr) 即可
 */
function formatDate(dateStr) {
    if (!dateStr) return '未知时间';

    var date = new Date(dateStr);

    // 检查日期是否有效
    if (isNaN(date.getTime())) {
        return '未知时间';
    }

    var now = new Date();
    var diff = now - date;

    // 如果是未来时间，显示完整日期
    if (diff < 0) {
        return date.toLocaleDateString('zh-CN');
    }

    var minutes = Math.floor(diff / 60000);
    var hours = Math.floor(diff / 3600000);
    var days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return minutes + '分钟前';
    if (hours < 24) return hours + '小时前';
    if (days === 1) return '昨天';
    if (days < 7) return days + '天前';
    if (days < 30) return Math.floor(days / 7) + '周前';
    if (days < 365) return Math.floor(days / 30) + '个月前';

    return date.toLocaleDateString('zh-CN');
}
