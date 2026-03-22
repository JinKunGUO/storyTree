/*
  Warnings:

  - You are about to drop the column `points_awarded` on the `bookmarks` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_bookmarks" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "story_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bookmarks_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_bookmarks" ("created_at", "id", "story_id", "user_id") SELECT "created_at", "id", "story_id", "user_id" FROM "bookmarks";
DROP TABLE "bookmarks";
ALTER TABLE "new_bookmarks" RENAME TO "bookmarks";
CREATE INDEX "bookmarks_user_id_idx" ON "bookmarks"("user_id");
CREATE INDEX "bookmarks_story_id_idx" ON "bookmarks"("story_id");
CREATE UNIQUE INDEX "bookmarks_user_id_story_id_key" ON "bookmarks"("user_id", "story_id");
CREATE TABLE "new_story_followers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "story_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "points_awarded" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "story_followers_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "story_followers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_story_followers" ("created_at", "id", "points_awarded", "story_id", "user_id") SELECT "created_at", "id", "points_awarded", "story_id", "user_id" FROM "story_followers";
DROP TABLE "story_followers";
ALTER TABLE "new_story_followers" RENAME TO "story_followers";
CREATE INDEX "story_followers_user_id_idx" ON "story_followers"("user_id");
CREATE INDEX "story_followers_story_id_idx" ON "story_followers"("story_id");
CREATE UNIQUE INDEX "story_followers_story_id_user_id_key" ON "story_followers"("story_id", "user_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
