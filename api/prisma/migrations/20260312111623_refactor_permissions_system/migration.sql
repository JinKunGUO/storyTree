/*
  Warnings:

  - You are about to alter the column `require_collaborator_review` on the `stories` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Boolean`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_delete_requests" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "node_id" INTEGER NOT NULL,
    "requester_id" INTEGER NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by" INTEGER,
    "reviewed_at" DATETIME,
    CONSTRAINT "delete_requests_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "delete_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "delete_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_delete_requests" ("created_at", "id", "node_id", "reason", "requester_id", "reviewed_at", "reviewed_by", "status") SELECT "created_at", "id", "node_id", "reason", "requester_id", "reviewed_at", "reviewed_by", "status" FROM "delete_requests";
DROP TABLE "delete_requests";
ALTER TABLE "new_delete_requests" RENAME TO "delete_requests";
CREATE INDEX "delete_requests_node_id_idx" ON "delete_requests"("node_id");
CREATE INDEX "delete_requests_requester_id_idx" ON "delete_requests"("requester_id");
CREATE INDEX "delete_requests_status_idx" ON "delete_requests"("status");
CREATE TABLE "new_stories" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cover_image" TEXT,
    "author_id" INTEGER NOT NULL,
    "root_node_id" INTEGER,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "password" TEXT,
    "allow_branch" BOOLEAN NOT NULL DEFAULT true,
    "allow_comment" BOOLEAN NOT NULL DEFAULT true,
    "require_collaborator_review" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "stories_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_stories" ("allow_branch", "allow_comment", "author_id", "cover_image", "created_at", "description", "id", "password", "require_collaborator_review", "root_node_id", "tags", "title", "updated_at", "visibility") SELECT "allow_branch", "allow_comment", "author_id", "cover_image", "created_at", "description", "id", "password", "require_collaborator_review", "root_node_id", "tags", "title", "updated_at", "visibility" FROM "stories";
DROP TABLE "stories";
ALTER TABLE "new_stories" RENAME TO "stories";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
