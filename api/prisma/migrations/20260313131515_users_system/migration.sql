-- CreateTable
CREATE TABLE "story_followers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "story_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "story_followers_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "story_followers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "collaboration_requests" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "story_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by" INTEGER,
    "reviewed_at" DATETIME,
    CONSTRAINT "collaboration_requests_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "collaboration_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "collaboration_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "auto_approve_collaborators" BOOLEAN NOT NULL DEFAULT false,
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

-- CreateIndex
CREATE INDEX "story_followers_user_id_idx" ON "story_followers"("user_id");

-- CreateIndex
CREATE INDEX "story_followers_story_id_idx" ON "story_followers"("story_id");

-- CreateIndex
CREATE UNIQUE INDEX "story_followers_story_id_user_id_key" ON "story_followers"("story_id", "user_id");

-- CreateIndex
CREATE INDEX "collaboration_requests_story_id_idx" ON "collaboration_requests"("story_id");

-- CreateIndex
CREATE INDEX "collaboration_requests_user_id_idx" ON "collaboration_requests"("user_id");

-- CreateIndex
CREATE INDEX "collaboration_requests_status_idx" ON "collaboration_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "collaboration_requests_story_id_user_id_key" ON "collaboration_requests"("story_id", "user_id");
