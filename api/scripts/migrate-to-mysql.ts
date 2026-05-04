#!/usr/bin/env node

/**
 * SQLite → MySQL 数据迁移脚本
 * 
 * 使用方法：
 * 1. 确保 MySQL 数据库已创建
 * 2. 配置 .env 中的 DATABASE_URL 为 MySQL 连接字符串
 * 3. 运行：npx ts-node scripts/migrate-to-mysql.ts
 * 
 * 注意：
 * - 迁移前请备份 SQLite 数据库
 * - 迁移过程中请勿操作数据库
 */

import { PrismaClient as SQLiteClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// SQLite 数据库路径
const SQLITE_DB_PATH = path.join(__dirname, '../prisma/dev.db');

// 检查 SQLite 数据库是否存在
if (!fs.existsSync(SQLITE_DB_PATH)) {
  console.error('❌ SQLite 数据库不存在:', SQLITE_DB_PATH);
  process.exit(1);
}

// 迁移表的顺序（考虑外键依赖）
const MIGRATION_ORDER = [
  'users',
  'stories',
  'nodes',
  'bookmarks',
  'node_bookmarks',
  'comments',
  'comment_votes',
  'follows',
  'notifications',
  'ratings',
  'reports',
  'shares',
  'story_collaborators',
  'story_followers',
  'collaboration_requests',
  'delete_requests',
  'invitation_codes',
  'invitation_records',
  'checkin_records',
  'point_transactions',
  'orders',
  'user_subscriptions',
  'membership_benefits_log',
  'tips',
  'withdrawal_requests',
  'ai_tasks',
  'ai_usage_logs',
  'login_logs',
];

interface MigrationStats {
  table: string;
  count: number;
  success: boolean;
  error?: string;
}

async function migrateTable(
  sqliteClient: any,
  mysqlClient: any,
  tableName: string
): Promise<MigrationStats> {
  console.log(`\n📦 迁移表: ${tableName}`);
  
  try {
    // 从 SQLite 读取数据
    const data = await (sqliteClient as any)[tableName].findMany();
    console.log(`  📖 读取 ${data.length} 条记录`);

    if (data.length === 0) {
      return { table: tableName, count: 0, success: true };
    }

    // 批量写入 MySQL（每批 100 条）
    const batchSize = 100;
    let migrated = 0;

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      // 处理数据类型转换
      const processedBatch = batch.map((record: any) => {
        const processed = { ...record };
        
        // 处理日期字段
        for (const key of Object.keys(processed)) {
          if (processed[key] instanceof Date) {
            // 保持 Date 对象
          } else if (typeof processed[key] === 'string' && isDateString(processed[key])) {
            processed[key] = new Date(processed[key]);
          }
        }
        
        return processed;
      });

      // 使用 createMany 批量插入
      await (mysqlClient as any)[tableName].createMany({
        data: processedBatch,
        skipDuplicates: true,
      });

      migrated += batch.length;
      process.stdout.write(`  ✏️ 已迁移 ${migrated}/${data.length}\r`);
    }

    console.log(`  ✅ 完成迁移 ${migrated} 条记录`);
    return { table: tableName, count: migrated, success: true };
  } catch (error: any) {
    console.error(`  ❌ 迁移失败: ${error.message}`);
    return { table: tableName, count: 0, success: false, error: error.message };
  }
}

function isDateString(value: string): boolean {
  // 检查是否是 ISO 日期字符串
  return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(value);
}

async function main() {
  console.log('🚀 开始 SQLite → MySQL 数据迁移');
  console.log('================================\n');

  // 创建 SQLite 客户端（使用原始配置）
  const sqliteClient = new SQLiteClient({
    datasources: {
      db: {
        url: `file:${SQLITE_DB_PATH}`,
      },
    },
  });

  // 创建 MySQL 客户端（使用环境变量配置）
  const mysqlUrl = process.env.DATABASE_URL;
  if (!mysqlUrl || !mysqlUrl.startsWith('mysql://')) {
    console.error('❌ 请配置 DATABASE_URL 为 MySQL 连接字符串');
    console.error('   格式: mysql://user:password@host:port/database');
    process.exit(1);
  }

  const mysqlClient = new SQLiteClient({
    datasources: {
      db: {
        url: mysqlUrl,
      },
    },
  });

  try {
    // 连接数据库
    await sqliteClient.$connect();
    console.log('✅ SQLite 连接成功');

    await mysqlClient.$connect();
    console.log('✅ MySQL 连接成功');

    // 执行迁移
    const stats: MigrationStats[] = [];

    for (const tableName of MIGRATION_ORDER) {
      const result = await migrateTable(sqliteClient, mysqlClient, tableName);
      stats.push(result);
    }

    // 打印迁移报告
    console.log('\n================================');
    console.log('📊 迁移报告');
    console.log('================================\n');

    let totalRecords = 0;
    let successTables = 0;
    let failedTables = 0;

    for (const stat of stats) {
      const status = stat.success ? '✅' : '❌';
      console.log(`${status} ${stat.table}: ${stat.count} 条记录${stat.error ? ` (错误: ${stat.error})` : ''}`);
      totalRecords += stat.count;
      if (stat.success) successTables++;
      else failedTables++;
    }

    console.log('\n================================');
    console.log(`📈 总计: ${totalRecords} 条记录`);
    console.log(`✅ 成功: ${successTables} 个表`);
    if (failedTables > 0) {
      console.log(`❌ 失败: ${failedTables} 个表`);
    }
    console.log('================================\n');

    if (failedTables === 0) {
      console.log('🎉 迁移完成！');
    } else {
      console.log('⚠️ 迁移完成，但有部分表失败，请检查错误信息');
    }
  } catch (error: any) {
    console.error('\n❌ 迁移过程中发生错误:', error.message);
    process.exit(1);
  } finally {
    await sqliteClient.$disconnect();
    await mysqlClient.$disconnect();
  }
}

// 运行迁移
main();

