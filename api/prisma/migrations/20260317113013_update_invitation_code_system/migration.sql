/*
  Warnings:

  - You are about to drop the column `can_generate_invite` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `invitation_code` on the `users` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_invitation_codes" (
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
    "version" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "invitation_codes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_invitation_codes" ("bonus_points", "code", "created_at", "created_by_id", "expires_at", "id", "is_active", "max_uses", "type", "used_count") SELECT "bonus_points", "code", "created_at", "created_by_id", "expires_at", "id", "is_active", "max_uses", "type", "used_count" FROM "invitation_codes";
DROP TABLE "invitation_codes";
ALTER TABLE "new_invitation_codes" RENAME TO "invitation_codes";
CREATE UNIQUE INDEX "invitation_codes_code_key" ON "invitation_codes"("code");
CREATE INDEX "invitation_codes_code_idx" ON "invitation_codes"("code");
CREATE INDEX "invitation_codes_created_by_id_idx" ON "invitation_codes"("created_by_id");
CREATE INDEX "invitation_codes_is_active_idx" ON "invitation_codes"("is_active");
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
