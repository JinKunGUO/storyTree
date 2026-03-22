-- AlterTable: 添加 points_awarded 字段到 bookmarks 表
-- 用途：记录是否已发放追更积分奖励（仅首次追更发放）

-- 为现有记录添加默认值 false（已有的收藏记录视为已发放过积分）
ALTER TABLE "bookmarks" ADD COLUMN "points_awarded" BOOLEAN NOT NULL DEFAULT true;

-- 说明：
-- 1. 新字段 points_awarded 用于标记是否已发放过追更积分奖励
-- 2. 现有的收藏记录设置为 true（视为已发放），避免重复发放积分
-- 3. 新的追更记录将根据业务逻辑设置该字段

