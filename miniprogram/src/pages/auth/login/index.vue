<template>
  <view class="login-page">
    <!-- 背景装饰 -->
    <view class="bg-decoration">
      <view class="circle circle-1" />
      <view class="circle circle-2" />
      <view class="circle circle-3" />
    </view>

    <!-- Logo 区域 -->
    <view class="logo-section">
      <image class="logo" src="/static/images/logo.png" mode="aspectFit" />
      <text class="app-name">StoryTree</text>
      <text class="app-slogan">协作式故事创作平台</text>
    </view>

    <!-- 登录表单 -->
    <view class="form-section">
      <view class="form-card">
        <!-- 标签页切换 -->
        <view class="tab-bar">
          <view
            class="tab-item"
            :class="{ active: activeTab === 'email' }"
            @tap="activeTab = 'email'"
          >
            邮箱登录
          </view>
          <view
            class="tab-item"
            :class="{ active: activeTab === 'wx' }"
            @tap="activeTab = 'wx'"
          >
            微信登录
          </view>
        </view>

        <!-- 邮箱登录 -->
        <view v-if="activeTab === 'email'" class="form-body">
          <view class="input-group">
            <text class="input-icon">✉️</text>
            <input
              v-model="form.email"
              class="input"
              type="text"
              placeholder="请输入邮箱"
              placeholder-class="placeholder"
              @confirm="focusPassword"
            />
          </view>
          <view class="input-group">
            <text class="input-icon">🔒</text>
            <input
              ref="passwordInput"
              v-model="form.password"
              class="input"
              :type="showPassword ? 'text' : 'password'"
              placeholder="请输入密码"
              placeholder-class="placeholder"
              @confirm="handleLogin"
            />
            <text class="eye-icon" @tap="showPassword = !showPassword">
              {{ showPassword ? '👁️' : '👁️‍🗨️' }}
            </text>
          </view>

          <view class="forgot-row">
            <text class="forgot-link" @tap="goForgotPassword">忘记密码？</text>
          </view>

          <button
            class="btn-primary"
            :disabled="loading"
            :loading="loading"
            @tap="handleLogin"
          >
            {{ loading ? '登录中...' : '登录' }}
          </button>
        </view>

        <!-- 微信登录 -->
        <view v-else class="form-body wx-body">
          <view class="wx-icon-wrap">
            <text class="wx-icon">💬</text>
          </view>
          <text class="wx-desc">使用微信账号快速登录</text>
          <button
            class="btn-wx"
            open-type="getUserInfo"
            :disabled="loading"
            :loading="loading"
            @tap="handleWxLogin"
          >
            {{ loading ? '登录中...' : '微信一键登录' }}
          </button>
        </view>

        <!-- 分割线 -->
        <view class="divider">
          <view class="divider-line" />
          <text class="divider-text">还没有账号？</text>
          <view class="divider-line" />
        </view>

        <!-- 注册入口 -->
        <button class="btn-register" @tap="goRegister">立即注册</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useUserStore } from '@/store/user'
import { login, wxLogin } from '@/api/auth'

const userStore = useUserStore()

const activeTab = ref<'email' | 'wx'>('email')
const loading = ref(false)
const showPassword = ref(false)
const passwordInput = ref(null)

const form = reactive({
  email: '',
  password: '',
})

function focusPassword() {
  // 聚焦到密码输入框
}

async function handleLogin() {
  if (!form.email.trim()) {
    uni.showToast({ title: '请输入邮箱', icon: 'none' })
    return
  }
  if (!form.password.trim()) {
    uni.showToast({ title: '请输入密码', icon: 'none' })
    return
  }

  loading.value = true
  try {
    const res = await login({ email: form.email.trim(), password: form.password })
    userStore.login(res.token, res.user as any)
    uni.showToast({ title: '登录成功', icon: 'success' })

    // 跳转到首页或上一页
    const pages = getCurrentPages()
    if (pages.length > 1) {
      uni.navigateBack()
    } else {
      uni.switchTab({ url: '/pages/index/index' })
    }
  } catch (err: any) {
    uni.showToast({ title: err.message || '登录失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function handleWxLogin() {
  loading.value = true
  try {
    const { code } = await new Promise<{ code: string }>((resolve, reject) => {
      uni.login({
        provider: 'weixin',
        success: (res) => resolve({ code: res.code }),
        fail: (err) => reject(new Error(err.errMsg || '微信登录失败')),
      })
    })

    const res = await wxLogin({ code })
    userStore.login(res.token, res.user as any)
    uni.showToast({ title: '登录成功', icon: 'success' })

    const pages = getCurrentPages()
    if (pages.length > 1) {
      uni.navigateBack()
    } else {
      uni.switchTab({ url: '/pages/index/index' })
    }
  } catch (err: any) {
    uni.showToast({ title: err.message || '微信登录失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function goRegister() {
  uni.navigateTo({ url: '/pages/auth/register/index' })
}

function goForgotPassword() {
  uni.showModal({
    title: '找回密码',
    content: '请前往网页端找回密码，或联系客服',
    showCancel: false,
    confirmText: '知道了',
  })
}
</script>

<style lang="scss" scoped>
.login-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 32rpx;
}

.bg-decoration {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.circle {
  position: absolute;
  border-radius: 50%;
  opacity: 0.1;

  &-1 {
    width: 400rpx;
    height: 400rpx;
    background: #7c6af7;
    top: -100rpx;
    right: -100rpx;
  }

  &-2 {
    width: 300rpx;
    height: 300rpx;
    background: #a78bfa;
    bottom: 200rpx;
    left: -80rpx;
  }

  &-3 {
    width: 200rpx;
    height: 200rpx;
    background: #7c6af7;
    top: 300rpx;
    right: 50rpx;
  }
}

.logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 120rpx;
  margin-bottom: 60rpx;

  .logo {
    width: 120rpx;
    height: 120rpx;
    border-radius: 30rpx;
    margin-bottom: 20rpx;
  }

  .app-name {
    font-size: 48rpx;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: 4rpx;
  }

  .app-slogan {
    font-size: 24rpx;
    color: #94a3b8;
    margin-top: 8rpx;
  }
}

.form-section {
  width: 100%;
}

.form-card {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 32rpx;
  padding: 40rpx 32rpx;
  backdrop-filter: blur(20px);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
}

.tab-bar {
  display: flex;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 16rpx;
  padding: 6rpx;
  margin-bottom: 40rpx;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #94a3b8;
  transition: all 0.3s;

  &.active {
    background: #7c6af7;
    color: #ffffff;
    font-weight: 600;
  }
}

.form-body {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.input-group {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.06);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  border-radius: 16rpx;
  padding: 0 24rpx;
  height: 96rpx;

  .input-icon {
    font-size: 32rpx;
    margin-right: 16rpx;
  }

  .input {
    flex: 1;
    font-size: 28rpx;
    color: #e2e8f0;
    height: 100%;
  }

  .eye-icon {
    font-size: 32rpx;
    padding: 10rpx;
  }
}

.placeholder {
  color: #64748b;
}

.forgot-row {
  display: flex;
  justify-content: flex-end;
  margin-top: -8rpx;

  .forgot-link {
    font-size: 24rpx;
    color: #7c6af7;
  }
}

.btn-primary {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  background: linear-gradient(135deg, #7c6af7 0%, #a78bfa 100%);
  border-radius: 16rpx;
  font-size: 32rpx;
  color: #ffffff;
  font-weight: 600;
  border: none;
  margin-top: 8rpx;

  &[disabled] {
    opacity: 0.6;
  }
}

.wx-body {
  align-items: center;
  padding: 40rpx 0;
}

.wx-icon-wrap {
  width: 120rpx;
  height: 120rpx;
  background: #07c160;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;

  .wx-icon {
    font-size: 64rpx;
  }
}

.wx-desc {
  font-size: 28rpx;
  color: #94a3b8;
  margin-bottom: 40rpx;
}

.btn-wx {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  background: #07c160;
  border-radius: 16rpx;
  font-size: 32rpx;
  color: #ffffff;
  font-weight: 600;
  border: none;
}

.divider {
  display: flex;
  align-items: center;
  margin: 32rpx 0 24rpx;

  .divider-line {
    flex: 1;
    height: 1rpx;
    background: rgba(255, 255, 255, 0.1);
  }

  .divider-text {
    padding: 0 20rpx;
    font-size: 24rpx;
    color: #64748b;
    white-space: nowrap;
  }
}

.btn-register {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: transparent;
  border: 2rpx solid #7c6af7;
  border-radius: 16rpx;
  font-size: 30rpx;
  color: #7c6af7;
  font-weight: 600;
}
</style>

