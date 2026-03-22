-- Migration: 权限系统重构 - 移除friendships表，简化story_collaborators表

-- 1. 删除friendships表（改用follows表实现单向关注）
DROP TABLE IF EXISTS "friendships";

-- 2. 简化story_collaborators表（移除role字段）
-- SQLite不支持DROP COLUMN，需要重建表
CREATE TABLE "story_collaborators_new" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "story_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "invited_by" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at" DATETIME,
    "removed_by" INTEGER,
    CONSTRAINT "story_collaborators_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "story_collaborators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 复制现有数据（只保留非owner的协作者，因为owner就是author_id）
INSERT INTO "story_collaborators_new" ("id", "story_id", "user_id", "invited_by", "created_at")
SELECT "id", "story_id", "user_id", "invited_by", "created_at" 
FROM "story_collaborators"
WHERE "role" != 'owner';

-- 删除旧表
DROP TABLE "story_collaborators";

-- 重命名新表
ALTER TABLE "story_collaborators_new" RENAME TO "story_collaborators";

-- 重建索引和约束
CREATE UNIQUE INDEX "story_collaborators_story_id_user_id_key" ON "story_collaborators"("story_id", "user_id");
CREATE INDEX "story_collaborators_user_id_idx" ON "story_collaborators"("user_id");
CREATE INDEX "story_collaborators_story_id_idx" ON "story_collaborators"("story_id");

-- 3. 添加删除请求表（用于协作者删除有子节点的章节时提交审核）
CREATE TABLE "delete_requests" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "node_id" INTEGER NOT NULL,
    "requester_id" INTEGER NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by" INTEGER,
    "reviewed_at" DATETIME,
    CONSTRAINT "delete_requests_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "delete_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "delete_requests_node_id_idx" ON "delete_requests"("node_id");
CREATE INDEX "delete_requests_requester_id_idx" ON "delete_requests"("requester_id");
CREATE INDEX "delete_requests_status_idx" ON "delete_requests"("status");

-- 4. 为stories表添加协作者审核字段
ALTER TABLE "stories" ADD COLUMN "require_collaborator_review" INTEGER NOT NULL DEFAULT 0;

