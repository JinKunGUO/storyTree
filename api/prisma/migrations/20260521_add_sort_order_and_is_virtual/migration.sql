-- AlterTable: nodes 表增加 sort_order 字段
ALTER TABLE "nodes" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: users 表增加 is_virtual 字段
ALTER TABLE "users" ADD COLUMN "is_virtual" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex: sort_order 索引
CREATE INDEX "nodes_sort_order_idx" ON "nodes"("sort_order");

-- 数据迁移：为已有节点按 story_id + id 顺序填充 sort_order
-- 这样确保同一故事内的章节按创建顺序排列
UPDATE "nodes" SET "sort_order" = subquery.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY story_id ORDER BY id ASC) as row_num
  FROM "nodes"
) AS subquery
WHERE "nodes".id = subquery.id;
