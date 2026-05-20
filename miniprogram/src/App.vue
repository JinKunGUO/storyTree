<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useAppStore } from '@/store/app'
import { useUserStore } from '@/store/user'
import { getMe } from '@/api/auth'

onLaunch(() => {
  const appStore = useAppStore()
  const userStore = useUserStore()

  // 初始化系统信息
  appStore.initSystemInfo()
  appStore.loadReaderSettings()

  // 如果已登录，刷新用户信息
  if (userStore.isLoggedIn) {
    getMe().then(res => {
      userStore.setUserInfo(res.user as any)
    }).catch(() => {
      // token 过期，清除登录状态
      userStore.logout()
    })
  }

  console.log('StoryTree App launched')
})

onShow(() => {
  // App 显示时检查网络状态
  uni.getNetworkType({
    success: (res) => {
      const appStore = useAppStore()
      appStore.isOnline = res.networkType !== 'none'
    },
  })
})

onHide(() => {
  console.log('App hide')
})
</script>

<style lang="scss">
/* 全局样式 */
page {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  color: #1e293b;
  background: #f0f2f5;

  /* 暗夜模式 */
  @media (prefers-color-scheme: dark) {
    color: #f0f0f5;
    background: #12122a;
  }
}

/* ========================================
   暗夜模式 CSS 变量（小程序全局）
   与网页端 design-system.css 保持一致
   ======================================== */
page {
  /* 亮色变量 */
  --st-bg-primary: #ffffff;
  --st-bg-secondary: #f9fafb;
  --st-bg-tertiary: #f3f4f6;
  --st-bg-elevated: #ffffff;
  --st-text-primary: #111827;
  --st-text-secondary: #4b5563;
  --st-text-tertiary: #9ca3af;
  --st-text-disabled: #d1d5db;
  --st-text-link: #6366f1;
  --st-gray-100: #f3f4f6;
  --st-gray-200: #e5e7eb;
  --st-gray-300: #d1d5db;
  --st-primary-50: #eef2ff;
  --st-primary-100: #e0e7ff;
  --st-primary-500: #6366f1;
  --st-primary-600: #4f46e5;
  --st-primary-700: #4338ca;
  --st-success-100: #dcfce7;
  --st-success-500: #22c55e;
  --st-success-600: #16a34a;
  --st-warning-100: #fef3c7;
  --st-warning-500: #f59e0b;
  --st-warning-600: #d97706;
  --st-error-100: #fee2e2;
  --st-error-500: #ef4444;
  --st-error-600: #dc2626;
  --st-info-100: #dbeafe;
  --st-info-500: #3b82f6;
  --st-shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --st-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);

  /* 暗夜模式变量覆盖 */
  @media (prefers-color-scheme: dark) {
    --st-bg-primary: #1a1a2e;
    --st-bg-secondary: #12122a;
    --st-bg-tertiary: #262648;
    --st-bg-elevated: #2a2a50;
    --st-text-primary: #f0f0f5;
    --st-text-secondary: #b8b8c8;
    --st-text-tertiary: #9a9ab8;
    --st-text-disabled: #6a6a88;
    --st-text-link: #818cf8;
    --st-gray-100: #252542;
    --st-gray-200: #353560;
    --st-gray-300: #505080;
    --st-primary-50: #1a1a3e;
    --st-primary-100: #1a1a4e;
    --st-success-100: #1a4a2a;
    --st-success-500: #27c563;
    --st-success-600: #3dd87a;
    --st-warning-100: #5c420f;
    --st-warning-500: #f5aa3d;
    --st-warning-600: #ffbf5c;
    --st-error-100: #5c1515;
    --st-error-500: #f05a5a;
    --st-error-600: #ff6b6b;
    --st-info-100: #152a5c;
    --st-info-500: #5c9df5;
    --st-shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
    --st-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3);
  }
}

/* 全局工具类 */
.flex { display: flex; }
.flex-center { display: flex; align-items: center; justify-content: center; }
.flex-between { display: flex; align-items: center; justify-content: space-between; }
.text-center { text-align: center; }
.text-ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 全局按钮重置 */
button {
  &::after {
    border: none;
  }
  background: transparent;
  padding: 0;
  margin: 0;
  line-height: 1;
}
</style>

