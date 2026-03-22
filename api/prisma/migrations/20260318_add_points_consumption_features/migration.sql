-- AlterTable: 为 stories 表添加置顶相关字段
-- 用于实现故事置顶功能（50积分/天）

ALTER TABLE "stories" ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "stories" ADD COLUMN "pinned_until" DATETIME;
ALTER TABLE "stories" ADD COLUMN "pinned_at" DATETIME;

-- AlterTable: 为 comments 表添加置顶相关字段
-- 用于实现置顶评论功能（10积分/条，作者功能）

ALTER TABLE "comments" ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "comments" ADD COLUMN "pinned_at" DATETIME;

-- CreateIndex: 为 comments 表的 pinned 字段添加索引
CREATE INDEX "comments_pinned_idx" ON "comments"("pinned");

-- CreateTable: 打赏记录表
-- 用于实现打赏作者功能（最低5积分）

CREATE TABLE "tips" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sender_id" INTEGER NOT NULL,
    "receiver_id" INTEGER NOT NULL,
    "story_id" INTEGER,
    "node_id" INTEGER,
    "amount" INTEGER NOT NULL,
    "message" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tips_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tips_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex: 为 tips 表添加索引
CREATE INDEX "tips_sender_id_idx" ON "tips"("sender_id");
CREATE INDEX "tips_receiver_id_idx" ON "tips"("receiver_id");
CREATE INDEX "tips_story_id_idx" ON "tips"("story_id");
CREATE INDEX "tips_node_id_idx" ON "tips"("node_id");
CREATE INDEX "tips_created_at_idx" ON "tips"("created_at");

-- 说明：
-- 1. stories.pinned: 是否置顶（作者功能，50积分/天）
-- 2. stories.pinned_until: 置顶到期时间
-- 3. stories.pinned_at: 置顶开始时间
-- 4. comments.pinned: 是否置顶（作者功能，10积分/条）
-- 5. comments.pinned_at: 置顶时间
-- 6. tips: 打赏记录表（最低5积分）

