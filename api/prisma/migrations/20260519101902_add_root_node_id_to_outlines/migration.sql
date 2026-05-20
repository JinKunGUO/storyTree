-- DropIndex
DROP INDEX "comments_user_id_created_at_idx";

-- DropIndex
DROP INDEX "comments_node_id_is_deleted_created_at_idx";

-- DropIndex
DROP INDEX "comments_node_id_parent_id_created_at_idx";

-- DropIndex
DROP INDEX "nodes_parent_id_is_published_idx";

-- DropIndex
DROP INDEX "nodes_author_id_created_at_idx";

-- DropIndex
DROP INDEX "nodes_story_id_is_published_path_idx";

-- DropIndex
DROP INDEX "point_transactions_type_created_at_idx";

-- DropIndex
DROP INDEX "point_transactions_user_id_type_created_at_idx";

-- CreateTable
CREATE TABLE "story_outlines" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "story_id" INTEGER NOT NULL,
    "root_node_id" INTEGER,
    "version" INTEGER NOT NULL,
    "outline" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "change_note" TEXT,
    "created_by" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "story_outlines_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "characters" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "story_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "traits" TEXT,
    "background" TEXT,
    "relations" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "characters_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "story_templates" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "genre" TEXT NOT NULL,
    "framework" TEXT NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_by" INTEGER NOT NULL
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
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "pinned_until" DATETIME,
    "pinned_at" DATETIME,
    "project_brief" TEXT,
    "ai_assisted_created" BOOLEAN NOT NULL DEFAULT false,
    "ai_creation_method" TEXT,
    CONSTRAINT "stories_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_stories" ("allow_branch", "allow_comment", "author_id", "auto_approve_collaborators", "cover_image", "created_at", "description", "id", "password", "pinned", "pinned_at", "pinned_until", "require_collaborator_review", "root_node_id", "tags", "title", "updated_at", "visibility") SELECT "allow_branch", "allow_comment", "author_id", "auto_approve_collaborators", "cover_image", "created_at", "description", "id", "password", "pinned", "pinned_at", "pinned_until", "require_collaborator_review", "root_node_id", "tags", "title", "updated_at", "visibility" FROM "stories";
DROP TABLE "stories";
ALTER TABLE "new_stories" RENAME TO "stories";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "story_outlines_story_id_idx" ON "story_outlines"("story_id");

-- CreateIndex
CREATE INDEX "story_outlines_story_id_is_active_idx" ON "story_outlines"("story_id", "is_active");

-- CreateIndex
CREATE INDEX "story_outlines_story_id_root_node_id_idx" ON "story_outlines"("story_id", "root_node_id");

-- CreateIndex
CREATE INDEX "story_outlines_story_id_root_node_id_is_active_idx" ON "story_outlines"("story_id", "root_node_id", "is_active");

-- CreateIndex
CREATE INDEX "characters_story_id_idx" ON "characters"("story_id");

-- CreateIndex
CREATE INDEX "characters_story_id_is_active_idx" ON "characters"("story_id", "is_active");

-- CreateIndex
CREATE INDEX "story_templates_genre_idx" ON "story_templates"("genre");
