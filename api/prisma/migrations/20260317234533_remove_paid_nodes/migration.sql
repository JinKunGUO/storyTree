/*
  Warnings:

  - You are about to drop the `node_unlocks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `paid_nodes` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "node_unlocks";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "paid_nodes";
PRAGMA foreign_keys=on;
