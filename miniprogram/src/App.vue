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

