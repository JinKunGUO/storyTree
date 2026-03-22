-- 故事可见性升级迁移脚本
-- 从三级（public, friends, private）升级到四级（public, followers, collaborators, author_only）
-- 执行时间：2026-03-16

-- 迁移1: 重命名 friends → followers
UPDATE stories 
SET visibility = 'followers' 
WHERE visibility = 'friends';

-- 迁移2: 重命名 private → collaborators
UPDATE stories 
SET visibility = 'collaborators' 
WHERE visibility = 'private';

-- 迁移3: 确保所有故事都有visibility值（兼容旧数据）
UPDATE stories 
SET visibility = 'public' 
WHERE visibility IS NULL OR visibility = '';

-- 验证迁移结果
-- 预期结果：只有 public, followers, collaborators, author_only（author_only为新增，暂时没有数据）
SELECT '迁移完成，可见性分布如下：' as message;
SELECT visibility, COUNT(*) as count 
FROM stories 
GROUP BY visibility
ORDER BY 
  CASE visibility
    WHEN 'author_only' THEN 1
    WHEN 'collaborators' THEN 2
    WHEN 'followers' THEN 3
    WHEN 'public' THEN 4
    ELSE 5
  END;

-- 检查是否有未知的visibility值
SELECT '检查未知的可见性值：' as message;
SELECT DISTINCT visibility 
FROM stories 
WHERE visibility NOT IN ('author_only', 'collaborators', 'followers', 'public');

