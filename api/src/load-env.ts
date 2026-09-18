import dotenv from 'dotenv';

// ⚠️ 本模块必须保持在 index.ts 的第一个 import 位置。
// 原因：utils/auth.ts 的 JWT_SECRET、db.ts 的 PrismaClient 均在模块加载期读取 process.env，
// 而 CommonJS 编译后所有 require 先于模块体执行，若在此处之后才调用 dotenv.config()，
// 这些模块会读到空值；生产环境（NODE_ENV=production）会直接在 auth.ts 抛错导致启动失败。
// 另外 require('@prisma/client') 自带“自动加载 .env”的副作用且 dotenv 不覆盖已存在变量，
// 只有本模块最先执行，.env.production 的值才能优先于 Prisma 注入的开发 .env 值生效。
dotenv.config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env',
});
