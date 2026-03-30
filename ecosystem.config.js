// PM2 进程管理配置文件
// 使用方法：
//   启动：pm2 start ecosystem.config.js --env production
//   重启：pm2 restart storytree-api
//   停止：pm2 stop storytree-api
//   查看日志：pm2 logs storytree-api
//   监控：pm2 monit

module.exports = {
  apps: [
    {
      name: 'storytree-api',
      script: 'dist/index.js',
      cwd: '/var/www/storytree/api',

      // 实例配置
      instances: 1,       // 单实例（1核服务器）
      exec_mode: 'fork',  // 单实例使用 fork 模式

      // 自动重启配置
      autorestart: true,
      watch: false,       // 生产环境不监听文件变化
      max_memory_restart: '500M',

      // 重启策略
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,

      // 日志配置
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/var/log/pm2/storytree-api-error.log',
      out_file: '/var/log/pm2/storytree-api-out.log',
      merge_logs: true,

      // 环境变量
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
  ],
};

