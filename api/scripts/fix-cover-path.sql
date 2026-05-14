-- ===================================
-- 修复默认封面路径
-- ===================================
-- 问题：数据库中存储的默认封面路径是 `/assets/default-cover.svg`
--       但实际文件是 `default-cover.jpg`
--
-- 使用方法（在服务器上执行）：
--   mysql -h <RDS_HOST> -u <USER> -p'<PASSWORD>' <DATABASE> < fix-cover-path.sql
--
-- 或者直接复制执行：
-- ===================================

-- 查看受影响的故事
SELECT id, title, cover_image
FROM stories
WHERE cover_image = '/assets/default-cover.svg';

-- 执行更新
UPDATE stories
SET cover_image = '/assets/default-cover.jpg'
WHERE cover_image = '/assets/default-cover.svg';

-- 验证结果
SELECT id, title, cover_image
FROM stories
WHERE cover_image = '/assets/default-cover.jpg'
LIMIT 10;

-- 显示更新统计
SELECT
    COUNT(*) as total_stories,
    SUM(CASE WHEN cover_image = '/assets/default-cover.jpg' THEN 1 ELSE 0 END) as with_jpg_cover,
    SUM(CASE WHEN cover_image IS NULL OR cover_image = '' THEN 1 ELSE 0 END) as without_cover
FROM stories;