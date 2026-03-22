-- CreateTable
CREATE TABLE "invitation_codes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "created_by_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "bonus_points" INTEGER NOT NULL,
    "max_uses" INTEGER NOT NULL,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "invitation_codes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invitation_records" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "inviter_id" INTEGER NOT NULL,
    "invitee_id" INTEGER NOT NULL,
    "invitation_code" TEXT NOT NULL,
    "bonus_points" INTEGER NOT NULL,
    "milestone_rewards" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invitation_records_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "invitation_records_invitee_id_fkey" FOREIGN KEY ("invitee_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "checkin_records" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "checkin_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consecutive_days" INTEGER NOT NULL,
    "points_earned" INTEGER NOT NULL,
    "is_makeup" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "checkin_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "paid_nodes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "node_id" INTEGER NOT NULL,
    "unlock_price" INTEGER NOT NULL,
    "is_member_free" BOOLEAN NOT NULL DEFAULT false,
    "total_earnings" INTEGER NOT NULL DEFAULT 0,
    "unlock_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "paid_nodes_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "node_unlocks" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "node_id" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "node_unlocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "node_unlocks_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "withdrawal_requests" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payment_method" TEXT NOT NULL,
    "payment_account" TEXT NOT NULL,
    "admin_note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" DATETIME,
    "processed_by" INTEGER,
    CONSTRAINT "withdrawal_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "avatar" TEXT,
    "bio" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "points" INTEGER NOT NULL DEFAULT 0,
    "word_count" INTEGER NOT NULL DEFAULT 0,
    "badges" TEXT,
    "consecutive_days" INTEGER NOT NULL DEFAULT 0,
    "last_checkin_date" DATETIME,
    "makeup_chances" INTEGER NOT NULL DEFAULT 0,
    "invitation_code" TEXT,
    "invited_by_code" TEXT,
    "can_generate_invite" BOOLEAN NOT NULL DEFAULT false,
    "earnings_balance" INTEGER NOT NULL DEFAULT 0,
    "subscription_type" TEXT,
    "subscription_expires" DATETIME,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verification_token" TEXT,
    "email_verification_expires" DATETIME,
    "password_reset_token" TEXT,
    "password_reset_expires" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_users" ("avatar", "bio", "created_at", "email", "email_verification_expires", "email_verification_token", "email_verified", "id", "is_admin", "level", "password", "password_reset_expires", "password_reset_token", "points", "subscription_expires", "subscription_type", "updated_at", "username") SELECT "avatar", "bio", "created_at", "email", "email_verification_expires", "email_verification_token", "email_verified", "id", "is_admin", "level", "password", "password_reset_expires", "password_reset_token", "points", "subscription_expires", "subscription_type", "updated_at", "username" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_invitation_code_key" ON "users"("invitation_code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "invitation_codes_code_key" ON "invitation_codes"("code");

-- CreateIndex
CREATE INDEX "invitation_codes_code_idx" ON "invitation_codes"("code");

-- CreateIndex
CREATE INDEX "invitation_codes_created_by_id_idx" ON "invitation_codes"("created_by_id");

-- CreateIndex
CREATE INDEX "invitation_codes_is_active_idx" ON "invitation_codes"("is_active");

-- CreateIndex
CREATE INDEX "invitation_records_inviter_id_idx" ON "invitation_records"("inviter_id");

-- CreateIndex
CREATE INDEX "invitation_records_invitee_id_idx" ON "invitation_records"("invitee_id");

-- CreateIndex
CREATE INDEX "invitation_records_invitation_code_idx" ON "invitation_records"("invitation_code");

-- CreateIndex
CREATE INDEX "checkin_records_user_id_idx" ON "checkin_records"("user_id");

-- CreateIndex
CREATE INDEX "checkin_records_checkin_date_idx" ON "checkin_records"("checkin_date");

-- CreateIndex
CREATE UNIQUE INDEX "checkin_records_user_id_checkin_date_key" ON "checkin_records"("user_id", "checkin_date");

-- CreateIndex
CREATE UNIQUE INDEX "paid_nodes_node_id_key" ON "paid_nodes"("node_id");

-- CreateIndex
CREATE INDEX "paid_nodes_node_id_idx" ON "paid_nodes"("node_id");

-- CreateIndex
CREATE INDEX "node_unlocks_user_id_idx" ON "node_unlocks"("user_id");

-- CreateIndex
CREATE INDEX "node_unlocks_node_id_idx" ON "node_unlocks"("node_id");

-- CreateIndex
CREATE UNIQUE INDEX "node_unlocks_user_id_node_id_key" ON "node_unlocks"("user_id", "node_id");

-- CreateIndex
CREATE INDEX "withdrawal_requests_user_id_idx" ON "withdrawal_requests"("user_id");

-- CreateIndex
CREATE INDEX "withdrawal_requests_status_idx" ON "withdrawal_requests"("status");

-- CreateIndex
CREATE INDEX "withdrawal_requests_created_at_idx" ON "withdrawal_requests"("created_at");
