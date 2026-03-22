-- AlterTable
ALTER TABLE "orders" ADD COLUMN "discount_amount" REAL;
ALTER TABLE "orders" ADD COLUMN "discount_code" TEXT;
ALTER TABLE "orders" ADD COLUMN "expires_at" DATETIME;
ALTER TABLE "orders" ADD COLUMN "original_amount" REAL;
ALTER TABLE "orders" ADD COLUMN "tier" TEXT;

-- CreateTable
CREATE TABLE "user_subscriptions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "tier" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" DATETIME NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "payment_method" TEXT,
    "order_id" TEXT,
    "original_price" REAL NOT NULL,
    "paid_price" REAL NOT NULL,
    "discount_code" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" DATETIME,
    "cancel_reason" TEXT,
    CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_subscriptions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "membership_benefits_log" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "benefit_type" TEXT NOT NULL,
    "used_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "membership_tier" TEXT NOT NULL,
    "user_level" INTEGER NOT NULL,
    CONSTRAINT "membership_benefits_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "invited_by_code" TEXT,
    "earnings_balance" INTEGER NOT NULL DEFAULT 0,
    "membership_tier" TEXT NOT NULL DEFAULT 'free',
    "membership_started_at" DATETIME,
    "membership_expires_at" DATETIME,
    "membership_auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "membership_payment_method" TEXT,
    "has_used_trial" BOOLEAN NOT NULL DEFAULT false,
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
INSERT INTO "new_users" ("avatar", "badges", "bio", "consecutive_days", "created_at", "earnings_balance", "email", "email_verification_expires", "email_verification_token", "email_verified", "id", "invited_by_code", "is_admin", "last_checkin_date", "level", "makeup_chances", "password", "password_reset_expires", "password_reset_token", "points", "subscription_expires", "subscription_type", "updated_at", "username", "word_count") SELECT "avatar", "badges", "bio", "consecutive_days", "created_at", "earnings_balance", "email", "email_verification_expires", "email_verification_token", "email_verified", "id", "invited_by_code", "is_admin", "last_checkin_date", "level", "makeup_chances", "password", "password_reset_expires", "password_reset_token", "points", "subscription_expires", "subscription_type", "updated_at", "username", "word_count" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "user_subscriptions_order_id_key" ON "user_subscriptions"("order_id");

-- CreateIndex
CREATE INDEX "user_subscriptions_user_id_idx" ON "user_subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "user_subscriptions_status_idx" ON "user_subscriptions"("status");

-- CreateIndex
CREATE INDEX "user_subscriptions_expires_at_idx" ON "user_subscriptions"("expires_at");

-- CreateIndex
CREATE INDEX "user_subscriptions_tier_idx" ON "user_subscriptions"("tier");

-- CreateIndex
CREATE INDEX "membership_benefits_log_user_id_idx" ON "membership_benefits_log"("user_id");

-- CreateIndex
CREATE INDEX "membership_benefits_log_benefit_type_idx" ON "membership_benefits_log"("benefit_type");

-- CreateIndex
CREATE INDEX "membership_benefits_log_used_at_idx" ON "membership_benefits_log"("used_at");

-- CreateIndex
CREATE INDEX "orders_type_idx" ON "orders"("type");
