-- 修复 MySQL 索引长度超限问题
-- 在云端 MySQL 执行此脚本

-- 1. 删除可能有问题的索引
DROP INDEX IF EXISTS `nodes_path_idx` ON `nodes`;

-- 2. 修改 path 字段长度（如果需要）
ALTER TABLE `nodes` MODIFY COLUMN `path` VARCHAR(500);

-- 3. 重新创建索引（使用前缀索引，只索引前 191 个字符）
CREATE INDEX `nodes_path_idx` ON `nodes` (`path`(191));

-- 4. 检查其他可能有问题的长字段索引
-- 如果 title 有索引且超长，也需要处理
-- ALTER TABLE `stories` MODIFY COLUMN `title` VARCHAR(500);

-- 5. 显示当前索引状态
SHOW INDEX FROM `nodes`;
SHOW INDEX FROM `stories`;
SHOW INDEX FROM `users`;

