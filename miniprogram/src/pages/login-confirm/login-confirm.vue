<template>
  <view class="confirm-page">
    <view class="card">
      <text class="title">登录确认</text>
      <text class="desc">网页版 StoryTree 请求使用当前账号登录</text>

      <view v-if="userStore.isLoggedIn" class="user-box">
        <image class="avatar" :src="userStore.avatarUrl" mode="aspectFill" />
        <text class="username">{{ userStore.userInfo?.username }}</text>
      </view>

      <button
        v-if="userStore.isLoggedIn"
        class="btn-primary"
        :disabled="confirming"
        @tap="handleConfirm"
      >
        {{ confirming ? '确认中...' : '确认登录网页版' }}
      </button>

      <button v-else class="btn-primary" @tap="goLogin">请先登录小程序</button>

      <button class="btn-plain" @tap="goHome">取消</button>

      <text class="hint">确认后小程序端将自动退出登录（单端互踢），下次打开自动重新登录</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/user'
import { confirmQrLogin } from '@/api/auth'

const userStore = useUserStore()
const ticketId = ref('')
const confirming = ref(false)

onLoad((options) => {
  // 小程序码场景值：scene = qrlogin=<ticketId>（URL 编码）
  const scene = decodeURIComponent((options as any)?.scene || '')
  const match = scene.match(/qrlogin=([a-f0-9]{16})/)
  if (match) {
    ticketId.value = match[1]
  } else {
    uni.showToast({ title: '二维码参数无效', icon: 'none' })
  }
})

async function handleConfirm() {
  if (!ticketId.value) {
    uni.showToast({ title: '二维码参数无效', icon: 'none' })
    return
  }
  confirming.value = true
  try {
    await confirmQrLogin(ticketId.value)
    uni.showToast({ title: '网页端已登录', icon: 'success' })
    setTimeout(() => {
      uni.switchTab({ url: '/pages/index/index' })
    }, 1500)
  } catch (e: any) {
    uni.showToast({ title: e?.message || '确认失败，请刷新网页二维码重试', icon: 'none' })
  } finally {
    confirming.value = false
  }
}

function goLogin() {
  uni.navigateTo({ url: '/pkgAuth/pages/auth/login/index' })
}

function goHome() {
  uni.switchTab({ url: '/pages/index/index' })
}
</script>

<style scoped>
.confirm-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f2f5;
  padding: 32rpx;
}
.card {
  width: 100%;
  max-width: 600rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 48rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 8rpx 40rpx rgba(0, 0, 0, 0.08);
}
.title {
  font-size: 40rpx;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 12rpx;
}
.desc {
  font-size: 26rpx;
  color: #666;
  margin-bottom: 40rpx;
  text-align: center;
}
.user-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 40rpx;
}
.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  margin-bottom: 16rpx;
  background: #eee;
}
.username {
  font-size: 32rpx;
  font-weight: 500;
  color: #333;
}
.btn-primary {
  width: 100%;
  background: #6366f1;
  color: #fff;
  border-radius: 12rpx;
  font-size: 30rpx;
  margin-bottom: 20rpx;
}
.btn-primary[disabled] {
  opacity: 0.6;
}
.btn-plain {
  width: 100%;
  background: #f3f4f6;
  color: #666;
  border-radius: 12rpx;
  font-size: 30rpx;
  margin-bottom: 24rpx;
}
.hint {
  font-size: 22rpx;
  color: #999;
  text-align: center;
  line-height: 1.6;
}
</style>
