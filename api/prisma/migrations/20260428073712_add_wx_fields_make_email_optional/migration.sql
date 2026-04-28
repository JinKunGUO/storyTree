-- AlterTable
ALTER TABLE "orders" ADD COLUMN "transaction_id" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT,
    "avatar" TEXT,
    "bio" TEXT,
    "wx_nickname" TEXT,
    "wx_avatar" TEXT,
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
    "wx_openid" TEXT,
    "wx_unionid" TEXT,
    "active_token" TEXT,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verification_token" TEXT,
    "email_verification_expires" DATETIME,
    "password_reset_token" TEXT,
    "password_reset_expires" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_users" ("active_token", "avatar", "badges", "bio", "consecutive_days", "created_at", "earnings_balance", "email", "email_verification_expires", "email_verification_token", "email_verified", "has_used_trial", "id", "invited_by_code", "is_admin", "last_checkin_date", "level", "makeup_chances", "membership_auto_renew", "membership_expires_at", "membership_payment_method", "membership_started_at", "membership_tier", "password", "password_reset_expires", "password_reset_token", "points", "subscription_expires", "subscription_type", "updated_at", "username", "word_count", "wx_openid", "wx_unionid") SELECT "active_token", "avatar", "badges", "bio", "consecutive_days", "created_at", "earnings_balance", "email", "email_verification_expires", "email_verification_token", "email_verified", "has_used_trial", "id", "invited_by_code", "is_admin", "last_checkin_date", "level", "makeup_chances", "membership_auto_renew", "membership_expires_at", "membership_payment_method", "membership_started_at", "membership_tier", "password", "password_reset_expires", "password_reset_token", "points", "subscription_expires", "subscription_type", "updated_at", "username", "word_count", "wx_openid", "wx_unionid" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_wx_openid_key" ON "users"("wx_openid");
CREATE UNIQUE INDEX "users_wx_unionid_key" ON "users"("wx_unionid");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
