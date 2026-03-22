-- CreateTable
CREATE TABLE "node_bookmarks" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "node_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "node_bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "node_bookmarks_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "node_bookmarks_user_id_node_id_key" ON "node_bookmarks"("user_id", "node_id");

-- CreateIndex
CREATE INDEX "node_bookmarks_user_id_idx" ON "node_bookmarks"("user_id");

-- CreateIndex
CREATE INDEX "node_bookmarks_node_id_idx" ON "node_bookmarks"("node_id");

