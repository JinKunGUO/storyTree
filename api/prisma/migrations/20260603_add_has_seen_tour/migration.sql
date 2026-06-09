-- AlterTable: users 表增加 has_seen_tour 字段（新手引导状态）
ALTER TABLE "users" ADD COLUMN "has_seen_tour" BOOLEAN NOT NULL DEFAULT false;

