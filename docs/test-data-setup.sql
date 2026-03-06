-- M2功能测试 - 数据准备脚本
-- 用于设置测试数据，验证AI徽章显示功能

-- 1. 查看所有章节的AI标记状态
SELECT 
    id,
    title,
    ai_generated,
    author_id,
    created_at
FROM "Node"
ORDER BY created_at DESC
LIMIT 10;

-- 2. 将指定章节标记为AI生成（用于测试）
-- 替换 <chapter_id> 为实际的章节ID
-- UPDATE "Node" SET ai_generated = true WHERE id = <chapter_id>;

-- 示例：将ID为1的章节标记为AI生成
-- UPDATE "Node" SET ai_generated = true WHERE id = 1;

-- 3. 批量标记多个章节为AI生成
-- UPDATE "Node" SET ai_generated = true WHERE id IN (1, 2, 3);

-- 4. 查看用户的等级和积分
SELECT 
    id,
    username,
    email,
    level,
    points,
    created_at
FROM "User"
ORDER BY created_at DESC;

-- 5. 设置用户等级和积分（用于测试）
-- 替换 <user_id> 为实际的用户ID
-- UPDATE "User" SET level = 2, points = 500 WHERE id = <user_id>;

-- 6. 查看举报记录
SELECT 
    r.id,
    r.reason,
    r.description,
    r.created_at,
    u.username as reporter,
    n.title as node_title
FROM "Report" r
LEFT JOIN "User" u ON r.reporter_id = u.id
LEFT JOIN "Node" n ON r.node_id = n.id
ORDER BY r.created_at DESC
LIMIT 10;

-- 7. 查看节点的举报统计
SELECT 
    id,
    title,
    report_count,
    report_reasons,
    review_status
FROM "Node"
WHERE report_count > 0
ORDER BY report_count DESC;

-- 8. 创建测试用的AI生成章节
-- 注意：需要替换实际的story_id和author_id
/*
INSERT INTO "Node" (
    story_id,
    parent_id,
    author_id,
    title,
    content,
    path,
    ai_generated,
    review_status,
    created_at,
    updated_at
) VALUES (
    1,  -- 替换为实际的story_id
    NULL,  -- 如果是第一章则为NULL，否则填写父节点ID
    1,  -- 替换为实际的author_id
    'AI生成的测试章节',
    '这是一个AI生成的测试内容，用于验证AI徽章显示功能。',
    '1',  -- 如果是第一章则为'1'，否则根据实际情况调整
    true,  -- AI生成标记
    'APPROVED',
    NOW(),
    NOW()
);
*/

-- 9. 快速测试：将最新的章节标记为AI生成
-- UPDATE "Node" 
-- SET ai_generated = true 
-- WHERE id = (SELECT id FROM "Node" ORDER BY created_at DESC LIMIT 1);

-- 10. 恢复：清除所有AI标记（谨慎使用！）
-- UPDATE "Node" SET ai_generated = false;

-- 11. 查看故事及其章节的AI标记情况
SELECT 
    s.id as story_id,
    s.title as story_title,
    n.id as node_id,
    n.title as node_title,
    n.ai_generated,
    n.read_count,
    u.username as author
FROM "Story" s
LEFT JOIN "Node" n ON n.story_id = s.id
LEFT JOIN "User" u ON n.author_id = u.id
ORDER BY s.id, n.path;

-- 12. 统计：每个故事的AI章节数量
SELECT 
    s.id,
    s.title,
    COUNT(n.id) as total_nodes,
    SUM(CASE WHEN n.ai_generated = true THEN 1 ELSE 0 END) as ai_nodes,
    SUM(CASE WHEN n.ai_generated = false THEN 1 ELSE 0 END) as human_nodes
FROM "Story" s
LEFT JOIN "Node" n ON n.story_id = s.id
GROUP BY s.id, s.title
ORDER BY s.id;

