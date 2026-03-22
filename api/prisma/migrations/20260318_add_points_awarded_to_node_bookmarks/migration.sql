-- AlterTable: 为 node_bookmarks 表添加 points_awarded 字段
-- 用于防止重复发放收藏积分奖励（仅首次收藏发放）

ALTER TABLE "node_bookmarks" ADD COLUMN "points_awarded" BOOLEAN NOT NULL DEFAULT false;

-- 说明：
-- 1. points_awarded 默认值为 false
-- 2. 首次收藏章节时发放积分后，设置为 true
-- 3. 取消收藏后再次收藏，不再发放积分（因为记录已被删除，重新创建时仍为 false，需要在代码中检查历史记录）
-- 4. 为了真正防止刷分，需要在代码层面检查该用户是否曾经收藏过该章节

