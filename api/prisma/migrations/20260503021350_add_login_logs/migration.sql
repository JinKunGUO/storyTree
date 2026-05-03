-- CreateTable
CREATE TABLE "login_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER,
    "ip" TEXT,
    "user_agent" TEXT,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "fail_reason" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "login_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "login_logs_user_id_idx" ON "login_logs"("user_id");

-- CreateIndex
CREATE INDEX "login_logs_created_at_idx" ON "login_logs"("created_at");

-- CreateIndex
CREATE INDEX "login_logs_status_idx" ON "login_logs"("status");

-- CreateIndex
CREATE INDEX "login_logs_ip_idx" ON "login_logs"("ip");
