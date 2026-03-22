-- AlterTable: 添加 points_awarded 字段到 story_followers 表
-- 用途：记录是否已发放追更积分奖励（仅首次追更发放）

-- 为现有记录添加默认值 true（已有的追更记录视为已发放过积分）
ALTER TABLE "story_followers" ADD COLUMN "points_awarded" BOOLEAN NOT NULL DEFAULT true;

-- 说明：
-- 1. 新字段 points_awarded 用于标记是否已发放过追更积分奖励
-- 2. 现有的追更记录设置为 true（视为已发放），避免重复发放积分
-- 3. 新的追更记录将在首次追更时发放积分并设置为 true

